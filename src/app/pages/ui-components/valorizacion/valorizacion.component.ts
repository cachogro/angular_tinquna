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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';
import { abrirBlobEnPestana } from 'src/app/shared/utils/descarga-archivo.util';
import {
  fechaDeIso,
  horaFechaDeIso,
} from 'src/app/shared/utils/fecha-bolivia.util';
import { formatNumeroConMiles } from 'src/app/shared/utils/numero.util';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { Mineral } from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import {
  DescuentoVisualizacion,
  LeyPrecioVisualizacion,
  VerValorizacionDialogComponent,
  VerValorizacionDialogData,
} from './valorizacion-form/ver-valorizacion-dialog/ver-valorizacion-dialog.component';
import {
  ESTADOS_VALORIZACION,
  ESTADO_VALORIZACION_BORRADOR_ID,
  ESTADO_VALORIZACION_PREVALORIZADO_ID,
  ESTADO_VALORIZACION_VALORIZADO_ID,
  EntidadAporte,
  FiltrosValorizacionMineral,
  OrdenDireccionValorizacion,
  ValorizacionMineral,
  codificacionEfectiva,
} from '../models/valorizacion-mineral.models';
import {
  actorProveedorRecepcion,
  detalleProveedorRecepcion,
  leyesTextoRecepcion,
  nombreProveedorRecepcion,
} from '../models/registro-mineral.models';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';
import { ReciboService } from '../../contabilidad/services/recibo.service';
import { formatFechaIso } from '../../contabilidad/components/personal-interno.util';
import {
  abrirPagoValorizacion,
  faltaPagoValorizacion,
} from './pago-valorizacion.util';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { RangoFechasComponent } from '../../../shared/components/rango-fechas/rango-fechas.component';

interface OpcionOrden {
  value: string;
  label: string;
}

@Component({
  selector: 'app-valorizacion',
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
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './valorizacion.component.html',
  styleUrl: './valorizacion.component.scss',
})
export class ValorizacionComponent implements OnInit {
  private readonly valorizacionMineralService = inject(
    ValorizacionMineralService,
  );
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly reciboService = inject(ReciboService);

  /** Catálogos usados solo para resolver nombres al armar el visualizador
   *  (ver visualizar()): símbolo del mineral y descripción de la entidad de aporte. */
  private readonly mineralesCatalogo = signal<Mineral[]>([]);
  private readonly entidadesAporte = signal<EntidadAporte[]>([]);

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
  readonly estados = ESTADOS_VALORIZACION;

