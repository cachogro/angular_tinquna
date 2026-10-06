import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { RangoFechasComponent } from 'src/app/shared/components/rango-fechas/rango-fechas.component';
import { irAGestionKardex } from '../contabilidad/kardex/kardex-gestion/kardex-gestion.component';
import { formatFechaIso } from '../contabilidad/components/personal-interno.util';
import { nombreCategoriaDestinoGasto } from '../configurations/parametricas/models/parametricas.models';
import {
  AlertaDashboard,
  Deudor,
  IngresoEgreso,
  ResumenDashboard,
  ResumenFlujoDinero,
} from './models/dashboard.models';
import { DashboardService } from './services/dashboard.service';

// Paleta categórica validada (--serie-1..6 en el .scss, claro y oscuro): el
// color sigue a la codificación, nunca a su posición en el ranking.
const TOTAL_COLORES_SERIE = 6;
// Orden fijo: las codificaciones conocidas siempre con el mismo color.
const ORDEN_CODIFICACION = ['ICC', 'BCL', 'BZL', 'RAM', 'AC'];

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const TIPO_KARDEX: Record<string, string> = {
  ACTOR: 'Actor',
  ASOCIADO: 'Asociado',
  PERSONAL: 'Personal',
  CLIENTE: 'Cliente',
};

// Categorías de destino de gasto que suman o restan en la ganancia estimada.
const CATEGORIAS_EN_GANANCIA = ['GASTO_OPERATIVO', 'SUELDOS', 'OTRO_INGRESO'];

interface FilaFlujo {
  etiqueta: string;
  simbolo: string;
  ingreso: number;
  egreso: number;
  neto: number;
}

