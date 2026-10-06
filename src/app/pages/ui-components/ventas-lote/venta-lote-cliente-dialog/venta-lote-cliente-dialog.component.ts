// src/app/pages/ui-components/ventas-lote/venta-lote-cliente-dialog/venta-lote-cliente-dialog.component.ts
// Cuenta corriente de un cliente comprador: anticipos recibidos vs lotes
// liquidados, cuánto le paga la cuenta a cada lote y los movimientos de su
// kardex con saldo corrido. Desde acá se registran anticipos, se le venden
// lotes y se liquidan.
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReciboService } from 'src/app/pages/contabilidad/services/recibo.service';
import { fechaFmt } from 'src/app/pages/contabilidad/components/personal-interno.util';
import { abrirBlobEnPestana } from 'src/app/shared/utils/descarga-archivo.util';
import { cerrarDevolviendo } from 'src/app/shared/utils/dialogo.util';
import {
  CuentaClienteDetalle,
  MovimientoCuentaCliente,
  VentaLote,
} from '../../models/venta-lote.models';
import { VentaLoteService } from '../../services/venta-lote.service';
import {
  abrirAnticipoCliente,
  abrirLiquidarVentaLote,
  abrirVenderLote,
} from '../cobro-venta-lote.util';
import { VentaLoteDetalleDialogComponent } from '../venta-lote-detalle-dialog/venta-lote-detalle-dialog.component';

@Component({
  selector: 'app-venta-lote-cliente-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './venta-lote-cliente-dialog.component.html',
  styleUrl: './venta-lote-cliente-dialog.component.scss',
})
export class VentaLoteClienteDialogComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<VentaLoteClienteDialogComponent, boolean>
  >(MatDialogRef);
  private readonly idCliente = inject<string>(MAT_DIALOG_DATA);
  private readonly ventaService = inject(VentaLoteService);
  private readonly reciboService = inject(ReciboService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly detalle = signal<CuentaClienteDetalle | null>(null);
  /** Para que la bandeja recargue al cerrar si algo cambió. */
  private huboCambios = false;

  constructor() {
    cerrarDevolviendo(this.dialogRef, () => this.huboCambios);
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.ventaService.cuentaCliente(this.idCliente).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar la cuenta del cliente',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  private recargar(): void {
    this.huboCambios = true;
    this.cargar();
  }

  registrarAnticipo(d: CuentaClienteDetalle): void {
    abrirAnticipoCliente(this.dialog, d.cliente).subscribe((recibo) => {
      if (recibo) this.recargar();
    });
  }

  venderLote(d: CuentaClienteDetalle): void {
    abrirVenderLote(this.dialog, d.cliente.id).subscribe((venta) => {
      if (venta) this.recargar();
    });
  }

  verLote(v: VentaLote): void {
    this.dialog
      .open(VentaLoteDetalleDialogComponent, {
        data: v.id,
        width: '980px',
        maxWidth: '96vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((cambios) => {
        if (cambios) this.recargar();
      });
  }

  liquidar(v: VentaLote): void {
    abrirLiquidarVentaLote(this.dialog, v).subscribe((venta) => {
      if (venta) this.recargar();
    });
  }

  verPdf(m: MovimientoCuentaCliente): void {
    if (!m.idRecibo) return;
    this.reciboService.obtenerPdf(m.idRecibo).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo generar el PDF del recibo',
          'Cerrar',
          { duration: 4000 },
        ),
    });
  }

  // ---------- Presentación ----------

  esInterno(d: CuentaClienteDetalle): boolean {
    return d.cuenta.modalidadVenta === 'COMERCIO_INTERNO';
  }

  etiquetaEstado(v: VentaLote): string {
    if (v.pagada) return 'PAGADO';
    return v.estado === 'ABIERTA' ? 'SIN LIQUIDAR' : 'POR PAGAR';
  }

  /** Estimado propio del lote en Bs (en $us, × tipo de cambio de la venta). */
  estimadoBs(v: VentaLote): number | null {
    if (v.montoEstimado == null) return null;
    const tc = v.moneda === 'USD' ? Number(v.tipoCambio ?? 0) : 1;
    return Math.round(Number(v.montoEstimado) * tc * 100) / 100;
  }

  etiquetaTipo(m: MovimientoCuentaCliente): string {
    return m.tipo === 'ANTICIPO' ? 'Anticipo' : m.tipo === 'LOTE' ? 'Lote liquidado' : 'Cargo';
  }

  abs(n: number | null | undefined): number {
    return Math.abs(Number(n ?? 0));
  }

  readonly fechaFmt = fechaFmt;

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
