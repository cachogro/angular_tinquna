// src/app/pages/contabilidad/kardex/kardex-interes-dialog/kardex-interes-dialog.component.ts
// Sección de intereses por mora de un kardex (actor, asociado o personal).
// El interés se lleva aparte del kardex: acá se aplica, se ve mes a mes y se
// resuelve el acuerdo (bajar la tasa, condonar o cargarlo al kardex).
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { formatearFechaBolivia } from '../../../../shared/utils/fecha-bolivia.util';
import {
  DetalleInteresKardex,
  EstadoKardexInteresCuota,
  KardexInteres,
  KardexInteresCuota,
  KardexInteresEvento,
} from '../../models/kardex-interes.models';
import { KardexInteresService } from '../../services/kardex-interes.service';

export interface KardexInteresDialogData {
  idKardex: string;
  codigoKardex: string;
  nombreDestinatario: string;
}

/** Operación en curso en el panel de formulario. */
type ModoInteres = 'APLICAR' | 'TASA' | 'CONDONAR' | 'CARGAR';

const ETIQUETA_EVENTO: Record<KardexInteresEvento['tipo'], string> = {
  APLICACION: 'Se aplicó el interés',
  CAMBIO_TASA: 'Cambio de tasa',
  CONDONACION: 'Condonación',
  CARGO_KARDEX: 'Cargo al kardex',
  REVERSION_CARGO: 'Cargo revertido',
  FINALIZACION: 'Plan finalizado',
};

