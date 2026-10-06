// src/app/pages/contabilidad/fondo-rendir/fondo-rendir-reposicion-dialog/fondo-rendir-reposicion-dialog.component.ts
// Devolución del excedente de un fondo rendido en exceso: el destinatario
// puso plata de su bolsillo y se le repone con un recibo de EGRESO (sale de
// la caja de flujo en efectivo, o de la libreta si el medio es bancario).
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
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { FondoRendirCuentas } from '../../models/fondo-rendir.models';
import { FondoRendirService } from '../../services/fondo-rendir.service';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';
import { formatFechaIso } from '../../components/personal-interno.util';

export interface FondoRendirReposicionDialogData {
  fondo: FondoRendirCuentas;
  /** Nombre ya armado del destinatario, para el resumen. */
  destinatario: string;
}

@Component({
  selector: 'app-fondo-rendir-reposicion-dialog',
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
    DatosPagoFieldsComponent,
  ],
  templateUrl: './fondo-rendir-reposicion-dialog.component.html',
  styleUrl: './fondo-rendir-reposicion-dialog.component.scss',
})
export class FondoRendirReposicionDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<FondoRendirReposicionDialogComponent>,
  );
  readonly data = inject<FondoRendirReposicionDialogData>(MAT_DIALOG_DATA);
  private readonly fondoRendirService = inject(FondoRendirService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);
  readonly hoy = new Date();

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
  });
  readonly pago = crearFormDatosPago();

  get monto(): number {
    return Number(this.data.fondo.montoPorReponer) || 0;
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid || this.pago.invalid) {
      this.form.markAllAsTouched();
      this.pago.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.fondoRendirService
      .reponer(this.data.fondo.id, {
        ...leerDatosPago(this.pago),
        fecha: formatFechaIso(this.form.controls.fecha.value!),
      })
      .subscribe({
        next: (fondo) => {
          this.guardando.set(false);
          this.snackBar.open('Excedente repuesto: recibo de egreso generado', 'Cerrar', {
            duration: 4000,
          });
          this.dialogRef.close(fondo);
        },
        error: (err) => {
          this.guardando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo reponer el excedente',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }
}
