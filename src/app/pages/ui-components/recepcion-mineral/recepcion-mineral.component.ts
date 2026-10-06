import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import {
  ESTADOS_OPERACION,
  ESTADO_CANCELADO_ID,
  ESTADO_LIQUIDADO_ID,
  ESTADO_TRANZADO_ID,
  FiltrosRegistroMineral,
  OrdenDireccion,
  RegistroMineral,
  detalleProveedorRecepcion,
  leyesTextoRecepcion,
  nombreProveedorRecepcion,
  recepcionImprimible,
} from '../models/registro-mineral.models';
import { RegistroMineralService } from '../services/registro-mineral.service';
import {
  abrirProcesarBorradorAnticipo,
  abrirReciboAnticipo,
  anticipoSinProcesar,
} from './recibo-anticipo.util';
import { ReciboService } from '../../contabilidad/services/recibo.service';
import { formatFechaIso } from '../../contabilidad/components/personal-interno.util';
import {
  VerRecepcionDialogComponent,
  VerRecepcionDialogData,
} from './ver-recepcion-dialog/ver-recepcion-dialog.component';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';
import { RangoFechasComponent } from '../../../shared/components/rango-fechas/rango-fechas.component';
import { abrirBlobEnPestana } from 'src/app/shared/utils/descarga-archivo.util';
import { horaFechaDeIso } from 'src/app/shared/utils/fecha-bolivia.util';
import { formatNumeroConMiles } from 'src/app/shared/utils/numero.util';

interface OpcionOrden {
  value: string;
  label: string;
}

