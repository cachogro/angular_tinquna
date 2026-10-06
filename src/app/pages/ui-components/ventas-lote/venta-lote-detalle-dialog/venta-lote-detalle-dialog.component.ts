// src/app/pages/ui-components/ventas-lote/venta-lote-detalle-dialog/venta-lote-detalle-dialog.component.ts
// Seguimiento de una venta de lote: invertido vs cobrado vs liquidación, y
// la lista de recibos (anticipos/pagos) con acceso al PDF. Desde acá se
// registran cobros, la liquidación final y su reapertura.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { MontoInputDirective } from 'src/app/shared/directives/monto-input.directive';
import { montoDosDecimales } from 'src/app/shared/utils/numero.util';
import { Recibo } from 'src/app/pages/contabilidad/models/recibo.models';
import { ReciboService } from 'src/app/pages/contabilidad/services/recibo.service';
import { fechaFmt } from 'src/app/pages/contabilidad/components/personal-interno.util';
import { abrirBlobEnPestana } from 'src/app/shared/utils/descarga-archivo.util';
import { cerrarDevolviendo } from 'src/app/shared/utils/dialogo.util';
import { VentaLote } from '../../models/venta-lote.models';
import { VentaLoteService } from '../../services/venta-lote.service';
import {
  abrirAnticipoCliente,
  abrirCobroVentaLote,
  abrirLiquidarVentaLote,
  esVentaCuentaCorriente,
  puedeCobrarVentaLote,
} from '../cobro-venta-lote.util';

