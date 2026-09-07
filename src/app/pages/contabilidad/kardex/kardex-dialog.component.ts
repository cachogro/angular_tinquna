// src/app/pages/contabilidad/kardex/kardex-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { Kardex, TipoKardex } from '../models/kardex.models';
import { MovimientoKardex } from '../models/movimiento-kardex.models';
import { KardexService } from '../services/kardex.service';
import { MovimientoKardexService } from '../services/movimiento-kardex.service';
import {
  MovimientoKardexFormDialogComponent,
  MovimientoKardexFormDialogData,
} from './movimiento-kardex-form-dialog.component';

export interface KardexDialogData {
  tipo: TipoKardex;
  idActorProductivoMinero?: string;
  idPersona?: string;
  nombreDestinatario: string;
}

@Component({
  selector: 'app-kardex-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ],
  templateUrl: './kardex-dialog.component.html',
  styleUrl: './kardex-dialog.component.scss',
})
export class KardexDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<KardexDialogComponent>);
  readonly data = inject<KardexDialogData>(MAT_DIALOG_DATA);
  private readonly kardexService = inject(KardexService);
  private readonly movimientoService = inject(MovimientoKardexService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly registros = signal<Kardex[]>([]);

  readonly cargandoMovimientos = signal(false);
  readonly movimientos = signal<MovimientoKardex[]>([]);

  readonly columnasMovimientos = [
    'numeroLinea',
    'fecha',
    'nroComprobante',
    'detalle',
    'subcuenta',
    'formaPago',
    'debe',
    'haber',
    'saldo',
    'acciones',
  ];

  /** Tope del datepicker: no se abre un kardex con fecha futura. */
  readonly hoy = new Date();

  readonly columnas = [
    'numero',
    'gestion',
    'descripcion',
    'estado',
    'saldoInicial',
    'saldo',
    'acciones',
  ];

  readonly hayKardex = computed(() => this.registros().length > 0);

  readonly ordenados = computed(() =>
    [...this.registros()].sort((a, b) => b.numero - a.numero),
  );

  readonly kardexAbierto = computed(
    () => this.registros().find((k) => k.estado === 'ABIERTO') ?? null,
  );

  readonly maxNumero = computed(() =>
    this.registros().length
      ? Math.max(...this.registros().map((k) => k.numero))
      : 0,
  );

  /** La baja lógica solo tiene sentido cuando el único registro es el N°1 (sin historial). */
  readonly puedeDarBaja = computed(() => {
    const regs = this.registros();
    return regs.length === 1 && regs[0].numero === 1;
  });

  readonly form = new FormGroup({
    descripcion: new FormControl('', [Validators.maxLength(150)]),
    /** Fecha de apertura completa (día/mes/año); al guardar solo se envía
     *  el año como `gestion` (es lo único que pide el back). */
    fechaApertura: new FormControl<Date | null>(new Date(), [
      Validators.required,
    ]),
    saldoInicial: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.f.descripcion.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.descripcion.setValue(up, { emitEvent: false });
    });
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.kardexService
      .listar({
        tipo: this.data.tipo,
        idActorProductivoMinero: this.data.idActorProductivoMinero,
        idPersona: this.data.idPersona,
        // Historial completo de este destinatario: no debería pasar de unos
        // pocos números, pero por si acaso pedimos harto margen.
        limit: 100,
        orderBy: 'numero',
        orderDirection: 'ASC',
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.cargando.set(false);
          const abierto = res.data.find((k) => k.estado === 'ABIERTO');
          if (abierto) this.cargarMovimientos(abierto.id);
          else this.movimientos.set([]);
        },
        error: (err) => {
          this.cargando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar el kardex',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  private cargarMovimientos(idKardex: string): void {
    this.cargandoMovimientos.set(true);
    this.movimientoService.listar(idKardex).subscribe({
      next: (res) => {
        this.movimientos.set(res.movimientos);
        this.cargandoMovimientos.set(false);
      },
      error: () => {
        this.movimientos.set([]);
        this.cargandoMovimientos.set(false);
      },
    });
  }

  abrir(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();
    const descripcion = (v.descripcion ?? '').trim();

    this.kardexService
      .abrir({
        tipo: this.data.tipo,
        idActorProductivoMinero: this.data.idActorProductivoMinero,
        idPersona: this.data.idPersona,
        ...(descripcion ? { descripcion } : {}),
        gestion: v.fechaApertura!.getFullYear(),
        saldoInicial: Number(v.saldoInicial),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open('Kardex N°1 abierto correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo abrir el kardex',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  cerrar(k: Kardex): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Cerrar kardex',
          message: `¿Confirmas cerrar el N°${k.numero}? El saldo actual (Bs ${this.num(k.saldoActual).toFixed(2)}) queda como saldo de cierre y se abre el N°${k.numero + 1} arrastrándolo.`,
          confirmLabel: 'Cerrar',
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon: 'lock',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.kardexService.cerrar(k.id).subscribe({
          next: (res) => {
            this.guardando.set(false);
            this.snackBar.open(
              `Cerrado N°${res.cerrado?.numero ?? k.numero}. Abierto N°${res.nuevo?.numero ?? k.numero + 1}`,
              'Cerrar',
              { duration: 4000 },
            );
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo cerrar el kardex',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  reabrir(k: Kardex): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Reabrir kardex',
          message: `¿Confirmas reabrir el N°${k.numero}? Si el N°${k.numero + 1} no tiene movimientos, se elimina.`,
          confirmLabel: 'Reabrir',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'lock_open',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.kardexService.reabrir(k.id).subscribe({
          next: () => {
            this.guardando.set(false);
            this.snackBar.open('Kardex reabierto', 'Cerrar', {
              duration: 3000,
            });
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo reabrir el kardex',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  toggleActivo(k: Kardex): void {
    const activar = k.activo === false;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activar ? 'Activar kardex' : 'Dar de baja el kardex',
          message: activar
            ? `¿Confirmas activar el N°${k.numero}?`
            : `¿Confirmas dar de baja el N°${k.numero}? Solo aplica porque todavía no tiene historial.`,
          confirmLabel: activar ? 'Activar' : 'Dar de baja',
          cancelLabel: 'Cancelar',
          tone: activar ? 'default' : 'danger',
          icon: activar ? 'check_circle_outline' : 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.kardexService.cambiarEstado(k.id, activar).subscribe({
          next: () => {
            this.guardando.set(false);
            this.snackBar.open(
              activar ? 'Kardex activado' : 'Kardex dado de baja',
              'Cerrar',
              { duration: 3000 },
            );
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo cambiar el estado',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  // ---------- Movimientos del kardex abierto ----------

  nuevoMovimiento(): void {
    const ka = this.kardexAbierto();
    if (!ka) return;
    const data: MovimientoKardexFormDialogData = {
      idKardex: ka.id,
      nombreDestinatario: this.data.nombreDestinatario,
      idPersonaPropietario:
        this.data.tipo === 'PERSONAL' ? this.data.idPersona : undefined,
    };
    this.dialog
      .open(MovimientoKardexFormDialogComponent, {
        data,
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.cargar();
      });
  }

  editarMovimiento(m: MovimientoKardex): void {
    const data: MovimientoKardexFormDialogData = {
      idKardex: m.idKardex,
      movimiento: m,
      nombreDestinatario: this.data.nombreDestinatario,
    };
    this.dialog
      .open(MovimientoKardexFormDialogComponent, {
        data,
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.cargar();
      });
  }

  desactivarMovimiento(m: MovimientoKardex): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Desactivar movimiento',
          message: `¿Confirmas desactivar el movimiento "${m.detalle}"? Se recalcula el saldo del kardex sin él.`,
          confirmLabel: 'Desactivar',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.movimientoService.cambiarEstado(m.id, false).subscribe({
          next: () => {
            this.snackBar.open('Movimiento desactivado', 'Cerrar', {
              duration: 3000,
            });
            this.cargar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo desactivar el movimiento',
              'Cerrar',
              { duration: 4000 },
            ),
        });
      });
  }

  cerrarDialogo(): void {
    this.dialogRef.close();
  }

  num(v: string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }
}
