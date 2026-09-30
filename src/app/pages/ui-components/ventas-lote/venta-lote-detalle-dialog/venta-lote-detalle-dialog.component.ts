// src/app/pages/ui-components/ventas-lote/venta-lote-detalle-dialog/venta-lote-detalle-dialog.component.ts
// Seguimiento de una venta de lote: invertido vs cobrado vs liquidación, y
// la lista de recibos (anticipos/pagos) con acceso al PDF. Desde acá se
// registran cobros, la liquidación final y su reapertura.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { Recibo } from 'src/app/pages/contabilidad/models/recibo.models';
import { ReciboService } from 'src/app/pages/contabilidad/services/recibo.service';
import { VentaLote } from '../../models/venta-lote.models';
import { VentaLoteService } from '../../services/venta-lote.service';
import {
  abrirCobroVentaLote,
  puedeCobrarVentaLote,
} from '../cobro-venta-lote.util';
import { VentaLoteLiquidarDialogComponent } from '../venta-lote-liquidar-dialog/venta-lote-liquidar-dialog.component';

@Component({
  selector: 'app-venta-lote-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
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
  private readonly dialogRef = inject(MatDialogRef<VentaLoteDetalleDialogComponent>);
  private readonly idVenta = inject<string>(MAT_DIALOG_DATA);
  private readonly ventaService = inject(VentaLoteService);
  private readonly reciboService = inject(ReciboService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly venta = signal<VentaLote | null>(null);
  /** Para que la bandeja recargue al cerrar si algo cambió. */
  private huboCambios = false;

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

  puedeCobrar(v: VentaLote): boolean {
    return puedeCobrarVentaLote(v);
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
    this.dialog
      .open(VentaLoteLiquidarDialogComponent, {
        data: v,
        width: '560px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((res) => {
        if (!res) return;
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
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      },
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

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
