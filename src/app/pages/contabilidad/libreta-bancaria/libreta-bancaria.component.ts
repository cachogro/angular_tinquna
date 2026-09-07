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
import { MonedaCuenta } from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import {
  LibretaBancoResponse,
  MovimientoBanco,
  PeriodoBanco,
} from '../models/libreta-banco.models';
import { LibretaBancoService } from '../services/libreta-banco.service';
import {
  MovimientoFormDialogComponent,
  MovimientoFormDialogData,
} from './movimiento-form-dialog.component';
import {
  SaldoInicialDialogComponent,
  SaldoInicialDialogData,
} from './saldo-inicial-dialog.component';

interface CuentaOpcion {
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuenta;
  saldoInicial: string | null;
  fechaSaldoInicial: string | null;
  idEntidad: number;
  nombreEntidad: string;
  siglaEntidad: string;
  activo: boolean;
}

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
  selector: 'app-libreta-bancaria',
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
  templateUrl: './libreta-bancaria.component.html',
  styleUrl: './libreta-bancaria.component.scss',
})
export class LibretaBancariaComponent implements OnInit {
  private readonly parametricasService = inject(ParametricasService);
  private readonly libretaService = inject(LibretaBancoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'folio',
    'fecha',
    'nroTransaccion',
    'nombresApellidos',
    'concepto',
    'debe',
    'haber',
    'saldo',
    'acciones',
  ];

  readonly cargandoCuentas = signal(true);
  readonly cargando = signal(false);

  readonly cuentas = signal<CuentaOpcion[]>([]);
  readonly cuentaSelId = signal<number | null>(null);

  readonly periodos = signal<PeriodoBanco[]>([]);
  readonly gestionSel = signal<number | null>(null);
  readonly mesSel = signal<number | null>(null);

  readonly resp = signal<LibretaBancoResponse | null>(null);

  // ---------- Derivados ----------

  readonly cuentaSel = computed(
    () =>
      this.cuentas().find((c) => c.idCuenta === this.cuentaSelId()) ?? null,
  );

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

