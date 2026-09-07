// src/app/pages/contabilidad/libreta-bancaria/saldo-inicial-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MonedaCuenta } from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';

export interface SaldoInicialDialogData {
  idEntidad: number;
  nombreEntidad: string;
  siglaEntidad: string;
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuenta;
  saldoInicialActual?: string | null;
  fechaSaldoInicialActual?: string | null;
}

@Component({
  selector: 'app-saldo-inicial-dialog',
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
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ],
  template: `
    <h2 mat-dialog-title>Saldo inicial de la cuenta</h2>

    <mat-dialog-content>
      <p class="si-cuenta">
        {{ data.nombreEntidad }} · {{ data.numeroCuenta }} ({{ data.moneda }})
      </p>
      <form [formGroup]="form" class="si-form">
        <mat-form-field appearance="outline">
          <mat-label>Saldo inicial (Bs)</mat-label>
          <input matInput type="number" step="0.01" formControlName="saldoInicial" />
          @if (f.saldoInicial.hasError('required') && f.saldoInicial.touched) {
          <mat-error>Obligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fecha del saldo inicial</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="fecha" readonly
            (click)="picker.open()" />
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          @if (f.fecha.hasError('required') && f.fecha.touched) {
          <mat-error>Obligatorio</mat-error>
          }
        </mat-form-field>
      </form>
      <p class="si-nota">
        Se registra una sola vez, antes de cargar movimientos. El saldo del primer
        período parte de este valor.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancelar()" [disabled]="guardando()">
        Cancelar
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="guardar()"
        [disabled]="guardando()"
      >
        @if (guardando()) {
        <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        <span>Guardando...</span>
        } @else {
        <span>Guardar</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .si-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 360px;
      }
      .si-form mat-form-field {
        width: 100%;
      }
      .si-cuenta {
        font-weight: 600;
        margin: 0 0 12px;
      }
      .si-nota {
        color: rgba(0, 0, 0, 0.55);
        font-size: 12px;
        margin: 8px 0 0;
      }
      .btn-spinner {
        display: inline-block;
      }
      .btn-spinner ::ng-deep circle {
        stroke: currentColor;
      }
      @media (max-width: 480px) {
        .si-form {
          min-width: 0;
        }
      }
    `,
  ],
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
    saldoInicial: new FormControl<number | null>(null, [Validators.required]),
    fecha: new FormControl<Date | null>(null, [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    const saldo = Number(this.data.saldoInicialActual ?? 0);
    this.form.patchValue({
      saldoInicial: Number.isFinite(saldo) ? saldo : 0,
      fecha: this.parseFecha(this.data.fechaSaldoInicialActual),
    });
  }

  cancelar(): void {
    this.dialogRef.close();
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
          this.snackBar.open('Saldo inicial guardado', 'Cerrar', {
            duration: 3000,
          });
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
