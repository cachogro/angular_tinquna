import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import {
  ESTADOS_OPERACION,
  ESTADO_LIQUIDADO_ID,
  RegistroMineral,
} from '../models/registro-mineral.models';
import { RegistroMineralService } from '../services/registro-mineral.service';
import { VerRecepcionDialogComponent } from './ver-recepcion-dialog/ver-recepcion-dialog.component';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';
import { formatNumeroSinCeros } from 'src/app/shared/utils/numero.util';



@Component({
  selector: 'app-recepcion-mineral',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatCheckboxModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
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

  /** Estados en los que el registro todavía puede editarse (datos del formulario). */
  private readonly ESTADOS_EDITABLES = new Set([1, 6]); // EN RECEPCIÓN, REMUESTREO
  /** Estados en los que ya se puede imprimir el PDF de la recepción. */
  private readonly ESTADOS_CON_IMPRESION = new Set([2, 3, 5, 6]); // APROBADO, RECHAZADO A TOL, TRANZADO, REMUESTREO
  /** Estados desde los que una recepción puede pasar a valorización. */
  private readonly ESTADOS_VALORIZABLES = new Set([2, 3, 6]); // APROBADO, RECHAZADO A TOL, REMUESTREO
  /** Ids de recepción para los que ya se está creando el borrador de valorización (evita doble clic). */
  readonly procesandoValorizacion = signal<Set<string>>(new Set());

  /**
   * Transiciones de estado permitidas, según las reglas de negocio:
   * - EN RECEPCIÓN (1): recién ingresado -> se aprueba o se cancela.
   * - APROBADO (2): puede pasar a rechazado a tol, tranzarse, ir a remuestreo o cancelarse.
   * - RECHAZADO A TOL (3): ocurre después de aprobado -> puede ir a remuestreo o cancelarse.
   * - CANCELADO (4): terminal, sin transiciones.
   * - TRANZADO (5): terminal, sin transiciones (ya se hizo la valorización).
   * - REMUESTREO (6): ocurre después de aprobado o rechazado a tol -> se vuelve a evaluar.
   */
  private readonly TRANSICIONES_VALIDAS: Record<number, number[]> = {
    1: [2, 4],
    2: [3, 5, 6, 4],
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
  readonly ESTADO_LIQUIDADO_ID = ESTADO_LIQUIDADO_ID;

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

  /** ADMINISTRADOR y OPERADOR pueden editar y cambiar estado; TÉCNICO solo lista y crea. */
  get puedeGestionar(): boolean {
    return this.authService.hasRole(
      RolCodigo.ADMINISTRADOR,
      RolCodigo.OPERADOR,
    );
  }

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.codigoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.documentoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaDesdeControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );
    this.fechaHastaControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.cargarRegistros();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargarRegistros();
  }

  private formatFecha(fecha: Date | null): string | undefined {
    if (!fecha) return undefined;
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /**
   * Formatea la fecha/hora de recepción para la bandeja: 'HH:mm - dd-MM-yyyy'.
   * Se extraen los componentes directamente del ISO string (con su propio offset,
   * ej. '2026-07-24T04:38:00-04:00') en lugar de convertir con Date, para que la
   * hora mostrada sea siempre la de la recepción y no la del huso horario del navegador.
   */
  formatFechaTabla(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia, hora, minuto] = match;
    return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
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
        fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
        fechaHasta: this.formatFecha(this.fechaHastaControl.value),
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de recepciones',
            'Cerrar',
            {
              duration: 4000,
            },
          );
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarRegistros();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.codigoControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.reiniciarYcargar();
  }

  nombreProveedor(registro: RegistroMineral): string {
    const p = registro.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  leyesTexto(registro: RegistroMineral): string {
    if (!registro.detalles?.length) return 'Sin leyes registradas';
    return registro.detalles
      .map(
        (d) =>
          `${d.mineral?.simbolo ?? 'Mineral ' + d.idMineral} ${formatNumeroSinCeros(d.ley)}%`,
      )
      .join(' · ');
  }

  formatNumero(valor: number | string | null | undefined): string {
    return formatNumeroSinCeros(valor);
  }

  estaLiquidado(registro: RegistroMineral): boolean {
    return registro.idEstado === ESTADO_LIQUIDADO_ID;
  }

  /** EN RECEPCIÓN y REMUESTREO admiten edición libre de los datos; el resto ya no. */
  puedeEditar(registro: RegistroMineral): boolean {
    return this.ESTADOS_EDITABLES.has(registro.idEstado);
  }

  /** APROBADO, RECHAZADO A TOL, TRANZADO y REMUESTREO ya tienen PDF para imprimir. */
  puedeImprimir(registro: RegistroMineral): boolean {
    return this.ESTADOS_CON_IMPRESION.has(registro.idEstado);
  }

  /** APROBADO, RECHAZADO A TOL y REMUESTREO ya pueden pasar a valorización. */
  puedeValorizar(registro: RegistroMineral): boolean {
    return this.ESTADOS_VALORIZABLES.has(registro.idEstado);
  }

  /** true mientras se está creando el borrador de valorización para este registro (evita doble clic). */
  valorizando(registro: RegistroMineral): boolean {
    return this.procesandoValorizacion().has(registro.id);
  }

  /**
   * Crea el borrador de valorización a partir de esta recepción y navega al
   * formulario de valorización. Una recepción solo puede tener una
   * valorización: si el backend responde que ya existe, se informa por
   * snackbar sin navegar.
   */
  valorizar(registro: RegistroMineral): void {
    if (!this.puedeGestionar || this.valorizando(registro)) return;

    this.procesandoValorizacion.update((set) => new Set(set).add(registro.id));

    this.valorizacionMineralService.crearBorrador(registro.id).subscribe({
      next: (valorizacion) => {
        this.procesandoValorizacion.update((set) => {
          const nuevo = new Set(set);
          nuevo.delete(registro.id);
          return nuevo;
        });
        this.snackBar.open('Borrador de valorización creado', 'Cerrar', {
          duration: 3000,
        });
        this.router.navigate(
          ['/ui-components/valorizacion/editar', valorizacion.id],
          { state: { valorizacion } },
        );
      },
      error: (err) => {
        this.procesandoValorizacion.update((set) => {
          const nuevo = new Set(set);
          nuevo.delete(registro.id);
          return nuevo;
        });
        const mensaje =
          err?.error?.message ??
          'No se pudo crear la valorización para esta recepción';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
      },
    });
  }

  /** Estados a los que se puede pasar desde el estado actual del registro. */
  transicionesDisponibles(registro: RegistroMineral): typeof ESTADOS_OPERACION {
    const idsValidos = this.TRANSICIONES_VALIDAS[registro.idEstado] ?? [];
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
      case 4:
        return 'estado-chip--cancelado'; // CANCELADO
      case 5:
        return 'estado-chip--tranzado'; // TRANZADO
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
    this.dialog.open(VerRecepcionDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: {
        registro,
        puedeImprimir: this.puedeImprimir(registro),
        autoImprimir: false,
      },
    });
  }

  /** Abre el visualizador y dispara la impresión (el usuario podrá "Guardar como PDF"). */
  imprimir(registro: RegistroMineral): void {
    this.dialog.open(VerRecepcionDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: {
        registro,
        puedeImprimir: this.puedeImprimir(registro),
        autoImprimir: true,
      },
    });
  }

  imprimir2(id: number) {
    console.log('este es el id ', id);
    this.registroMineralService.descargarPdf(id);
  }

  cambiarEstado(registro: RegistroMineral, nuevoEstadoId: number): void {
    const idsValidos = this.TRANSICIONES_VALIDAS[registro.idEstado] ?? [];
    if (!this.puedeGestionar || !idsValidos.includes(nuevoEstadoId)) return;

    this.registroMineralService
      .cambiarEstado(registro.id, nuevoEstadoId)
      .subscribe({
        next: (actualizado) => {
          this.registros.update((lista) =>
            lista.map((r) => (r.id === registro.id ? actualizado : r)),
          );
          this.snackBar.open('Estado actualizado correctamente', 'Cerrar', {
            duration: 3000,
          });
        },
        error: () => {
          this.snackBar.open('No se pudo cambiar el estado', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }
}