  readonly registros = signal<ValorizacionMineral[]>([]);
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
    { value: 'fechaValorizacion', label: 'Fecha de valorización' },
    { value: 'numeroDocumento', label: 'N° de documento' },
    { value: 'estado', label: 'Estado' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl =
    new FormControl<OrdenDireccionValorizacion>('DESC');

  /** Igual que en recepción: hora/fecha directo del ISO string, sin depender
   *  del huso horario del navegador. */
  readonly formatFechaTabla = horaFechaDeIso;

  /** Solo ADMINISTRADOR y OPERADOR tienen acceso al módulo de valorización. */
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

    this.parametricasService
      .obtenerMinerales()
      .subscribe((data) => this.mineralesCatalogo.set(data));
    this.parametricasService
      .obtenerAllEntidadesAporte()
      .subscribe((data: EntidadAporte[]) => this.entidadesAporte.set(data));

    this.cargarRegistros();
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

    this.valorizacionMineralService
      .listarValorizaciones({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value || undefined,
        codigoOperacion: this.codigoControl.value || undefined,
        numeroDocumento: this.documentoControl.value || undefined,
        idEstadoValorizacion: this.estadoControl.value ?? undefined,
        fechaDesde: this.fechaFiltro(this.fechaDesdeControl.value),
        fechaHasta: this.fechaFiltro(this.fechaHastaControl.value),
        orderBy: (this.orderByControl.value as FiltrosValorizacionMineral['orderBy']) ?? undefined,
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
          this.avisar('No se pudo cargar el listado de valorizaciones');
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

  nombreProveedor(v: ValorizacionMineral): string {
    return nombreProveedorRecepcion(v.recepcionMineral);
  }

  detalleProveedor(v: ValorizacionMineral): string {
    return detalleProveedorRecepcion(v.recepcionMineral);
  }

  detalleTexto(v: ValorizacionMineral): string {
    const r = v.recepcionMineral;
    if (!r) return '—';
    const leyes = this.leyesTexto(v);
    return `${leyes ? leyes + ' · ' : ''}${formatNumeroConMiles(r.balanzaL)} kg`;
  }

  private simboloMineral(idMineral: number): string {
    const mineral = this.mineralesCatalogo().find(
      (m) => Number(m.id) === idMineral,
    );
    return mineral?.simbolo ?? mineral?.descripcion ?? `Mineral #${idMineral}`;
  }

  /** Leyes de la valorización (las laboratoriadas); si aún no tiene, las de la recepción. */
  private leyesTexto(v: ValorizacionMineral): string {
    const propias = (v.detalles ?? []).filter((d) => d['ley'] != null);
    if (!propias.length) return leyesTextoRecepcion(v.recepcionMineral);
    return propias
      .map((d) => {
        const unidad = (d['leyUnidad'] as string) ?? '%';
        return `${this.simboloMineral(Number(d['idMineral']))} ${formatNumeroConMiles(d['ley'] as number | string)}${unidad}`;
      })
      .join(' · ');
  }

  /** En BORRADOR y PRE-VALORIZADO se puede seguir editando; VALORIZADO queda cerrado. */
  puedeEditar(v: ValorizacionMineral): boolean {
    return v.idEstadoValorizacion !== ESTADO_VALORIZACION_VALORIZADO_ID;
  }

  /** Visualizar, imprimir y la marca "Entregado" solo tienen sentido una vez
   *  que ya se guardó algo más allá del borrador (PRE-VALORIZADO o
   *  VALORIZADO): en BORRADOR el material sigue en el ingenio. */
  pasoDeBorrador(v: ValorizacionMineral): boolean {
    return v.idEstadoValorizacion !== ESTADO_VALORIZACION_BORRADOR_ID;
  }

  /** Marca / desmarca la valorización como entregada, previa confirmación. */
  toggleEntregado(v: ValorizacionMineral): void {
    const nuevoValor = !v.entregado;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: nuevoValor
          ? '¿Marcar como entregada?'
          : '¿Quitar la marca de entregada?',
        message: nuevoValor
          ? 'Se registrará que el material salió del ingenio. ¿Confirmás marcar esta valorización como entregada?'
          : 'Se revertirá la marca y se borrará la fecha de entrega. ¿Deseás continuar?',
        confirmLabel: nuevoValor ? 'Sí, marcar entregada' : 'Sí, quitar marca',
        cancelLabel: 'Cancelar',
        icon: 'local_shipping',
      },
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.valorizacionMineralService
        .marcarEntregado(v.id, nuevoValor)
        .subscribe({
          next: (actualizada) => {
            this.registros.update((lista) =>
              lista.map((item) =>
                item.id === v.id
                  ? {
                      ...item,
                      entregado: actualizada.entregado,
                      fechaEntregado: actualizada.fechaEntregado,
                    }
                  : item,
              ),
            );
            this.avisar(
              nuevoValor
                ? 'Valorización marcada como entregada'
                : 'Se quitó la marca de entregada',
              3000,
            );
          },
          error: (err) =>
            this.avisar(
              err?.error?.message ?? 'No se pudo actualizar la marca de entrega',
            ),
        });
    });
  }

