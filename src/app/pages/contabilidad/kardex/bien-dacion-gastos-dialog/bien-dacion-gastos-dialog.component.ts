// src/app/pages/contabilidad/kardex/bien-dacion-gastos-dialog/bien-dacion-gastos-dialog.component.ts
// Gastos que la empresa le invierte a un bien TOMADO EN PAGO (cambio de
// nombre, arreglos, pintura...). Cada uno es un egreso directo de la caja de
// flujo o de la libreta bancaria, sin recibo, y no toca el kardex del dueño.
// Con el bien ya VENDIDO el diálogo queda solo de consulta.
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
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import {
  BienDacionPago,
  GastoBienDacion,
} from '../../models/bien-dacion-pago.models';
import { BienDacionPagoService } from '../../services/bien-dacion-pago.service';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';
import {
  fechaFmt,
  formatFechaIso,
  num,
} from '../../components/personal-interno.util';

export interface BienDacionGastosDialogData {
  bien: BienDacionPago;
  nombreDestinatario: string;
}

@Component({
  selector: 'app-bien-dacion-gastos-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    FechaInputDirective,
    MontoInputDirective,
    MayusculasDirective,
    DatosPagoFieldsComponent,
  ],
  templateUrl: './bien-dacion-gastos-dialog.component.html',
  styleUrl: './bien-dacion-gastos-dialog.component.scss',
})
export class BienDacionGastosDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<BienDacionGastosDialogComponent>,
  );
  readonly data = inject<BienDacionGastosDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(BienDacionPagoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly bien = signal<BienDacionPago>(this.data.bien);
  readonly guardando = signal(false);
  /** Muestra el formulario de alta. */
  readonly agregando = signal(false);
  private huboCambios = false;

  readonly columnas = ['fecha', 'concepto', 'destino', 'medio', 'monto', 'acciones'];
  readonly hoy = new Date();
  /** Un gasto no puede ser anterior a la toma en pago del bien. */
  readonly minFecha: Date | null = this.data.bien.fechaTomaPago
    ? this.parseIso(this.data.bien.fechaTomaPago)
    : null;

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
    concepto: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    monto: new FormControl<number | string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
  });
  pago = crearFormDatosPago();

  num = num;
  fechaFmt = fechaFmt;

  /** Solo se cargan o anulan gastos mientras el bien es de la empresa y no se vendió. */
  get editable(): boolean {
    return this.bien().estado === 'TOMADO_EN_PAGO';
  }

  get gastos(): GastoBienDacion[] {
    return this.bien().gastos ?? [];
  }

  medio(g: GastoBienDacion): string {
    return g.idLibretaBanco ? 'Libreta bancaria' : 'Caja de flujo';
  }

  nuevoGasto(): void {
    this.form.reset({ fecha: new Date(), concepto: '', monto: null });
    this.pago = crearFormDatosPago();
    this.agregando.set(true);
  }

  cancelarAlta(): void {
    this.agregando.set(false);
  }

  guardar(): void {
    if (this.form.invalid || this.pago.invalid) {
      this.form.markAllAsTouched();
      this.pago.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.service
      .registrarGasto(this.bien().id, {
        ...leerDatosPago(this.pago),
        fecha: formatFechaIso(v.fecha!),
        concepto: (v.concepto ?? '').trim(),
        monto: Number(v.monto),
      })
      .subscribe({
        next: (bien) => {
          this.guardando.set(false);
          this.bien.set(bien);
          this.huboCambios = true;
          this.agregando.set(false);
          this.snackBar.open('Gasto registrado: egreso cargado a caja o libreta', 'Cerrar', {
            duration: 3500,
          });
        },
        error: (err) => {
          this.guardando.set(false);
          const m = err?.error?.message;
          this.snackBar.open(
            (Array.isArray(m) ? m.join('. ') : m) ?? 'No se pudo registrar el gasto',
            'Cerrar',
            { duration: 6000 },
          );
        },
      });
  }

  anular(g: GastoBienDacion): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Anular gasto',
          message: `¿Confirmas anular el gasto "${g.concepto}" por ${num(g.monto).toFixed(2)}? Se anula también su egreso en ${this.medio(g).toLowerCase()}.`,
          confirmLabel: 'Anular',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.service.anularGasto(g.id).subscribe({
          next: (bien) => {
            this.bien.set(bien);
            this.huboCambios = true;
            this.snackBar.open('Gasto anulado', 'Cerrar', { duration: 3000 });
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo anular el gasto',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }

  private parseIso(iso: string): Date {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
  }
}