@Component({
  selector: 'app-kardex-interes-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    MayusculasDirective,
    MontoInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
  ],
  templateUrl: './kardex-interes-dialog.component.html',
  styleUrl: './kardex-interes-dialog.component.scss',
})
export class KardexInteresDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<KardexInteresDialogComponent>,
  );
  readonly data = inject<KardexInteresDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(KardexInteresService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly detalle = signal<DetalleInteresKardex | null>(null);

  /** Panel de formulario abierto y el plan sobre el que actúa. */
  readonly modo = signal<ModoInteres | null>(null);
  readonly planEnEdicion = signal<KardexInteres | null>(null);

  /** Cargar o revertir mueve el saldo del kardex: la página lo recarga. */
  private huboCambios = false;

  readonly hoy = new Date();

  readonly saldoKardex = computed(() =>
    this.num(this.detalle()?.kardex.saldoActual),
  );
  readonly kardexAbierto = computed(
    () => this.detalle()?.kardex.estado === 'ABIERTO',
  );
  /** Aplicar: kardex abierto, con deuda y sin otro plan vigente. */
  readonly puedeAplicar = computed(
    () =>
      this.kardexAbierto() &&
      this.saldoKardex() > 0 &&
      !this.detalle()?.vigente,
  );

  readonly form = new FormGroup({
    tasaMensual: new FormControl<number | string | null>(null),
    /** APLICAR: desde cuándo corre. CARGAR: fecha de la línea del kardex. */
    fecha: new FormControl<Date | null>(new Date()),
    observacion: new FormControl('', [Validators.maxLength(500)]),
    finalizar: new FormControl(false, { nonNullable: true }),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.service.detalle(this.data.idKardex).subscribe({
      next: (res) => {
        this.detalle.set(res);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudieron cargar los intereses',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  // ---------- Lectura de un plan ----------

  pendientes(p: KardexInteres): KardexInteresCuota[] {
    return p.cuotas.filter((c) => c.estado === 'PENDIENTE');
  }

  total(p: KardexInteres, estado: EstadoKardexInteresCuota): number {
    return p.cuotas
      .filter((c) => c.estado === estado)
      .reduce((suma, c) => suma + this.num(c.monto), 0);
  }

  /** Un cargo junta varias cuotas en una sola línea del kardex: el botón de
   *  revertir va solo en la primera cuota de cada cargo. */
  encabezaCargo(p: KardexInteres, c: KardexInteresCuota): boolean {
    return (
      c.estado === 'CARGADO' &&
      p.cuotas.find((x) => x.idMovimientoKardex === c.idMovimientoKardex) === c
    );
  }

  /** Total pendiente del plan en edición con la tasa que se está tecleando. */
  readonly previewTasa = signal<number | null>(null);

  private recalcularPreview(): void {
    const plan = this.planEnEdicion();
    const tasa = Number(this.f.tasaMensual.value);
    if (this.modo() !== 'TASA' || !plan || !(tasa > 0)) {
      this.previewTasa.set(null);
      return;
    }
    this.previewTasa.set(
      this.pendientes(plan).reduce(
        (suma, c) =>
          suma + Math.round(this.num(c.saldoBase) * tasa + Number.EPSILON) / 100,
        0,
      ),
    );
  }

  // ---------- Panel de formulario ----------

  abrirForm(modo: ModoInteres, plan: KardexInteres | null = null): void {
    this.modo.set(modo);
    this.planEnEdicion.set(plan);
    this.form.reset({
      tasaMensual: null,
      fecha: new Date(),
      observacion: '',
      // Condonar normalmente cierra el tema; cargar deja el plan corriendo.
      finalizar: modo === 'CONDONAR',
    });
    const conTasa = modo === 'APLICAR' || modo === 'TASA';
    this.f.tasaMensual.setValidators(
      conTasa
        ? [
            Validators.required,
            Validators.pattern(/^\d+(\.\d{1,4})?$/),
            Validators.min(0.0001),
            Validators.max(100),
          ]
        : [],
    );
    this.f.fecha.setValidators(
      modo === 'APLICAR' || modo === 'CARGAR' ? [Validators.required] : [],
    );
    // El acuerdo (bajar la tasa o perdonar) siempre deja escrito el motivo.
    this.f.observacion.setValidators(
      modo === 'TASA' || modo === 'CONDONAR'
        ? [Validators.required, Validators.maxLength(500)]
        : [Validators.maxLength(500)],
    );
    this.form.updateValueAndValidity();
    this.previewTasa.set(null);
  }

  onTasaInput(): void {
    this.recalcularPreview();
  }

  cancelarForm(): void {
    this.modo.set(null);
    this.planEnEdicion.set(null);
  }

  guardarForm(): void {
    const modo = this.modo();
    if (!modo) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const observacion = (v.observacion ?? '').trim();
    const plan = this.planEnEdicion();

    let peticion: Observable<DetalleInteresKardex>;
    let mensaje: string;
    if (modo === 'APLICAR') {
      peticion = this.service.aplicar(this.data.idKardex, {
        tasaMensual: Number(v.tasaMensual),
        fechaInicio: this.iso(v.fecha!),
        ...(observacion ? { observaciones: observacion } : {}),
      });
      mensaje = 'Interés aplicado';
    } else if (!plan) {
      return;
    } else if (modo === 'TASA') {
      peticion = this.service.cambiarTasa(plan.id, {
        tasaMensual: Number(v.tasaMensual),
        observacion,
      });
      mensaje = 'Tasa cambiada: se recalcularon los intereses pendientes';
    } else if (modo === 'CONDONAR') {
      peticion = this.service.condonar(plan.id, {
        observacion,
        finalizar: v.finalizar,
      });
      mensaje = 'Intereses condonados';
    } else {
      peticion = this.service.cargar(plan.id, {
        fecha: this.iso(v.fecha!),
        finalizar: v.finalizar,
        ...(observacion ? { observacion } : {}),
      });
      mensaje = 'Intereses cargados al kardex';
    }
    this.ejecutar(peticion, mensaje, modo === 'CARGAR');
  }

  // ---------- Acciones con confirmación ----------

  finalizar(p: KardexInteres): void {
    const pendiente = this.total(p, 'PENDIENTE');
    this.confirmar(
      {
        title: 'Finalizar plan de intereses',
        message:
          `El plan del ${this.tasa(p.tasaMensual)} % mensual deja de generar intereses desde hoy.` +
          (pendiente > 0
            ? ` Los Bs ${pendiente.toFixed(2)} pendientes no se pierden: quedan para cargarlos al kardex o condonarlos.`
            : ''),
        confirmLabel: 'Finalizar',
        icon: 'stop_circle',
      },
      () => this.ejecutar(this.service.finalizar(p.id), 'Plan finalizado', false),
    );
  }

  revertirCargo(c: KardexInteresCuota): void {
    if (!c.idMovimientoKardex) return;
    this.confirmar(
      {
        title: 'Revertir cargo de intereses',
        message:
          'Se da de baja la línea de intereses en el kardex (su saldo baja por ese importe) y las cuotas de ese cargo vuelven a quedar pendientes, para renegociarlas, cargarlas de nuevo o condonarlas.',
        confirmLabel: 'Revertir',
        icon: 'undo',
        tone: 'danger',
      },
      () =>
        this.ejecutar(
          this.service.revertirCargo(c.idMovimientoKardex!),
          'Cargo revertido',
          true,
        ),
    );
  }

  private confirmar(
    data: {
      title: string;
      message: string;
      confirmLabel: string;
      icon: string;
      tone?: 'default' | 'danger';
    },
    accion: () => void,
  ): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: { cancelLabel: 'Cancelar', tone: 'default', ...data },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (ok) accion();
      });
  }

  private ejecutar(
    peticion: Observable<DetalleInteresKardex>,
    mensaje: string,
    mueveKardex: boolean,
  ): void {
    this.guardando.set(true);
    peticion.subscribe({
      next: (res) => {
        this.guardando.set(false);
        // El tile de intereses de la página siempre cambia.
        this.huboCambios = true;
        this.detalle.set(res);
        this.cancelarForm();
        this.snackBar.open(
          mueveKardex ? `${mensaje}. Saldo del kardex actualizado` : mensaje,
          'Cerrar',
          { duration: 3500 },
        );
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo completar la operación',
          'Cerrar',
          { duration: 6000 },
        );
      },
    });
  }

  cerrarDialogo(): void {
    this.dialogRef.close(this.huboCambios);
  }

  // ---------- Presentación ----------

  tituloForm(): string {
    switch (this.modo()) {
      case 'APLICAR':
        return 'Aplicar interés mensual';
      case 'TASA':
        return 'Cambiar la tasa (acuerdo)';
      case 'CONDONAR':
        return 'Condonar intereses pendientes';
      default:
        return 'Cargar intereses al kardex';
    }
  }

  eventoLabel(e: KardexInteresEvento): string {
    return ETIQUETA_EVENTO[e.tipo] ?? e.tipo;
  }

  eventoDetalle(e: KardexInteresEvento): string {
    const bs = (v: string | null | undefined) => `Bs ${this.num(v).toFixed(2)}`;
    switch (e.tipo) {
      case 'APLICACION':
        return `${this.tasa(e.tasaNueva)} % mensual`;
      case 'CAMBIO_TASA':
        return `${this.tasa(e.tasaAnterior)} % → ${this.tasa(e.tasaNueva)} % · pendiente ${bs(e.montoAnterior)} → ${bs(e.monto)}`;
      case 'CONDONACION':
      case 'CARGO_KARDEX':
      case 'REVERSION_CARGO':
        return `${bs(e.monto)} · ${e.cuotas ?? 0} ${e.cuotas === 1 ? 'mes' : 'meses'}`;
      default:
        return '';
    }
  }

  /** "3.0000" -> "3"; "1.5000" -> "1.5". */
  tasa(v: number | string | null | undefined): string {
    return String(Number(this.num(v).toFixed(4)));
  }

  num(v: number | string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  fechaFmt(iso: string | null | undefined): string {
    return formatearFechaBolivia(iso) || '—';
  }

  private iso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
