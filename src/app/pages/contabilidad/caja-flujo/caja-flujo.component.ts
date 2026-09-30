// src/app/pages/contabilidad/caja-flujo/caja-flujo.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  Caja,
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import {
  CajaFlujoResponse,
  MovimientoCaja,
  PeriodoCaja,
} from '../models/movimiento-caja.models';
import { MovimientoCajaService } from '../services/movimiento-caja.service';
import {
  MovimientoCajaFormDialogComponent,
  MovimientoCajaFormDialogData,
} from './movimiento-caja-form-dialog/movimiento-caja-form-dialog.component';
import { mensajeErrorBlob } from '../../../shared/utils/descarga-archivo.util';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Component({
  selector: 'app-caja-flujo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './caja-flujo.component.html',
  styleUrl: './caja-flujo.component.scss',
})
export class CajaFlujoComponent implements OnInit {
  private readonly parametricasService = inject(ParametricasService);
  private readonly movimientoCajaService = inject(MovimientoCajaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'folio',
    'fecha',
    'nroComprobante',
    'entregaFondosA',
    'concepto',
    'destinoGasto',
    'ingreso',
    'egreso',
    'saldo',
    'acciones',
  ];

  readonly cargando = signal(false);
  readonly cargandoCajas = signal(true);
  readonly descargandoExcel = signal(false);
  readonly descargandoExcelCompleto = signal(false);

  readonly cajasCargadas = signal<Caja[]>([]);
  readonly cajaSelId = signal<number | null>(null);
  readonly monedaSel = signal<MonedaCuenta>('BS');

  readonly periodos = signal<PeriodoCaja[]>([]);
  readonly gestionSel = signal<number | null>(null);
  readonly mesSel = signal<number | null>(null);

  readonly resp = signal<CajaFlujoResponse | null>(null);

  // ---------- Derivados ----------

  readonly cajas = computed(() =>
    this.cajasCargadas().filter((c) => c.activo !== false),
  );

  readonly cajaSel = computed(
    () => this.cajas().find((c) => c.id === this.cajaSelId()) ?? null,
  );

  readonly saldoInicialConfigurado = computed(() => {
    const c = this.cajaSel();
    if (!c) return false;
    return this.monedaSel() === 'BS'
      ? !!c.fechaSaldoInicialBs
      : !!c.fechaSaldoInicialUsd;
  });

  readonly gestiones = computed(() => {
    const set = new Set<number>();
    for (const p of this.periodos()) set.add(p.gestion);
    return [...set].sort((a, b) => b - a);
  });

  readonly mesesDeGestion = computed(() => {
    const g = this.gestionSel();
    return this.periodos()
      .filter((p) => p.tipo === 'MENSUAL' && p.gestion === g)
      .sort((a, b) => (a.mes ?? 0) - (b.mes ?? 0));
  });

  readonly periodoMesSel = computed(() => {
    const g = this.gestionSel();
    const m = this.mesSel();
    if (g == null || m == null) return null;
    return (
      this.periodos().find(
        (p) => p.tipo === 'MENSUAL' && p.gestion === g && p.mes === m,
      ) ?? null
    );
  });

  readonly periodoGestionSel = computed(() => {
    const g = this.gestionSel();
    if (g == null) return null;
    return (
      this.periodos().find((p) => p.tipo === 'GESTION' && p.gestion === g) ??
      null
    );
  });

  /** Últimos registrados primero: se invierte y, si hay folio, se ordena
   *  descendente (el saldo de cada fila sigue siendo el de su momento). */
  readonly movimientos = computed(() => {
    const lista = [...(this.resp()?.movimientos ?? [])].reverse();
    lista.sort((a, b) => (Number(b.folio) || 0) - (Number(a.folio) || 0));
    return lista;
  });

  readonly mesesFaltantesGestion = computed(() => {
    const g = this.gestionSel();
    if (g == null) return [] as number[];
    const cerrados = new Set(
      this.periodos()
        .filter(
          (p) =>
            p.tipo === 'MENSUAL' && p.gestion === g && p.estado === 'CERRADO',
        )
        .map((p) => p.mes),
    );
    return Array.from({ length: 12 }, (_, i) => i + 1).filter(
      (m) => !cerrados.has(m),
    );
  });

  // ---------- Ciclo de vida ----------

