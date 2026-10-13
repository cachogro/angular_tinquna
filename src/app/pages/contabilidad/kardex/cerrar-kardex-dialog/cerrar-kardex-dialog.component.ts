// src/app/pages/contabilidad/kardex/cerrar-kardex-dialog/cerrar-kardex-dialog.component.ts
// Confirmación del cierre de un kardex con su fecha de cierre: por defecto
// hoy, o una fecha pasada al cargar kardex históricos. Esa fecha es también
// la apertura del kardex siguiente y su año, la gestión de ese kardex.
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { fechaBoliviaAInputDate } from '../../../../shared/utils/fecha-bolivia.util';
import { formatFechaIso } from '../../components/personal-interno.util';
import { Kardex } from '../../models/kardex.models';

export interface CerrarKardexDialogData {
  kardex: Kardex;
  /** Saldo actual ya formateado (se arrastra al kardex siguiente). */
  saldoTexto: string;
}

@Component({
  selector: 'app-cerrar-kardex-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    FechaInputDirective,
  ],
  templateUrl: './cerrar-kardex-dialog.component.html',
  styleUrl: './cerrar-kardex-dialog.component.scss',
})
export class CerrarKardexDialogComponent {
  readonly data = inject<CerrarKardexDialogData>(MAT_DIALOG_DATA);
  /** Devuelve la fecha de cierre "YYYY-MM-DD", o nada si se cancela. */
  private readonly dialogRef = inject(
    MatDialogRef<CerrarKardexDialogComponent, string>,
  );

  readonly hoy = new Date();
  /** No se cierra antes de la apertura del propio kardex. */
  readonly minFecha = fechaBoliviaAInputDate(this.data.kardex.fechaApertura);
  readonly fecha = new FormControl<Date | null>(new Date(), [
    Validators.required,
  ]);

  confirmar(): void {
    if (this.fecha.invalid || !this.fecha.value) {
      this.fecha.markAsTouched();
      return;
    }
    this.dialogRef.close(formatFechaIso(this.fecha.value));
  }
}