interface Variacion {
  texto: string;
  sube: boolean | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RangoFechasComponent,
  ],
  providers: [DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly decimal = inject(DecimalPipe);
  private readonly destroyRef = inject(DestroyRef);

  readonly hoy = new Date();
  readonly fechaDesdeControl = new FormControl<Date | null>(
    new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1),
  );
  readonly fechaHastaControl = new FormControl<Date | null>(new Date(this.hoy));

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly datos = signal<ResumenDashboard | null>(null);
  readonly verTablaIngreso = signal(false);

  // ---- Flujo de dinero (caja + bancos) y ganancia estimada ----
  // Va en su propio llamado: si falla, el resto del inicio se sigue viendo.
  readonly flujo = signal<ResumenFlujoDinero | null>(null);
  readonly errorFlujo = signal(false);
  /** Qué muestra el cuadro de efectivo/bancos: el día de hoy o todo el período. */
  readonly vistaFlujo = signal<'hoy' | 'periodo'>('hoy');
  readonly flujoVista = computed(() => {
    const f = this.flujo();
    if (!f) return null;
    return this.vistaFlujo() === 'hoy' ? f.hoyFlujo : f.totales;
  });
  /** Renglones del cuadro: los de $us solo aparecen si tuvieron movimiento. */
  readonly filasFlujo = computed<FilaFlujo[]>(() => {
    const f = this.flujoVista();
    if (!f) return [];
    const fila = (etiqueta: string, simbolo: string, v: IngresoEgreso): FilaFlujo => ({
      etiqueta,
      simbolo,
      ingreso: v.ingreso,
      egreso: v.egreso,
      neto: v.ingreso - v.egreso,
    });
    const hubo = (v: IngresoEgreso) => v.ingreso !== 0 || v.egreso !== 0;
    return [
      fila('Efectivo', 'Bs', f.efectivoBs),
      ...(hubo(f.efectivoUsd) ? [fila('Efectivo', '$us', f.efectivoUsd)] : []),
      fila('Bancos (todas las cuentas)', 'Bs', f.bancosBs),
      ...(hubo(f.bancosUsd) ? [fila('Bancos (todas las cuentas)', '$us', f.bancosUsd)] : []),
    ];
  });
  /** Categorías que no entran en la ganancia, con lo que movieron en el período. */
  readonly fueraDeGanancia = computed(() =>
    (this.flujo()?.categorias ?? [])
      .filter(
        (c) =>
          !CATEGORIAS_EN_GANANCIA.includes(c.categoria) &&
          c.categoria !== 'SIN_DESTINO' &&
          (c.ingresoBs !== 0 || c.egresoBs !== 0),
      )
      .map((c) => ({ ...c, nombre: nombreCategoriaDestinoGasto(c.categoria) })),
  );

  readonly tipoKardex = TIPO_KARDEX;

  // ---- Indicadores derivados ----
  readonly liquidezTotalBs = computed(() => {
    const l = this.datos()?.indicadores.liquidez;
    return l ? l.cajaBs + l.bancosBs : 0;
  });
  readonly liquidezTotalUsd = computed(() => {
    const l = this.datos()?.indicadores.liquidez;
    return l ? l.cajaUsd + l.bancosUsd : 0;
  });
  readonly alertasAltas = computed(() => (this.datos()?.alertas ?? []).filter((a) => a.nivel === 'alta').length);

  // ---- Gráfico de ingreso mensual (barras apiladas por codificación) ----
  readonly series = computed(() => {
    const ingreso = this.datos()?.ingresoMensual;
    if (!ingreso) return [];
    return [...ingreso.series]
      .sort((a, b) => this.ordenCodigo(a.codigo) - this.ordenCodigo(b.codigo) || a.codigo.localeCompare(b.codigo))
      .map((s) => ({ ...s, total: s.kg.reduce((t, v) => t + v, 0), slot: this.slotColor(s.codigo) }));
  });

  readonly columnas = computed(() => {
    const ingreso = this.datos()?.ingresoMensual;
    if (!ingreso) return [];
    const series = this.series();
    const totales = ingreso.meses.map((_, i) => series.reduce((t, s) => t + s.kg[i], 0));
    const maximo = Math.max(...totales, 0);
    return ingreso.meses.map((mes, i) => ({
      mes,
      etiqueta: this.mesCorto(mes),
      total: totales[i],
      altura: maximo > 0 ? (totales[i] / maximo) * 100 : 0,
      segmentos: series
        .filter((s) => s.kg[i] > 0)
        .map((s) => ({ codigo: s.codigo, kg: s.kg[i], slot: s.slot, porcentaje: (s.kg[i] / totales[i]) * 100 })),
      tooltip: this.tooltipMes(mes, totales[i], series.map((s) => ({ codigo: s.codigo, kg: s.kg[i] }))),
    }));
  });
  readonly hayIngreso = computed(() => this.columnas().some((c) => c.total > 0));

  // ---- Barras de los rankings (proporcional al primero) ----
  readonly maxKgProveedor = computed(() => Math.max(...(this.datos()?.topProveedores ?? []).map((p) => p.kg), 0));
  readonly maxMontoCliente = computed(() =>
    Math.max(...(this.datos()?.topClientes ?? []).map((c) => this.montoCliente(c)), 0),
  );

  ngOnInit(): void {
    this.cargar();
    this.fechaHastaControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar());
  }

  cargar(): void {
    const desde = this.fechaDesdeControl.value;
    const hasta = this.fechaHastaControl.value;
    if (!desde || !hasta || desde > hasta) return;

    this.cargando.set(true);
    this.error.set(null);
    this.dashboardService
      .resumen(formatFechaIso(desde), formatFechaIso(hasta))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.datos.set(d);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el resumen. Intenta de nuevo.');
          this.cargando.set(false);
        },
      });

    this.errorFlujo.set(false);
    this.dashboardService
      .flujoDinero(formatFechaIso(desde), formatFechaIso(hasta))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => this.flujo.set(f),
        error: () => this.errorFlujo.set(true),
      });
  }

  nombreCategoria(categoria: string): string {
    return nombreCategoriaDestinoGasto(categoria);
  }

  /** Monto con su símbolo (Bs o $us), para el cuadro de efectivo y bancos. */
  monto(simbolo: string, valor: number): string {
    return `${simbolo} ${this.decimal.transform(valor, '1.2-2')}`;
  }

  // ---- Formato ----

  bs(valor: number | null | undefined): string {
    return `Bs ${this.decimal.transform(valor ?? 0, '1.2-2')}`;
  }

  usd(valor: number | null | undefined): string {
    return `$us ${this.decimal.transform(valor ?? 0, '1.2-2')}`;
  }

  kg(valor: number | null | undefined): string {
    return `${this.decimal.transform(valor ?? 0, '1.0-2')} kg`;
  }

  /** Montos grandes compactos para los números héroe: 305.6 mil. */
  compacto(valor: number): string {
    const abs = Math.abs(valor);
    if (abs >= 1_000_000) return `${this.decimal.transform(valor / 1_000_000, '1.1-2')} M`;
    if (abs >= 10_000) return `${this.decimal.transform(valor / 1_000, '1.1-1')} mil`;
    return this.decimal.transform(valor, '1.0-2') ?? '0';
  }

  fecha(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }

  variacion(actual: number, anterior: number): Variacion {
    if (!anterior) {
      return actual ? { texto: 'sin datos del período anterior', sube: null } : { texto: 'sin movimiento', sube: null };
    }
    const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
    const signo = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
    return {
      texto: `${signo} ${this.decimal.transform(Math.abs(pct), '1.0-1')}% vs período anterior`,
      sube: pct === 0 ? null : pct > 0,
    };
  }

  /** "1 lote" / "3 lotes"; el plural por defecto agrega "s". */
  plural(n: number, singular: string, plural = `${singular}s`): string {
    return `${this.decimal.transform(n, '1.0-0')} ${n === 1 ? singular : plural}`;
  }

  montoCliente(c:{ montoVentaBs: number; invertidoBs: number }): number {
    return c.montoVentaBs || c.invertidoBs;
  }

  colorSerie(slot: number): string {
    return `var(--serie-${slot})`;
  }

  // ---- Acciones ----

  abrirKardex(d: Deudor): void {
    irAGestionKardex(this.router, {
      tipo: d.tipo,
      idPersona: d.idPersona ?? undefined,
      idActorProductivoMinero: d.idActorProductivoMinero ?? undefined,
      idCliente: d.idCliente ?? undefined,
      nombreDestinatario: d.nombre,
    });
  }

  iconoAlerta(a: AlertaDashboard): string {
    return a.nivel === 'alta' ? 'error' : a.nivel === 'media' ? 'warning' : 'info';
  }

  temaModulo(modulo: AlertaDashboard['modulo']): string {
    return modulo === 'comercio' ? 'tema-comercio' : modulo === 'contabilidad' ? 'tema-contabilidad' : 'tema-configuracion';
  }

  // ---- Internos ----

  private ordenCodigo(codigo: string): number {
    const i = ORDEN_CODIFICACION.indexOf(codigo.toUpperCase());
    return i === -1 ? ORDEN_CODIFICACION.length : i;
  }

  /** Slot 1..6 estable por codificación; las no conocidas toman los libres. */
  private slotColor(codigo: string): number {
    const i = ORDEN_CODIFICACION.indexOf(codigo.toUpperCase());
    if (i !== -1) return i + 1;
    const extra = [...codigo].reduce((t, c) => t + c.charCodeAt(0), 0) % (TOTAL_COLORES_SERIE - ORDEN_CODIFICACION.length);
    return ORDEN_CODIFICACION.length + 1 + extra;
  }

  private mesCorto(mes: string): string {
    const [a, m] = mes.split('-').map(Number);
    return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
  }

  private tooltipMes(mes: string, total: number, valores: { codigo: string; kg: number }[]): string {
    const [a, m] = mes.split('-').map(Number);
    const lineas = valores.filter((v) => v.kg > 0).map((v) => `${v.codigo}: ${this.kg(v.kg)}`);
    return [`${MESES_CORTOS[m - 1]} ${a} · ${this.kg(total)}`, ...lineas].join('\n');
  }
}