  ngOnInit(): void {
    this.cargandoCajas.set(true);
    this.parametricasService.obtenerCajas().subscribe({
      next: (cajas) => {
        this.cajasCargadas.set(cajas);
        this.cargandoCajas.set(false);
        const activas = cajas.filter((c) => c.activo !== false);
        if (activas.length && this.cajaSelId() == null) {
          this.onCajaChange(activas[0].id);
        }
      },
      error: () => {
        this.cargandoCajas.set(false);
        this.snackBar.open('No se pudieron cargar las cajas', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  onCajaChange(id: number): void {
    this.cajaSelId.set(id);
    this.reiniciarFiltros();
  }

  onMonedaChange(moneda: MonedaCuenta): void {
    this.monedaSel.set(moneda);
    this.reiniciarFiltros();
  }

  private reiniciarFiltros(): void {
    this.gestionSel.set(null);
    this.mesSel.set(null);
    this.periodos.set([]);
    this.resp.set(null);
    if (!this.saldoInicialConfigurado()) return;
    this.cargarPeriodos(true);
    this.cargarCajaFlujo();
  }

  private cargarPeriodos(autoSeleccionarGestion = false): void {
    const id = this.cajaSelId();
    if (id == null) return;
    this.movimientoCajaService.listarPeriodos(id, this.monedaSel()).subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);
        if (autoSeleccionarGestion && periodos.length) {
          const nuevaGestion = Math.max(...periodos.map((p) => p.gestion));
          this.gestionSel.set(nuevaGestion);
          this.autoSeleccionarMes(periodos, nuevaGestion);
          this.cargarCajaFlujo();
        }
      },
      error: () => {
        this.periodos.set([]);
      },
    });
  }

  /** Al abrir la caja, deja seleccionado el mes actual si tiene período en la
   *  gestión; si no, el último mes disponible. */
  private autoSeleccionarMes(periodos: PeriodoCaja[], gestion: number): void {
    const meses = periodos
      .filter((p) => p.tipo === 'MENSUAL' && p.gestion === gestion)
      .map((p) => p.mes)
      .filter((m): m is number => m != null);
    if (!meses.length) {
      this.mesSel.set(null);
      return;
    }
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    this.mesSel.set(
      gestion === hoy.getFullYear() && meses.includes(mesActual)
        ? mesActual
        : Math.max(...meses),
    );
  }

  private cargarCajaFlujo(): void {
    const id = this.cajaSelId();
    if (id == null || !this.saldoInicialConfigurado()) {
      this.resp.set(null);
      return;
    }
    this.cargando.set(true);
    this.movimientoCajaService
      .listar({
        idCaja: id,
        moneda: this.monedaSel(),
        gestion: this.gestionSel() ?? undefined,
        mes: this.mesSel() ?? undefined,
      })
      .subscribe({
        next: (data) => {
          this.resp.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.resp.set(null);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar la caja de flujo',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  private recargar(): void {
    this.cargarPeriodos();
    this.cargarCajaFlujo();
  }

  onGestionChange(g: number | null): void {
    this.gestionSel.set(g);
    this.mesSel.set(null);
    this.cargarCajaFlujo();
  }

  onMesChange(m: number | null): void {
    this.mesSel.set(m);
    this.cargarCajaFlujo();
  }

  // ---------- Movimientos ----------

  private get fechaSugerida(): string | undefined {
    const g = this.gestionSel();
    const m = this.mesSel();
    if (g != null && m != null) {
      return `${g}-${String(m).padStart(2, '0')}-01`;
    }
    return undefined;
  }

  nuevoMovimiento(): void {
    const id = this.cajaSelId();
    if (id == null) return;
    const data: MovimientoCajaFormDialogData = {
      idCaja: id,
      moneda: this.monedaSel(),
      fechaSugerida: this.fechaSugerida,
    };
    this.dialog
      .open(MovimientoCajaFormDialogComponent, {
        data,
        width: '720px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.recargar();
      });
  }

  editarMovimiento(m: MovimientoCaja): void {
    const id = this.cajaSelId();
    if (id == null) return;
    const data: MovimientoCajaFormDialogData = {
      idCaja: id,
      moneda: this.monedaSel(),
      movimiento: m,
    };
    this.dialog
      .open(MovimientoCajaFormDialogComponent, {
        data,
        width: '720px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.recargar();
      });
  }

  desactivarMovimiento(m: MovimientoCaja): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Desactivar movimiento',
          message: `¿Confirmas desactivar el movimiento folio ${m.folio} — "${m.concepto}"? Dejará de sumar al saldo del mes.`,
          confirmLabel: 'Desactivar',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.movimientoCajaService.cambiarEstadoMovimiento(m.id, false).subscribe({
          next: () => {
            this.snackBar.open('Movimiento desactivado', 'Cerrar', {
              duration: 3000,
            });
            this.recargar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo desactivar',
              'Cerrar',
              { duration: 4000 },
            ),
        });
      });
  }

  movimientoEditable(m: MovimientoCaja): boolean {
    const estado =
      m.periodoCaja?.estado ??
      this.periodos().find((p) => String(p.id) === String(m.idPeriodoCaja))
        ?.estado;
    return estado !== 'CERRADO';
  }

  // ---------- Períodos ----------

  descargarExcel(): void {
    const id = this.cajaSelId();
    const gestion = this.gestionSel();
    const mes = this.mesSel();
    if (id == null || gestion == null || mes == null || this.descargandoExcel()) {
      return;
    }
    this.descargandoExcel.set(true);
    this.movimientoCajaService
      .descargarExcel({ idCaja: id, moneda: this.monedaSel(), gestion, mes })
      .subscribe({
        next: (blob) => {
          this.descargandoExcel.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const mesStr = String(mes).padStart(2, '0');
          a.download = `caja-flujo-${id}-${this.monedaSel()}-${gestion}-${mesStr}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: async (err) => {
          this.descargandoExcel.set(false);
          this.snackBar.open(
            (await mensajeErrorBlob(err)) ?? 'No se pudo generar el Excel de la caja',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  descargarExcelCompleto(): void {
    const id = this.cajaSelId();
    const gestion = this.gestionSel();
    const mes = this.mesSel();
    if (id == null || gestion == null || mes == null || this.descargandoExcelCompleto()) {
      return;
    }
    this.descargandoExcelCompleto.set(true);
    this.movimientoCajaService
      .descargarExcelCompleto({ idCaja: id, gestion, mes })
      .subscribe({
        next: (blob) => {
          this.descargandoExcelCompleto.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const mesStr = String(mes).padStart(2, '0');
          a.download = `caja-flujo-completa-${gestion}-${mesStr}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: async (err) => {
          this.descargandoExcelCompleto.set(false);
          this.snackBar.open(
            (await mensajeErrorBlob(err)) ?? 'No se pudo generar el Excel completo de la caja',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  cerrarMes(): void {
    const p = this.periodoMesSel();
    const id = this.cajaSelId();
    if (!p || id == null || p.mes == null) return;
    this.confirmarYaccion(
      `¿Cerrar el período ${this.etiquetaMes(p.mes)} ${p.gestion} (${this.monedaSel()})? El saldo final quedará fijo.`,
      'Cerrar mes',
      'lock',
      () =>
        this.movimientoCajaService.cerrarPeriodo({
          idCaja: id,
          moneda: this.monedaSel(),
          gestion: p.gestion,
          mes: p.mes!,
        }),
      'Período cerrado',
    );
  }

  reabrirMes(): void {
    const p = this.periodoMesSel();
    const id = this.cajaSelId();
    if (!p || id == null || p.mes == null) return;
    this.confirmarYaccion(
      `¿Reabrir el período ${this.etiquetaMes(p.mes)} ${p.gestion} (${this.monedaSel()})?`,
      'Reabrir mes',
      'lock_open',
      () =>
        this.movimientoCajaService.reabrirPeriodo({
          idCaja: id,
          moneda: this.monedaSel(),
          gestion: p.gestion,
          mes: p.mes!,
        }),
      'Período reabierto',
    );
  }

  cerrarGestion(): void {
    const g = this.gestionSel();
    const id = this.cajaSelId();
    if (g == null || id == null) return;
    this.confirmarYaccion(
      `¿Cerrar la gestión ${g} (${this.monedaSel()})? Requiere los 12 meses cerrados.`,
      'Cerrar gestión',
      'lock',
      () =>
        this.movimientoCajaService.cerrarGestion({
          idCaja: id,
          moneda: this.monedaSel(),
          gestion: g,
        }),
      'Gestión cerrada',
    );
  }

  reabrirGestion(): void {
    const g = this.gestionSel();
    const id = this.cajaSelId();
    if (g == null || id == null) return;
    this.confirmarYaccion(
      `¿Reabrir la gestión ${g} (${this.monedaSel()})?`,
      'Reabrir gestión',
      'lock_open',
      () =>
        this.movimientoCajaService.reabrirGestion({
          idCaja: id,
          moneda: this.monedaSel(),
          gestion: g,
        }),
      'Gestión reabierta',
    );
  }

  private confirmarYaccion(
    message: string,
    title: string,
    icon: string,
    accion: () => Observable<unknown>,
    okMsg: string,
  ): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title,
          message,
          confirmLabel: title,
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon,
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        accion().subscribe({
          next: () => {
            this.snackBar.open(okMsg, 'Cerrar', { duration: 3000 });
            this.recargar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo completar la operación',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  // ---------- Helpers de vista ----------

  etiquetaMes(m: number | null | undefined): string {
    return m == null ? '—' : (MESES[m - 1] ?? String(m));
  }

  etiquetaCaja(c: Caja): string {
    return c.nombre;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  num(v: string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** El destino del gasto puede venir como objeto del catálogo (movimiento de
   *  recibo) o como texto libre (carga manual). */
  destinoGastoLabel(m: MovimientoCaja): string {
    const d = m.destinoGasto;
    if (!d) return '—';
    return typeof d === 'string' ? d : d.nombre || '—';
  }
}