  readonly movimientos = computed(() => this.resp()?.movimientos ?? []);

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
    this.cargarCuentas();
  }

  private cargarCuentas(): void {
    this.cargandoCuentas.set(true);
    this.parametricasService.obtenerEntidadesFinancieras().subscribe({
      next: (entidades) => {
        const opciones: CuentaOpcion[] = [];
        for (const e of entidades) {
          for (const c of e.cuentas ?? []) {
            opciones.push({
              idCuenta: c.id,
              numeroCuenta: c.numeroCuenta,
              moneda: c.moneda,
              saldoInicial: c.saldoInicial ?? null,
              fechaSaldoInicial: c.fechaSaldoInicial ?? null,
              idEntidad: e.id,
              nombreEntidad: e.nombre,
              siglaEntidad: e.sigla,
              activo: c.activo !== false,
            });
          }
        }
        opciones.sort((a, b) => a.nombreEntidad.localeCompare(b.nombreEntidad));
        this.cuentas.set(opciones);
        this.cargandoCuentas.set(false);
        if (opciones.length && this.cuentaSelId() == null) {
          // Por defecto: Banco Unión ("BANCO UNIÓN S.A."); si no está, la
          // primera de la lista. Se ignoran acentos en el match.
          const norm = (s: string) =>
            s
              .toUpperCase()
              .replace(/[ÁÀÄÂ]/g, 'A')
              .replace(/[ÉÈËÊ]/g, 'E')
              .replace(/[ÍÌÏÎ]/g, 'I')
              .replace(/[ÓÒÖÔ]/g, 'O')
              .replace(/[ÚÙÜÛ]/g, 'U');
          const porDefecto =
            opciones.find((c) => norm(c.nombreEntidad).includes('UNION')) ??
            opciones[0];
          this.onCuentaChange(porDefecto.idCuenta);
        }
      },
      error: () => {
        this.cargandoCuentas.set(false);
        this.snackBar.open(
          'No se pudieron cargar las cuentas bancarias',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  onCuentaChange(id: number): void {
    this.cuentaSelId.set(id);
    this.gestionSel.set(null);
    this.mesSel.set(null);
    this.periodos.set([]);
    this.resp.set(null);
    this.cargarPeriodos(true);
    this.cargarLibreta();
  }

  private cargarPeriodos(autoSeleccionarGestion = false): void {
    const id = this.cuentaSelId();
    if (id == null) return;
    this.libretaService.listarPeriodos(id).subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);
        if (autoSeleccionarGestion && periodos.length) {
          const nuevaGestion = Math.max(...periodos.map((p) => p.gestion));
          this.gestionSel.set(nuevaGestion);
          this.cargarLibreta();
        }
      },
      error: () => {
        this.periodos.set([]);
      },
    });
  }

  private cargarLibreta(): void {
    const id = this.cuentaSelId();
    if (id == null) {
      this.resp.set(null);
      return;
    }
    this.cargando.set(true);
    this.libretaService
      .listar(id, this.gestionSel(), this.mesSel())
      .subscribe({
        next: (data) => {
          this.resp.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.resp.set(null);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar la libreta',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  private recargar(): void {
    this.cargarPeriodos();
    this.cargarLibreta();
    // Refresca el saldo inicial de la cuenta en el selector.
    this.refrescarCuentaSel();
  }

  private refrescarCuentaSel(): void {
    this.parametricasService.obtenerEntidadesFinancieras().subscribe({
      next: (entidades) => {
        const actual = this.cuentas();
        const map = new Map<number, { saldoInicial: string | null; fechaSaldoInicial: string | null }>();
        for (const e of entidades)
          for (const c of e.cuentas ?? [])
            map.set(c.id, {
              saldoInicial: c.saldoInicial ?? null,
              fechaSaldoInicial: c.fechaSaldoInicial ?? null,
            });
        this.cuentas.set(
          actual.map((c) => ({ ...c, ...(map.get(c.idCuenta) ?? {}) })),
        );
      },
      error: () => {},
    });
  }

  onGestionChange(g: number | null): void {
    this.gestionSel.set(g);
    this.mesSel.set(null);
    this.cargarLibreta();
  }

  onMesChange(m: number | null): void {
    this.mesSel.set(m);
    this.cargarLibreta();
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
    const id = this.cuentaSelId();
    if (id == null) return;
    const data: MovimientoFormDialogData = {
      idCuentaBancaria: id,
      fechaSugerida: this.fechaSugerida,
    };
    this.dialog
      .open(MovimientoFormDialogComponent, {
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

  editarMovimiento(m: MovimientoBanco): void {
    const id = this.cuentaSelId();
    if (id == null) return;
    const data: MovimientoFormDialogData = {
      idCuentaBancaria: id,
      movimiento: m,
    };
    this.dialog
      .open(MovimientoFormDialogComponent, {
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

  desactivarMovimiento(m: MovimientoBanco): void {
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
        this.libretaService.cambiarEstadoMovimiento(m.id, false).subscribe({
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

  movimientoEditable(m: MovimientoBanco): boolean {
    const estado =
      m.periodoBanco?.estado ??
      this.periodos().find((p) => String(p.id) === String(m.idPeriodoBanco))
        ?.estado;
    return estado !== 'CERRADO';
  }

  // ---------- Períodos ----------

  cerrarMes(): void {
    const p = this.periodoMesSel();
    const id = this.cuentaSelId();
    if (!p || id == null || p.mes == null) return;
    this.confirmarYaccion(
      `¿Cerrar el período ${this.etiquetaMes(p.mes)} ${p.gestion}? El saldo final quedará fijo.`,
      'Cerrar mes',
      'lock',
      () =>
        this.libretaService.cerrarMes({
          idCuentaBancaria: id,
          gestion: p.gestion,
          mes: p.mes!,
        }),
      'Período cerrado',
    );
  }

  reabrirMes(): void {
    const p = this.periodoMesSel();
    const id = this.cuentaSelId();
    if (!p || id == null || p.mes == null) return;
    this.confirmarYaccion(
      `¿Reabrir el período ${this.etiquetaMes(p.mes)} ${p.gestion}?`,
      'Reabrir mes',
      'lock_open',
      () =>
        this.libretaService.reabrirMes({
          idCuentaBancaria: id,
          gestion: p.gestion,
          mes: p.mes!,
        }),
      'Período reabierto',
    );
  }

  cerrarGestion(): void {
    const g = this.gestionSel();
    const id = this.cuentaSelId();
    if (g == null || id == null) return;
    this.confirmarYaccion(
      `¿Cerrar la gestión ${g}? Requiere los 12 meses cerrados.`,
      'Cerrar gestión',
      'lock',
      () => this.libretaService.cerrarGestion({ idCuentaBancaria: id, gestion: g }),
      'Gestión cerrada',
    );
  }

  reabrirGestion(): void {
    const g = this.gestionSel();
    const id = this.cuentaSelId();
    if (g == null || id == null) return;
    this.confirmarYaccion(
      `¿Reabrir la gestión ${g}?`,
      'Reabrir gestión',
      'lock_open',
      () =>
        this.libretaService.reabrirGestion({ idCuentaBancaria: id, gestion: g }),
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

  // ---------- Saldo inicial ----------

  abrirSaldoInicial(): void {
    const c = this.cuentaSel();
    if (!c) return;
    const data: SaldoInicialDialogData = {
      idEntidad: c.idEntidad,
      nombreEntidad: c.nombreEntidad,
      siglaEntidad: c.siglaEntidad,
      idCuenta: c.idCuenta,
      numeroCuenta: c.numeroCuenta,
      moneda: c.moneda,
      saldoInicialActual: c.saldoInicial,
      fechaSaldoInicialActual: c.fechaSaldoInicial,
    };
    this.dialog
      .open(SaldoInicialDialogComponent, {
        data,
        width: '460px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.recargar();
      });
  }

  // ---------- Helpers de vista ----------

  etiquetaMes(m: number | null | undefined): string {
    return m == null ? '—' : (MESES[m - 1] ?? String(m));
  }

  etiquetaCuenta(c: CuentaOpcion): string {
    return `${c.nombreEntidad} · ${c.numeroCuenta} (${c.moneda})`;
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

  get saldoInicialConfigurado(): boolean {
    return !!this.cuentaSel()?.fechaSaldoInicial;
  }
}
