// src/app/pages/contabilidad/prestamos/prestamo-operacion-dialog/prestamo-operacion-dialog.component.ts
// Operaciones sobre un préstamo vigente:
//  - ABONO: el empleado paga con dinero propio → recibo de INGRESO, HABER en
//    el kardex y línea ABONO del sub-libro (con saldo 0 pasa a CANCELADO).
//  - CUOTA: renegociar la cuota mensual que se descuenta del sueldo.
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { PrestamoPersonal } from '../../models/prestamo-personal.models';
import { PrestamoPersonalService } from '../../services/prestamo-personal.service';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';
import { formatFechaIso, nombrePersona, num } from '../../components/personal-interno.util';

export interface PrestamoOperacionDialogData {
  modo: 'ABONO' | 'CUOTA';
  prestamo: PrestamoPersonal;
}

@Component({
  selector: 'app-prestamo-operacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    FechaInputDirective,
    MayusculasDirective,
    MontoInputDirective,
    DatosPagoFieldsComponent,
  ],
  templateUrl: './prestamo-operacion-dialog.component.html',
  styleUrl: './prestamo-operacion-dialog.component.scss',
})
export class PrestamoOperacionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PrestamoOperacionDialogComponent>);
  readonly data = inject<PrestamoOperacionDialogData>(MAT_DIALOG_DATA);
  private readonly prestamoService = inject(PrestamoPersonalService);
  private readonly snackBar = inject(MatSnackBar);

  readonly p = this.data.prestamo;
  readonly esAbono = this.data.modo === 'ABONO';
  readonly guardando = signal(false);
  readonly hoy = new Date();

  readonly formAbono = new FormGroup({
    fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
    monto: new FormControl<string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
      Validators.max(num(this.data.prestamo.saldo)),
    ]),
  });
  readonly pago = crearFormDatosPago();

  readonly formCuota = new FormGroup({
    cuotaMensual: new FormControl<string | null>(String(num(this.data.prestamo.cuotaMensual)), [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    observaciones: new FormControl('', [Validators.maxLength(255)]),
  });

  nombre = nombrePersona;
  num = num;

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    let obs: Observable<PrestamoPersonal>;
    if (this.esAbono) {
      if (this.formAbono.invalid || this.pago.invalid) {
        this.formAbono.markAllAsTouched();
        this.pago.markAllAsTouched();
        return;
      }
      const v = this.formAbono.getRawValue();
      obs = this.prestamoService.abonar(this.p.id, {
        ...leerDatosPago(this.pago),
        fecha: formatFechaIso(v.fecha!),
        monto: Number(v.monto),
      });
    } else {
      if (this.formCuota.invalid) {
        this.formCuota.markAllAsTouched();
        return;
      }
      const v = this.formCuota.getRawValue();
      const observaciones = (v.observaciones ?? '').trim();
      obs = this.prestamoService.actualizarCuota(this.p.id, {
        cuotaMensual: Number(v.cuotaMensual),
        ...(observaciones ? { observaciones } : {}),
      });
    }

    this.guardando.set(true);
    obs.subscribe({
      next: (prestamo) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esAbono
            ? prestamo.estado === 'CANCELADO'
              ? `Abono registrado: el préstamo N° ${prestamo.numero} quedó CANCELADO`
              : 'Abono registrado'
            : 'Cuota actualizada',
          'Cerrar',
          { duration: 4000 },
        );
        this.dialogRef.close(prestamo);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo guardar', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }
}