@Component({
  selector: 'app-recepcion-mineral',
  imports: [
    RangoFechasComponent,
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './recepcion-mineral.component.html',
  styleUrl: './recepcion-mineral.component.scss',
})
export class RecepcionMineralComponent implements OnInit {
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly valorizacionMineralService = inject(
    ValorizacionMineralService,
  );
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly reciboService = inject(ReciboService);

  /** Estados desde los que una recepción puede pasar a valorización. */
  private readonly ESTADOS_VALORIZABLES = new Set([2, 3, 6]); // APROBADO, RECHAZADO A TOL, REMUESTREO
  /** Ids de recepción para los que ya se está creando el borrador de valorización (evita doble clic). */
  readonly procesandoValorizacion = signal<Set<string>>(new Set());

  /**
   * Transiciones de estado permitidas, según las reglas de negocio:
   * - EN RECEPCIÓN (1): recién ingresado -> se aprueba o se cancela.
   * - APROBADO (2): puede pasar a rechazado a tol, ir a remuestreo o cancelarse.
   *   (TRANZADO no es una transición manual: ocurre al valorizar).
   * - RECHAZADO A TOL (3): ocurre después de aprobado -> puede ir a remuestreo o cancelarse.
   * - CANCELADO (4): terminal, sin transiciones.
   * - TRANZADO (5): terminal, sin transiciones (ya se hizo la valorización).
   * - REMUESTREO (6): ocurre después de aprobado o rechazado a tol -> se vuelve a evaluar.
   *
   * CANCELADO, dentro de las transiciones de cada estado, solo lo puede
   * aplicar ADMINISTRADOR (ver transicionesDisponibles); OPERADOR puede usar
   * el resto con normalidad.
   */
  private readonly TRANSICIONES_VALIDAS: Record<number, number[]> = {
    1: [2, 4],
    2: [3, 6, 4],
    3: [6, 4],
    4: [],
    5: [],
    6: [2, 3, 4],
  };

  /** Fecha máxima seleccionable en los filtros "Desde"/"Hasta": no se permiten fechas futuras. */
  readonly hoy = new Date();

  readonly displayedColumns = [
    'id',
    'operacion',
    'proveedor',
    'detalle',
    'estado',
    'acciones',
  ];
  readonly estados = ESTADOS_OPERACION;

  readonly registros = signal<RegistroMineral[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly codigoControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly estadoControl = new FormControl<number | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);

  readonly opcionesOrden: OpcionOrden[] = [
    // { value: 'id', label: 'ID' }, // se deja de exponer el id: se muestra numeración correlativa
    { value: 'codigoOperacion', label: 'Código de operación' },
    { value: 'fechaRecepcion', label: 'Fecha de recepción' },
    { value: 'numeroDocumento', label: 'N° de documento' },
    { value: 'estado', label: 'Estado' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl = new FormControl<OrdenDireccion>('DESC');

  // Presentación (usados desde el template).
  readonly formatFechaTabla = horaFechaDeIso;
  readonly formatNumero = formatNumeroConMiles;
  readonly nombreProveedor = nombreProveedorRecepcion;
  readonly detalleProveedor = detalleProveedorRecepcion;
  readonly leyesTexto = leyesTextoRecepcion;

  /** ADMINISTRADOR y OPERADOR pueden editar y cambiar estado; TÉCNICO solo lista y crea. */
  get puedeGestionar(): boolean {
    return this.authService.hasRole(
      RolCodigo.ADMINISTRADOR,
      RolCodigo.OPERADOR,
    );
  }

  ngOnInit(): void {
    // Los textos esperan a que se deje de escribir; el resto filtra al instante.
    const textos = [
      this.searchControl,
      this.codigoControl,
      this.documentoControl,
    ].map((c) => c.valueChanges.pipe(debounceTime(400), distinctUntilChanged()));

    merge(
      ...textos,
      this.estadoControl.valueChanges,
      this.fechaDesdeControl.valueChanges,
      this.fechaHastaControl.valueChanges,
      this.orderByControl.valueChanges,
      this.orderDirectionControl.valueChanges,
    ).subscribe(() => this.reiniciarYcargar());

    this.cargarRegistros();
  }

  /** Tiene un recibo de anticipo vigente (el back solo devuelve BORRADOR/PROCESADO). */
  tieneReciboAnticipo(r: RegistroMineral): boolean {
    return !!r.recibos?.length;
  }

  /** El anticipo aún no salió de caja/banco: sin recibo (se salió antes de
   *  generarlo) o con el recibo todavía en BORRADOR. */
  anticipoSinProcesar(r: RegistroMineral): boolean {
    return anticipoSinProcesar(r) && r.idEstado !== ESTADO_CANCELADO_ID;
  }

  /** Abre directo "Procesar recibo": sobre el borrador si ya existe, o
   *  creando y procesando el recibo en un solo paso si todavía no hay. */
  procesarReciboAnticipo(r: RegistroMineral): void {
    const refrescar = (recibo: unknown) => {
      if (recibo) this.cargarRegistros();
    };
    const borrador = r.recibos?.[0];
    if (!borrador) {
      abrirReciboAnticipo(this.dialog, r, 'PROCESAR').subscribe(refrescar);
      return;
    }
    // La recepción trae solo un resumen del recibo: procesar necesita el completo.
    this.reciboService.obtener(borrador.id).subscribe({
      next: (completo) =>
        abrirProcesarBorradorAnticipo(this.dialog, completo).subscribe(refrescar),
      error: (err) =>
        this.avisar(
          err?.error?.message ?? 'No se pudo cargar el recibo de anticipo',
        ),
    });
  }

  verPdfReciboAnticipo(r: RegistroMineral): void {
    const recibo = r.recibos?.[0];
    if (!recibo) return;
    this.reciboService.obtenerPdf(recibo.id).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.avisar(
          err?.error?.message ?? 'No se pudo generar el PDF del recibo',
        ),
    });
  }

  private avisar(mensaje: string, duration = 4000): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration });
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargarRegistros();
  }

  private fechaFiltro(fecha: Date | null): string | undefined {
    return fecha ? formatFechaIso(fecha) : undefined;
  }

  cargarRegistros(): void {
    this.loading.set(true);

    this.registroMineralService
      .listarRegistros({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value || undefined,
        codigoOperacion: this.codigoControl.value || undefined,
        numeroDocumento: this.documentoControl.value || undefined,
        idEstado: this.estadoControl.value ?? undefined,
        fechaDesde: this.fechaFiltro(this.fechaDesdeControl.value),
        fechaHasta: this.fechaFiltro(this.fechaHastaControl.value),
        orderBy: (this.orderByControl.value as FiltrosRegistroMineral['orderBy']) ?? undefined,
        orderDirection: this.orderDirectionControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.avisar('No se pudo cargar el listado de recepciones');
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarRegistros();
  }

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.codigoControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('id', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  /** Numeración correlativa (no el id real, que queda con huecos por bajas):
   *  el más antiguo es 1 y el más nuevo es `total()`, sin importar en qué
   *  posición de la página caiga. Se invierte según el sentido del orden
   *  actual para que ese número no cambie con la fila, sino que se mantenga
   *  ligado al mismo registro al togglear ascendente/descendente. */
  numeroFila(i: number): number {
    const offset = this.pageIndex * this.pageSize + i;
    return this.orderDirectionControl.value === 'ASC'
      ? offset + 1
      : this.total() - offset;
  }

  /** Editable en cualquier estado salvo TRANZADO y CANCELADO: ambos son
   *  terminales (ver TRANSICIONES_VALIDAS), así que la recepción no debe
   *  tocarse una vez llegada a cualquiera de los dos. */
  puedeEditar(registro: RegistroMineral): boolean {
    return (
      registro.idEstado !== ESTADO_TRANZADO_ID &&
      registro.idEstado !== ESTADO_CANCELADO_ID
    );
  }

  /** Toda recepción no cancelada tiene comprobante RM- para imprimir. */
  puedeImprimir(registro: RegistroMineral): boolean {
    return recepcionImprimible(registro.idEstado);
  }

  /** APROBADO, RECHAZADO A TOL y REMUESTREO ya pueden pasar a valorización. */
  puedeValorizar(registro: RegistroMineral): boolean {
    return this.ESTADOS_VALORIZABLES.has(registro.idEstado);
  }

  /** true mientras se está creando el borrador de valorización para este registro (evita doble clic). */
  valorizando(registro: RegistroMineral): boolean {
    return this.procesandoValorizacion().has(registro.id);
  }

  private marcarValorizando(id: string, enCurso: boolean): void {
    this.procesandoValorizacion.update((actual) => {
      const nuevo = new Set(actual);
      if (enCurso) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }

  /**
   * Crea el borrador de valorización a partir de esta recepción y navega al
   * formulario de valorización. Una recepción solo puede tener una
   * valorización: si el backend responde que ya existe, se informa por
   * snackbar sin navegar.
   */
  valorizar(registro: RegistroMineral): void {
    if (!this.puedeGestionar || this.valorizando(registro)) return;

    this.marcarValorizando(registro.id, true);

    this.valorizacionMineralService.crearBorrador(registro.id).subscribe({
      next: (valorizacion) => {
        this.marcarValorizando(registro.id, false);
        this.avisar('Borrador de valorización creado', 3000);
        this.router.navigate([
          '/ui-components/valorizacion/editar',
          valorizacion.id,
        ]);
      },
      error: (err) => {
        this.marcarValorizando(registro.id, false);
        this.avisar(
          err?.error?.message ??
            'No se pudo crear la valorización para esta recepción',
        );
      },
    });
  }

  /** Estados a los que se puede pasar desde el estado actual del registro.
   *  CANCELADO queda reservado a ADMINISTRADOR: OPERADOR ve el resto de
   *  transiciones normalmente. */
  transicionesDisponibles(registro: RegistroMineral): typeof ESTADOS_OPERACION {
    let idsValidos = this.TRANSICIONES_VALIDAS[registro.idEstado] ?? [];
    if (!this.authService.isAdmin()) {
      idsValidos = idsValidos.filter((id) => id !== ESTADO_CANCELADO_ID);
    }
    return this.estados.filter((e) => idsValidos.includes(e.id));
  }

  claseEstado(idEstado: number): string {
    switch (idEstado) {
      case 1:
        return 'estado-chip--pendiente'; // EN RECEPCIÓN
      case 2:
        return 'estado-chip--aprobado'; // APROBADO
      case 3:
        return 'estado-chip--rechazado'; // RECHAZADO A TOL
      case ESTADO_CANCELADO_ID:
        return 'estado-chip--cancelado';
      case ESTADO_TRANZADO_ID:
        return 'estado-chip--tranzado';
      case 6:
        return 'estado-chip--remuestreo'; // REMUESTREO
      case ESTADO_LIQUIDADO_ID:
        return 'estado-chip--liquidado';
      default:
        return '';
    }
  }

  /** Abre el visualizador de datos de la recepción. */
  verDetalle(registro: RegistroMineral): void {
    const data: VerRecepcionDialogData = {
      registro,
      puedeImprimir: this.puedeImprimir(registro),
    };
    this.dialog.open(VerRecepcionDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data,
    });
  }

  /** Abre el comprobante RM- (PDF del back) en otra pestaña. */
  imprimirComprobante(registro: RegistroMineral): void {
    this.registroMineralService.obtenerPdf(registro.id).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.avisar(
          err?.error?.message ??
            'No se pudo generar el comprobante de la recepción',
        ),
    });
  }

  cambiarEstado(registro: RegistroMineral, nuevoEstadoId: number): void {
    const idsValidos = this.TRANSICIONES_VALIDAS[registro.idEstado] ?? [];
    if (!this.puedeGestionar || !idsValidos.includes(nuevoEstadoId)) return;
    if (nuevoEstadoId === ESTADO_CANCELADO_ID && !this.authService.isAdmin()) {
      return;
    }

    this.registroMineralService
      .cambiarEstado(registro.id, nuevoEstadoId)
      .subscribe({
        next: (actualizado) => {
          this.registros.update((lista) =>
            lista.map((r) => (r.id === registro.id ? actualizado : r)),
          );
          this.avisar('Estado actualizado correctamente', 3000);
        },
        error: (err) =>
          this.avisar(err?.error?.message ?? 'No se pudo cambiar el estado'),
      });
  }
}
