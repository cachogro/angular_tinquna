// src/app/pages/ui-components/ventas-lote/venta-lote-liquidar-dialog/venta-lote-liquidar-dialog.component.ts
// Registra la liquidación final (neta) del comprador: la venta pasa a
// LIQUIDADA y el monto (en Bs) se carga como DEBE en el kardex del cliente,
// que los anticipos ya registrados van cancelando.
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { FechaInputDirective } from 'src/app/shared/directives/fecha-input.directive';
import { MontoInputDirective } from 'src/app/shared/directives/monto-input.directive';
import {
  montoDosDecimales,
  tipoCambioCuatroDecimales,
} from 'src/app/shared/utils/numero.util';
import { formatFechaIso } from 'src/app/pages/contabilidad/components/personal-interno.util';
import {
  LiquidarVentaLoteRequest,
  VentaLote,
} from '../../models/venta-lote.models';
import { VentaLoteService } from '../../services/venta-lote.service';

@Component({
  selector: 'app-venta-lote-liquidar-dialog',
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
    MontoInputDirective,
  ],
  templateUrl: './venta-lote-liquidar-dialog.component.html',
  styleUrl: './venta-lote-liquidar-dialog.component.scss',
})
export class VentaLoteLiquidarDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<VentaLoteLiquidarDialogComponent>);
  readonly venta = inject<VentaLote>(MAT_DIALOG_DATA);
  private readonly ventaService = inject(VentaLoteService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);
  readonly hoy = new Date();
  readonly esUsd = this.venta.moneda === 'USD';
  readonly simbolo = this.esUsd ? '$us' : 'Bs';

  readonly form = new FormGroup({
    montoVenta: new FormControl<string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    tipoCambio: new FormControl<string | null>(
      this.venta.tipoCambio != null ? String(this.venta.tipoCambio) : null,
      this.esUsd
        ? [Validators.required, tipoCambioCuatroDecimales, Validators.min(0.0001)]
        : [],
    ),
    fechaLiquidacion: new FormControl<Date | null>(new Date(), [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Monto de la liquidación en Bs (en USD, × tipo de cambio). */
  readonly montoBs = computed(() => {
    const v = this.valores();
    const monto = Number(v.montoVenta);
    if (!Number.isFinite(monto) || monto <= 0) return 0;
    const tc = this.esUsd ? Number(v.tipoCambio) : 1;
    return Number.isFinite(tc) && tc > 0 ? Math.round(monto * tc * 100) / 100 : 0;
  });

  readonly utilidad = computed(() =>
    this.montoBs() > 0 ? this.montoBs() - Number(this.venta.totalEfectivoInvertido) : null,
  );

  readonly porCobrar = computed(() =>
    this.montoBs() > 0 ? this.montoBs() - Number(this.venta.cobradoBolivianos) : null,
  );

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const req: LiquidarVentaLoteRequest = {
      montoVenta: Number(v.montoVenta),
      fechaLiquidacion: formatFechaIso(v.fechaLiquidacion!),
    };
    if (this.esUsd) req.tipoCambio = Number(v.tipoCambio);

    this.guardando.set(true);
    this.ventaService.liquidar(this.venta.id, req).subscribe({
      next: (venta) => {
        this.guardando.set(false);
        this.snackBar.open('Liquidación registrada', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(venta);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo registrar la liquidación',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
