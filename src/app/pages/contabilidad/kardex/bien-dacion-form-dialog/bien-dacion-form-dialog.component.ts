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
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';

export type ModoBienDacion = 'REGISTRAR' | 'VENDER' | 'DEVOLVER';

export interface BienDacionFormDialogData {
  modo: ModoBienDacion;
  nombreDestinatario: string;
  /** REGISTRAR: uno de los dos (excluyentes). */
  idActorProductivoMinero?: string;
  idPersona?: string;
  /** VENDER / DEVOLVER: el bien EN_POSESION sobre el que se actúa. */
  bien?: BienDacionPago;
}

@Component({
  selector: 'app-bien-dacion-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
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
  /** Venta / devolución no pueden ser anteriores a la recepción. */
  readonly minFecha: Date | null = this.data.bien?.fechaRecepcion
    ? this.parseIso(this.data.bien.fechaRecepcion)
    : null;

  readonly titulo =
    this.data.modo === 'REGISTRAR'
      ? 'Registrar bien en dación de pago'
      : this.data.modo === 'VENDER'
        ? 'Vender bien'
        : 'Marcar bien como devuelto';

  /** Solo VENDER: datos del recibo de INGRESO (forma de pago, cuenta si es
   *  bancaria, origen del ingreso, quién autorizó). */
  readonly pago = crearFormDatosPago();

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
    descripcion: new FormControl('', [Validators.maxLength(255)]),
    /** REGISTRAR: valor referencial (opcional). VENDER: monto de venta. */
    monto: new FormControl<number | null>(null, [
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    observaciones: new FormControl('', [Validators.maxLength(500)]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    switch (this.data.modo) {
      case 'REGISTRAR':
        this.f.descripcion.addValidators(Validators.required);
        break;
      case 'VENDER':
        this.f.monto.addValidators(Validators.required);
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
    const monto =
      v.monto !== null && v.monto !== undefined && `${v.monto}` !== ''
        ? Number(v.monto)
        : null;

    let req$: Observable<BienDacionPago>;
    if (this.data.modo === 'REGISTRAR') {
      req$ = this.service.registrar({
        ...(this.data.idActorProductivoMinero
          ? { idActorProductivoMinero: this.data.idActorProductivoMinero }
          : { idPersona: this.data.idPersona }),
        fechaRecepcion: fecha,
        descripcion: (v.descripcion ?? '').trim(),
        ...(monto ? { valorReferencial: monto } : {}),
        ...(observaciones ? { observaciones } : {}),
      });
    } else if (this.data.modo === 'VENDER') {
      req$ = this.service.vender(this.data.bien!.id, {
        ...leerDatosPago(this.pago),
        fechaVenta: fecha,
        montoVenta: monto!,
        ...(observaciones ? { observaciones } : {}),
      });
    } else {
      req$ = this.service.devolver(this.data.bien!.id, {
        fechaDevolucion: fecha,
        observaciones,
      });
    }

    this.guardando.set(true);
    req$.subscribe({
      next: (bien) => {
        this.guardando.set(false);
        const msg =
          this.data.modo === 'REGISTRAR'
            ? 'Bien registrado'
            : this.data.modo === 'VENDER'
              ? `Bien vendido: recibo ${bien.recibo ? bien.recibo.serie + '-' + String(bien.recibo.numero).padStart(4, '0') : ''} registrado (amortiza la deuda en el kardex)`
              : 'Bien marcado como devuelto';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
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