  /** Abre la vista previa (formato de ticket) de una valorización ya
   *  guardada, a partir de los datos persistidos en el backend (a diferencia
   *  del visualizador del formulario, que arma los datos desde el form en
   *  edición). */
  visualizar(v: ValorizacionMineral): void {
    const leyesYPrecios: LeyPrecioVisualizacion[] = (v.detalles ?? []).map(
      (d) => ({
        simbolo: this.simboloMineral(Number(d['idMineral'])),
        ley: (d['ley'] as number | string | null) ?? null,
        leyUnidad: (d['leyUnidad'] as string) ?? '%',
        precioPorKilo: Number(d['precioKilo'] ?? 0),
      }),
    );

    const descuentos: DescuentoVisualizacion[] = (v.calculoAportes ?? [])
      .filter((a) => a['idEntidadAporte'] != null)
      .map((a) => {
        const idEntidad = Number(a['idEntidadAporte']);
        const entidad = this.entidadesAporte().find(
          (e) => Number(e.id) === idEntidad,
        );
        return {
          entidad: entidad?.descripcion ?? `Entidad #${idEntidad}`,
          porcentaje: Number(a['porcentajeAporte'] ?? 0),
          importe: Number(a['importeBolivianos'] ?? 0),
        };
      });

    const recepcion = v.recepcionMineral;
    const data: VerValorizacionDialogData = {
      numero: v.id,
      producto:
        (codificacionEfectiva(v)?.minerales ?? [])
          .map((m) => m.descripcion)
          .join(', ') || '—',
      cliente: this.nombreProveedor(v),
      numeroDocumento: recepcion?.persona?.numeroDocumento ?? '—',
      lote: recepcion?.codigoOperacion ?? '—',
      fechaEntrega: fechaDeIso(recepcion?.fechaRecepcion),
      // fechaValorizacion es una fecha sin hora ('YYYY-MM-DD').
      fechaTransaccion: fechaDeIso(v.fechaValorizacion),
      cooperativa: actorProveedorRecepcion(recepcion),
      pesoBruto: Number(v.pesoBrutoHumedoKilogramos ?? 0),
      pesoNeto: Number(v.pesoNetoSecoKilogramos ?? 0),
      leyesYPrecios,
      totalValorBrutoBolivianos: Number(v.totalValorBrutoBolivianos ?? 0),
      anticipo: Number(v.anticipo ?? 0),
      otrosAnticipo: Number(v.otrosAnticipo ?? 0),
      transporte: Number(v.ajusteTransporte ?? 0),
      totalValorLiquidoVentaBolivianos: Number(v.totalValorLiquidoVentaBolivianos ?? 0),
      descuentos,
      descuentoTotal: Number(v.totalAportesBolivianos ?? 0),
      telefonoCliente: recepcion?.persona?.celular,
    };

    this.dialog.open(VerValorizacionDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
      data,
    });
  }

  /** VALORIZADO y todavía sin pago registrado. */
  puedeRegistrarPago(v: ValorizacionMineral): boolean {
    return faltaPagoValorizacion(v);
  }

  /** Registra el pago (sin recibo) o, si ya existe, lo muestra y permite anularlo. */
  abrirPago(v: ValorizacionMineral): void {
    abrirPagoValorizacion(this.dialog, v).subscribe((cambio) => {
      if (cambio) this.cargarRegistros();
    });
  }

  verPdfRecibo(v: ValorizacionMineral): void {
    const recibo = v.recibos?.[0];
    if (!recibo) return;
    this.reciboService.obtenerPdf(recibo.id).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.avisar(
          err?.error?.message ?? 'No se pudo generar el PDF del recibo',
        ),
    });
  }

  /** Pide al backend el PDF ya generado (con el liquidador resuelto del
   *  usuario autenticado) y lo abre en una pestaña nueva. */
  imprimir(v: ValorizacionMineral): void {
    this.valorizacionMineralService.obtenerPdf(v.id).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.avisar(
          err?.error?.message ?? 'No se pudo generar el PDF de la valorización',
        ),
    });
  }

  claseEstado(idEstadoValorizacion: number): string {
    switch (idEstadoValorizacion) {
      case ESTADO_VALORIZACION_BORRADOR_ID:
        return 'estado-chip--pendiente';
      case ESTADO_VALORIZACION_PREVALORIZADO_ID:
        return 'estado-chip--proceso';
      case ESTADO_VALORIZACION_VALORIZADO_ID:
        return 'estado-chip--aprobado';
      default:
        return '';
    }
  }
}
