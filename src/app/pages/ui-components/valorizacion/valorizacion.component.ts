import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import { debounceTime, distinctUntilChanged } from 'rxjs';
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
  ESTADO_VALORIZACION_VALORIZADO_ID,
  EntidadAporte,
  FiltrosValorizacionMineral,
  OrdenDireccionValorizacion,
  ValorizacionMineral,
} from '../models/valorizacion-mineral.models';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

interface OpcionOrden {
  value: string;
  label: string;
}

@Component({
  selector: 'app-valorizacion',
  imports: [
    CommonModule,
    FormsModule,
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
    MatDatepickerModule,
    MatNativeDateModule,
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
  readonly ESTADO_VALORIZACION_BORRADOR_ID = ESTADO_VALORIZACION_BORRADOR_ID;
  readonly ESTADO_VALORIZACION_VALORIZADO_ID = ESTADO_VALORIZACION_VALORIZADO_ID;

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

  /** Solo ADMINISTRADOR y OPERADOR tienen acceso al módulo de valorización. */
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
    this.orderByControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.parametricasService
      .obtenerMinerales()
      .subscribe((data) => this.mineralesCatalogo.set(data));
    this.parametricasService
      .obtenerAllEntidadesAporte()
      .subscribe((data: EntidadAporte[]) => this.entidadesAporte.set(data));

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

  /** Igual que en recepción: extrae hora/fecha directo del ISO string para no
   *  depender del huso horario del navegador. */
  formatFechaTabla(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia, hora, minuto] = match;
    return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
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
        fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
        fechaHasta: this.formatFecha(this.fechaHastaControl.value),
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
          this.snackBar.open(
            'No se pudo cargar el listado de valorizaciones',
            'Cerrar',
            { duration: 4000 },
          );
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
    const p = v.recepcionMineral?.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  detalleTexto(v: ValorizacionMineral): string {
    const r = v.recepcionMineral;
    if (!r) return '—';
    return `${r.codificacion?.codigo ?? '—'} · ${formatNumeroConMiles(r.numeroSacos ?? 0)} sacos · ${formatNumeroConMiles(r.balanzaL)} kg`;
  }

  /** En BORRADOR y PRE-VALORIZADO se puede seguir editando; VALORIZADO queda cerrado. */
  puedeEditar(v: ValorizacionMineral): boolean {
    return v.idEstadoValorizacion !== ESTADO_VALORIZACION_VALORIZADO_ID;
  }

  /** Visualizar/Imprimir solo tienen sentido una vez que ya se guardó algo
   *  más allá del borrador (PRE-VALORIZADO o VALORIZADO). */
  puedeVerImprimir(v: ValorizacionMineral): boolean {
    return v.idEstadoValorizacion !== ESTADO_VALORIZACION_BORRADOR_ID;
  }

  /** La marca "Entregado" solo tiene sentido una vez pre-valorizada o
   *  valorizada (en BORRADOR el material sigue en el ingenio). */
  puedeMarcarEntregado(v: ValorizacionMineral): boolean {
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
            this.snackBar.open(
              nuevoValor
                ? 'Valorización marcada como entregada'
                : 'Se quitó la marca de entregada',
              'Cerrar',
              { duration: 3000 },
            );
          },
          error: () => {
            this.snackBar.open(
              'No se pudo actualizar la marca de entrega',
              'Cerrar',
              { duration: 4000 },
            );
          },
        });
    });
  }

  /** Abre la vista previa (formato de ticket) de una valorización ya
   *  guardada, a partir de los datos persistidos en el backend (a diferencia
   *  del visualizador del formulario, que arma los datos desde el form en
   *  edición). */
  visualizar(v: ValorizacionMineral): void {
    const leyesYPrecios: LeyPrecioVisualizacion[] = (v.detalles ?? []).map(
      (d) => {
        const idMineral = Number(d['idMineral']);
        const mineral = this.mineralesCatalogo().find(
          (m) => Number(m.id) === idMineral,
        );
        return {
          simbolo:
            mineral?.simbolo ?? mineral?.descripcion ?? `Mineral #${idMineral}`,
          ley: (d['ley'] as number | string | null) ?? null,
          leyUnidad: (d['leyUnidad'] as string) ?? '%',
          precioPorKilo: Number(d['precioKilo'] ?? 0),
        };
      },
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

    const data: VerValorizacionDialogData = {
      numero: v.id,
      producto: this.productosTexto(v),
      cliente: this.nombreProveedor(v),
      numeroDocumento: v.recepcionMineral?.persona?.numeroDocumento ?? '—',
      lote: v.recepcionMineral?.codigoOperacion ?? '—',
      fechaEntrega: this.formatFechaSolo(v.recepcionMineral?.fechaRecepcion),
      fechaTransaccion: this.formatFechaTabla(v.fechaValorizacion),
      cooperativa:
        v.recepcionMineral?.persona?.actorProductivoMinero?.nombre ?? '—',
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
      telefonoCliente: v.recepcionMineral?.persona?.celular,
    };

    this.dialog.open(VerValorizacionDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
      data,
    });
  }

  /** Pide al backend el PDF ya generado (con el liquidador resuelto del
   *  usuario autenticado) y lo abre en una pestaña nueva. */
  imprimir(v: ValorizacionMineral): void {
    this.valorizacionMineralService.descargarPdf(v.id);
  }

  private productosTexto(v: ValorizacionMineral): string {
    const minerales = v.recepcionMineral?.codificacion?.minerales ?? [];
    return minerales.map((m) => m.descripcion).join(', ') || '—';
  }

  /** Igual que formatFechaTabla, pero sin hora: se usa para la fecha de
   *  entrega en el visualizador. */
  private formatFechaSolo(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia] = match;
    return `${dia}-${mes}-${anio}`;
  }

  claseEstado(idEstadoValorizacion: number): string {
    switch (idEstadoValorizacion) {
      case ESTADO_VALORIZACION_BORRADOR_ID:
        return 'estado-chip--pendiente'; // BORRADOR
      case 2:
        return 'estado-chip--proceso'; // PRE-VALORIZADO
      case 3:
        return 'estado-chip--aprobado'; // VALORIZADO
      default:
        return '';
    }
  }
}
