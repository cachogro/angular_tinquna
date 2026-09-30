// src/app/pages/contabilidad/libreta-bancaria/saldo-inicial-dialog/saldo-inicial-dialog.component.ts
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
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MonedaCuentaBancaria,
  etiquetaMonedaCuenta,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

export interface SaldoInicialDialogData {
  idEntidad: number;
  nombreEntidad: string;
  siglaEntidad: string;
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuentaBancaria;
  saldoInicialActual?: string | null;
  fechaSaldoInicialActual?: string | null;
}

@Component({
  selector: 'app-saldo-inicial-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './saldo-inicial-dialog.component.html',
  styleUrl: './saldo-inicial-dialog.component.scss',
})
export class SaldoInicialDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<SaldoInicialDialogComponent>,
  );
  readonly data = inject<SaldoInicialDialogData>(MAT_DIALOG_DATA);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);

  readonly form = new FormGroup({
    saldoInicial: new FormControl<number | string | null>(null, [
      Validators.required,
      montoDosDecimales,
    ]),
    fecha: new FormControl<Date | null>(null, [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  get etiquetaMoneda(): string {
    return etiquetaMonedaCuenta(this.data.moneda);
  }

  ngOnInit(): void {
    // Sin fecha configurada = aún no se registró un saldo inicial real: el
    // campo arranca en blanco (aunque el back ya traiga "0.00" por defecto),
    // para que el usuario siempre sea quien lo escriba, incluso si es 0.
    const yaConfigurado = !!this.data.fechaSaldoInicialActual;
    const saldo = yaConfigurado ? Number(this.data.saldoInicialActual) : null;
    this.form.patchValue({
      saldoInicial: saldo != null && Number.isFinite(saldo) ? saldo : null,
      fecha: this.parseFecha(this.data.fechaSaldoInicialActual),
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  restringirEntradaNumerica(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (event.ctrlKey || event.metaKey) return;
    const teclasControl = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (teclasControl.includes(event.key)) return;
    if (event.key === '.') {
      if (target.value.includes('.')) event.preventDefault();
      return;
    }
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();

    this.parametricasService
      .guardarEntidadFinanciera({
        id: this.data.idEntidad,
        nombre: this.data.nombreEntidad,
        sigla: this.data.siglaEntidad,
        cuentas: [
          {
            id: this.data.idCuenta,
            numeroCuenta: this.data.numeroCuenta,
            moneda: this.data.moneda,
            saldoInicial: Number(v.saldoInicial),
            fechaSaldoInicial: this.formatFecha(v.fecha!),
          },
        ],
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open(
            `Saldo inicial en ${this.etiquetaMoneda} guardado`,
            'Cerrar',
            { duration: 3000 },
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.guardando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo guardar el saldo inicial',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }
}
