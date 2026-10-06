// src/app/pages/contabilidad/kardex/bien-dacion-form-dialog/bien-dacion-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { BienDacionPago } from '../../models/bien-dacion-pago.models';
import { BienDacionPagoService } from '../../services/bien-dacion-pago.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';

export type ModoBienDacion =
  | 'REGISTRAR'
  | 'TOMAR_EN_PAGO'
  | 'VENDER'
  | 'DEVOLVER';

export interface BienDacionFormDialogData {
  modo: ModoBienDacion;
  nombreDestinatario: string;
  /** REGISTRAR: uno de los dos (excluyentes). */
  idActorProductivoMinero?: string;
  idPersona?: string;
  /** TOMAR_EN_PAGO / VENDER / DEVOLVER: el bien sobre el que se actúa. */
  bien?: BienDacionPago;
}

@Component({
  selector: 'app-bien-dacion-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    MontoInputDirective,
    MayusculasDirective,
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    DatosPagoFieldsComponent,
  ],
  templateUrl: './bien-dacion-form-dialog.component.html',
  styleUrl: './bien-dacion-form-dialog.component.scss',
})
export class BienDacionFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<BienDacionFormDialogComponent>,
  );
  readonly data = inject<BienDacionFormDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(BienDacionPagoService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);

  readonly hoy = new Date();
  /** Ninguna operación puede ser anterior a la recepción (ni a la toma en
   *  pago, si ya la hubo). */
  readonly minFecha: Date | null = this.data.bien
    ? this.parseIso(this.data.bien.fechaTomaPago ?? this.data.bien.fechaRecepcion)
    : null;

  readonly titulo = {
    REGISTRAR: 'Registrar bien en dación de pago',
    TOMAR_EN_PAGO: 'Tomar bien en pago',
    VENDER: 'Vender bien',
    DEVOLVER: 'Marcar bien como devuelto',
  }[this.data.modo];

  /** VENDER sobre un bien todavía EN_POSESION: la venta también amortiza la
   *  deuda del dueño. Si ya estaba TOMADO_EN_PAGO, solo entra el dinero. */
  readonly ventaDirecta =
    this.data.modo === 'VENDER' && this.data.bien?.estado === 'EN_POSESION';

  /** Valor acordado con el dueño al recibir el bien. */
  readonly valorAcordado = this.num(this.data.bien?.valorReferencial);

  /** Solo VENDER: forma de pago, cuenta si es bancaria, origen del ingreso y
   *  quién autorizó. Define si entra a la caja de flujo o a la libreta. */
  readonly pago = crearFormDatosPago();

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
    descripcion: new FormControl('', [Validators.maxLength(255)]),
    /** REGISTRAR: valor acordado. VENDER: precio de venta. */
    monto: new FormControl<number | string | null>(null, [
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    /** TOMAR_EN_PAGO y venta directa: lo que se abona al kardex del dueño. */
    montoAmortizar: new FormControl<number | string | null>(null, [
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    observaciones: new FormControl('', [Validators.maxLength(500)]),
  });

  get f() {
    return this.form.controls;
  }

  /** true si el formulario pide el monto que amortiza la deuda. */
  get pideAmortizar(): boolean {
    return this.data.modo === 'TOMAR_EN_PAGO' || this.ventaDirecta;
  }

  ngOnInit(): void {
    switch (this.data.modo) {
      case 'REGISTRAR':
        this.f.descripcion.addValidators(Validators.required);
        this.f.monto.addValidators(Validators.required);
        break;
      case 'TOMAR_EN_PAGO':
        this.f.montoAmortizar.addValidators(Validators.required);
        if (this.valorAcordado > 0) {
          this.f.montoAmortizar.setValue(this.valorAcordado);
        }
        break;
      case 'VENDER':
        this.f.monto.addValidators(Validators.required);
        if (this.ventaDirecta) {
          this.f.montoAmortizar.addValidators(Validators.required);
          if (this.valorAcordado > 0) {
            this.f.montoAmortizar.setValue(this.valorAcordado);
          }
          // Mientras no se toque a mano, lo que amortiza sigue al precio: el
          // valor acordado, o el precio si se vende por menos.
          this.f.monto.valueChanges.subscribe((v) => {
            if (this.f.montoAmortizar.dirty) return;
            const precio = this.num(v);
            if (precio <= 0) return;
            this.f.montoAmortizar.setValue(
              this.valorAcordado > 0 ? Math.min(this.valorAcordado, precio) : precio,
            );
          });
        }
        break;
      case 'DEVOLVER':
        this.f.observaciones.addValidators(Validators.required);
        break;
    }
    this.form.updateValueAndValidity();

    for (const c of [this.f.descripcion, this.f.observaciones]) {
      c.valueChanges.subscribe((v) => {
        if (typeof v !== 'string') return;
        const up = v.toUpperCase();
        if (up !== v) c.setValue(up, { emitEvent: false });
      });
    }
  }

  // ---------- Resumen de la venta ----------

  get precioVenta(): number {
    return this.num(this.f.monto.value);
  }

  /** Lo que va (o ya fue) al kardex del dueño. */
  get amortizado(): number {
    return this.ventaDirecta
      ? this.num(this.f.montoAmortizar.value)
      : this.num(this.data.bien?.montoAmortizado);
  }

  get gastos(): number {
    return this.num(this.data.bien?.totalGastos);
  }

  /** Lo que le costó el bien a la empresa: lo amortizado + lo que le invirtió. */
  get costoTotal(): number {
    return Math.round((this.amortizado + this.gastos) * 100) / 100;
  }

  /** Precio − amortizado − gastos: ganancia (> 0) o pérdida (< 0) de la empresa. */
  get resultado(): number {
    return Math.round((this.precioVenta - this.amortizado - this.gastos) * 100) / 100;
  }

  guardar(): void {
    const pagoInvalido = this.data.modo === 'VENDER' && this.pago.invalid;
    if (this.form.invalid || pagoInvalido) {
      this.form.markAllAsTouched();
      this.pago.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const fecha = this.toIso(v.fecha!);
    const observaciones = (v.observaciones ?? '').trim();
    const monto = this.num(v.monto);
    const montoAmortizar = this.num(v.montoAmortizar);

    let req$: Observable<BienDacionPago>;
    switch (this.data.modo) {
      case 'REGISTRAR':
        req$ = this.service.registrar({
          ...(this.data.idActorProductivoMinero
            ? { idActorProductivoMinero: this.data.idActorProductivoMinero }
            : { idPersona: this.data.idPersona }),
          fechaRecepcion: fecha,
          descripcion: (v.descripcion ?? '').trim(),
          valorReferencial: monto,
          ...(observaciones ? { observaciones } : {}),
        });
        break;
      case 'TOMAR_EN_PAGO':
        req$ = this.service.tomarEnPago(this.data.bien!.id, {
          fecha,
          montoAmortizar,
          ...(observaciones ? { observaciones } : {}),
        });
        break;
      case 'VENDER':
        req$ = this.service.vender(this.data.bien!.id, {
          ...leerDatosPago(this.pago),
          fechaVenta: fecha,
          montoVenta: monto,
          ...(this.ventaDirecta ? { montoAmortizar } : {}),
          ...(observaciones ? { observaciones } : {}),
        });
        break;
      default:
        req$ = this.service.devolver(this.data.bien!.id, {
          fechaDevolucion: fecha,
          observaciones,
        });
    }

    this.guardando.set(true);
    req$.subscribe({
      next: (bien) => {
        this.guardando.set(false);
        const msg = {
          REGISTRAR: 'Bien registrado',
          TOMAR_EN_PAGO: 'Bien tomado en pago: deuda amortizada en el kardex',
          VENDER: `Bien vendido: ingreso registrado en ${bien.idLibretaBanco ? 'la libreta bancaria' : 'la caja de flujo'}`,
          DEVOLVER: 'Bien marcado como devuelto',
        }[this.data.modo];
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
        this.dialogRef.close(bien);
      },
      error: (err) => {
        this.guardando.set(false);
        const m = err?.error?.message;
        this.snackBar.open(
          (Array.isArray(m) ? m.join('. ') : m) ?? 'No se pudo guardar',
          'Cerrar',
          { duration: 6000 },
        );
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  num(v: number | string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  private toIso(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private parseIso(iso: string): Date {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
  }
}