@Component({
  selector: 'app-venta-lote-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MontoInputDirective,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './venta-lote-detalle-dialog.component.html',
  styleUrl: './venta-lote-detalle-dialog.component.scss',
})
export class VentaLoteDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<VentaLoteDetalleDialogComponent, boolean>
  >(MatDialogRef);
  private readonly idVenta = inject<string>(MAT_DIALOG_DATA);
  private readonly ventaService = inject(VentaLoteService);
  private readonly reciboService = inject(ReciboService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly venta = signal<VentaLote | null>(null);
  /** Para que la bandeja recargue al cerrar si algo cambió. */
  private huboCambios = false;

  // Estimación propia de la valorización: se edita en la misma tarjeta.
  readonly editandoEstimado = signal(false);
  readonly guardandoEstimado = signal(false);
  readonly estimadoControl = new FormControl<string | null>(null, [
    montoDosDecimales,
    Validators.min(0.01),
  ]);
  /** Lo tecleado, como señal: la leyenda de comparación lo sigue en vivo. */
  private readonly estimadoTexto = toSignal(this.estimadoControl.valueChanges, {
    initialValue: null,
  });

  constructor() {
    cerrarDevolviendo(this.dialogRef, () => this.huboCambios);
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.ventaService.obtener(this.idVenta).subscribe({
      next: (v) => {
        this.venta.set(v);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar la venta',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  simbolo(v: VentaLote): string {
    return v.moneda === 'USD' ? '$us' : 'Bs';
  }

  /** Estimado vigente para la leyenda: lo tecleado mientras se edita, si no
   *  el guardado. null = sin estimado válido. */
  private estimadoVista(v: VentaLote): number | null {
    const estimado = Number(
      this.editandoEstimado() ? this.estimadoTexto() : v.montoEstimado,
    );
    return estimado > 0 ? estimado : null;
  }

  /** Liquidación − estimado, en la moneda de la venta (mismo cálculo que el
   *  back); null si falta la liquidación o el estimado. */
  diferenciaEstimado(v: VentaLote): number | null {
    const estimado = this.estimadoVista(v);
    if (v.estado !== 'LIQUIDADA' || v.montoVenta == null || estimado == null) {
      return null;
    }
    return Math.round((Number(v.montoVenta) - estimado) * 100) / 100;
  }

  /** Cuánto se apartó la liquidación de lo estimado, en % del estimado. */
  diferenciaPorcentaje(v: VentaLote): number {
    const estimado = this.estimadoVista(v);
    const diferencia = this.diferenciaEstimado(v);
    if (estimado == null || diferencia == null) return 0;
    return (Math.abs(diferencia) / estimado) * 100;
  }

  editarEstimado(v: VentaLote): void {
    this.estimadoControl.reset(
      v.montoEstimado != null ? String(v.montoEstimado) : null,
    );
    this.editandoEstimado.set(true);
  }

  cancelarEstimado(): void {
    this.editandoEstimado.set(false);
  }

  /** Vacío quita la estimación; el monto no mueve kardex ni caja. */
  guardarEstimado(v: VentaLote): void {
    if (this.guardandoEstimado()) return;
    const texto = (this.estimadoControl.value ?? '').trim();
    if (texto && this.estimadoControl.invalid) {
      this.estimadoControl.markAsTouched();
      return;
    }
    const monto = texto ? Number(texto) : null;
    if (monto === (v.montoEstimado ?? null)) {
      this.editandoEstimado.set(false);
      return;
    }

    this.guardandoEstimado.set(true);
    this.ventaService.estimar(v.id, monto).subscribe({
      next: (actualizada) => {
        this.guardandoEstimado.set(false);
        this.editandoEstimado.set(false);
        this.huboCambios = true;
        this.venta.set(actualizada);
        this.snackBar.open(
          monto == null ? 'Estimación quitada' : 'Monto estimado guardado',
          'Cerrar',
          { duration: 3000 },
        );
      },
      error: (err) => {
        this.guardandoEstimado.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo guardar el monto estimado',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  puedeCobrar(v: VentaLote): boolean {
    return puedeCobrarVentaLote(v);
  }

  /** Comercio interno: el lote lo pagan los anticipos del cliente. */
  cuentaCorriente(v: VentaLote): boolean {
    return esVentaCuentaCorriente(v);
  }

  registrarAnticipoCliente(v: VentaLote): void {
    abrirAnticipoCliente(this.dialog, {
      id: v.idCliente,
      nombre: v.cliente?.nombre ?? '',
    }).subscribe((recibo) => {
      if (!recibo) return;
      this.huboCambios = true;
      this.cargar();
    });
  }

  /** % cobrado respecto de la venta (liquidada) o de lo invertido (abierta). */
  avance(v: VentaLote): number {
    const base =
      v.estado === 'LIQUIDADA' && v.montoVentaBolivianos
        ? Number(v.montoVentaBolivianos)
        : Number(v.totalEfectivoInvertido);
    if (!(base > 0)) return 0;
    return Math.min(100, (Number(v.cobradoBolivianos) / base) * 100);
  }

  registrarCobro(v: VentaLote): void {
    abrirCobroVentaLote(this.dialog, v).subscribe((recibo) => {
      if (!recibo) return;
      this.huboCambios = true;
      this.cargar();
    });
  }

  liquidar(v: VentaLote): void {
    abrirLiquidarVentaLote(this.dialog, v).subscribe((venta) => {
      if (!venta) return;
      this.huboCambios = true;
      this.cargar();
    });
  }

  reabrir(v: VentaLote): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `¿Reabrir la venta del lote ${v.codigoLote}?`,
          message:
            'Se quita la liquidación y su cargo en el kardex del cliente, para volver a registrarla con el monto correcto. Los cobros no se tocan.',
          confirmLabel: 'Sí, reabrir',
          icon: 'lock_open',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.ventaService.reabrir(v.id).subscribe({
          next: (actualizada) => {
            this.huboCambios = true;
            this.venta.set(actualizada);
            this.snackBar.open('Venta reabierta', 'Cerrar', { duration: 3000 });
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo reabrir la venta',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  verPdf(r: Recibo): void {
    this.reciboService.obtenerPdf(r.id).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo generar el PDF del recibo',
          'Cerrar',
          { duration: 4000 },
        ),
    });
  }

  codigoRecibo(r: Recibo): string {
    return `${r.serie}-${String(r.numero).padStart(4, '0')}`;
  }

  /** Monto del recibo en Bs (USD × su tipo de cambio). */
  montoBs(r: Recibo): number {
    const m = Number(r.montoTotal);
    return r.moneda === 'USD' ? Math.round(m * Number(r.tipoCambio) * 100) / 100 : m;
  }

  readonly fechaFmt = fechaFmt;

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
