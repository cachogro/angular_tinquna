// src/app/pages/contabilidad/reportes/reporte-destino-gasto.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import {
  Caja,
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import {
  DetalleDestinoGasto,
  FilaDestinoGasto,
  FiltroReporteDestinoGasto,
  ResumenDestinosGasto,
} from '../models/reporte-destino-gasto.models';
import { ReporteDestinoGastoService } from '../services/reporte-destino-gasto.service';
import { RangoFechasComponent } from '../../../shared/components/rango-fechas/rango-fechas.component';

@Component({
  selector: 'app-reporte-destino-gasto',
  standalone: true,
  imports: [
    RangoFechasComponent,
    CommonModule,
    FormsModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reporte-destino-gasto.component.html',
  styleUrl: './reporte-destino-gasto.component.scss',
})
export class ReporteDestinoGastoComponent implements OnInit {
  private readonly reporteService = inject(ReporteDestinoGastoService);
  private readonly parametricasService = inject(ParametricasService);

  readonly columnasResumen = [
    'destino',
    'movimientos',
    'ingreso',
    'egreso',
    'neto',
    'acciones',
  ];
  readonly columnasDetalle = [
    'fecha',
    'caja',
    'concepto',
    'entregaFondosA',
    'facturaRecibo',
    'formaPago',
    'ingreso',
    'egreso',
  ];

  readonly cajas = signal<Caja[]>([]);
  readonly cajasActivas = computed(() =>
    this.cajas().filter((c) => c.activo !== false),
  );

  readonly monedaSel = signal<MonedaCuenta>('BS');
  /** null = todas las cajas (no se envía idCaja). */
  readonly cajaSelId = signal<number | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(
    new Date(new Date().getFullYear(), 0, 1),
  );
  readonly fechaHastaControl = new FormControl<Date | null>(new Date());

  readonly cargando = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly error = signal<string | null>(null);
  readonly resumen = signal<ResumenDestinosGasto | null>(null);
  readonly detalle = signal<DetalleDestinoGasto | null>(null);
  readonly destinoDetalleId = signal<number | null>(null);

  ngOnInit(): void {
    this.parametricasService.obtenerCajas().subscribe({
      next: (cajas) => this.cajas.set(cajas),
      // El selector de caja es opcional: sin cajas el reporte suma todas.
      error: () => this.cajas.set([]),
    });
    this.generar();
  }

  /** Filtro vigente; el detalle se pide con el mismo. */
  private filtro(): FiltroReporteDestinoGasto {
    return {
      moneda: this.monedaSel(),
      idCaja: this.cajaSelId() ?? undefined,
      fechaDesde: this.dateAIso(this.fechaDesdeControl.value) || undefined,
      fechaHasta: this.dateAIso(this.fechaHastaControl.value) || undefined,
    };
  }

  generar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.detalle.set(null);
    this.destinoDetalleId.set(null);
    this.reporteService.resumen(this.filtro()).subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.cargando.set(false);
      },
      error: (err) => {
        this.resumen.set(null);
        this.cargando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  verDetalle(fila: FilaDestinoGasto): void {
    if (fila.idDestinoGasto === null) return;
    this.error.set(null);
    this.cargandoDetalle.set(true);
    this.destinoDetalleId.set(fila.idDestinoGasto);
    this.reporteService.detalle(fila.idDestinoGasto, this.filtro()).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
      },
      error: (err) => {
        this.detalle.set(null);
        this.destinoDetalleId.set(null);
        this.cargandoDetalle.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
    this.destinoDetalleId.set(null);
  }

  /** El back devuelve `message` como arreglo cuando falla la validación. */
  private mensajeError(err: any): string {
    const m = err?.error?.message;
    if (Array.isArray(m)) return m.join(', ');
    return m ?? 'No se pudo generar el reporte';
  }

  /** El datepicker trabaja con Date; el back espera ISO (yyyy-mm-dd). */
  private dateAIso(d: Date | null): string {
    if (!d) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }
}
