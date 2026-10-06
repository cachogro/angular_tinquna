import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Recibo } from '../../contabilidad/models/recibo.models';
import {
  ReciboFormDialogComponent,
  ReciboFormDialogData,
  ReciboPrefill,
} from '../../contabilidad/recibos/recibo-form-dialog/recibo-form-dialog.component';
import { VentaLote } from '../models/venta-lote.models';
import {
  VentaLoteFormDialogComponent,
  VentaLoteFormDialogData,
} from './venta-lote-form-dialog/venta-lote-form-dialog.component';
import { VentaLoteLiquidarDialogComponent } from './venta-lote-liquidar-dialog/venta-lote-liquidar-dialog.component';

/** En comercio interno el dinero no se cobra por lote: entra a la cuenta
 *  corriente del cliente y paga los lotes a medida que se liquidan. */
export function esVentaCuentaCorriente(v: VentaLote): boolean {
  return v.modalidadVenta === 'COMERCIO_INTERNO';
}

/** Cobro propio del lote: solo exportación, mientras no esté anulada ni
 *  pagada del todo. */
export function puedeCobrarVentaLote(v: VentaLote): boolean {
  return !esVentaCuentaCorriente(v) && v.estado !== 'ANULADA' && !v.pagada;
}

/** Abre "Vender lote"; con `idCliente` deja ese cliente elegido y fijo.
 *  Emite la venta creada, o undefined si se cerró sin guardar. */
export function abrirVenderLote(
  dialog: MatDialog,
  idCliente?: string,
): Observable<VentaLote | undefined> {
  const data: VentaLoteFormDialogData = { idCliente };
  return dialog
    .open(VentaLoteFormDialogComponent, {
      data,
      width: '640px',
      maxWidth: '95vw',
      autoFocus: false,
    })
    .afterClosed();
}

/** Abre "Registrar liquidación" del lote. Emite la venta liquidada, o
 *  undefined si se cerró sin guardar. */
export function abrirLiquidarVentaLote(
  dialog: MatDialog,
  venta: VentaLote,
): Observable<VentaLote | undefined> {
  return dialog
    .open(VentaLoteLiquidarDialogComponent, {
      data: venta,
      width: '560px',
      maxWidth: '95vw',
      autoFocus: false,
    })
    .afterClosed();
}

function abrirRecibo(
  dialog: MatDialog,
  prefill: ReciboPrefill,
): Observable<Recibo | boolean | undefined> {
  const data: ReciboFormDialogData = {
    tipo: 'INGRESO',
    modo: 'PROCESAR',
    prefill,
  };
  return dialog
    .open(ReciboFormDialogComponent, {
      data,
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'tema-contabilidad',
    })
    .afterClosed();
}

/** Abre el diálogo de recibo en modo PROCESAR (queda PROCESADO de una vez):
 *  INGRESO a nombre del cliente, todo el monto a su kardex con el código de
 *  lote, y a caja o libreta según la forma de pago. Si la venta ya está
 *  liquidada, precarga lo que falta cobrar (en Bs). Emite el recibo creado o
 *  undefined si se cerró sin guardar. */
export function abrirCobroVentaLote(
  dialog: MatDialog,
  v: VentaLote,
): Observable<Recibo | boolean | undefined> {
  const lote = v.codigoLote ?? `#${v.id}`;
  const falta = v.porCobrarBolivianos;
  return abrirRecibo(dialog, {
    fecha: '',
    montoTotal: v.estado === 'LIQUIDADA' && falta != null && falta > 0 && v.moneda === 'BS' ? falta : null,
    concepto: `${v.estado === 'LIQUIDADA' ? 'PAGO' : 'ANTICIPO'} VENTA LOTE ${lote}`,
    idVentaLote: v.id,
    idCliente: v.idCliente,
    lote,
    moneda: v.moneda,
    tipoCambio: v.tipoCambio,
  });
}

/** Anticipo a la cuenta del cliente, sin atarlo a un lote: va a su kardex y
 *  paga sus lotes liquidados del más antiguo al más nuevo. */
export function abrirAnticipoCliente(
  dialog: MatDialog,
  cliente: { id: string; nombre: string },
): Observable<Recibo | boolean | undefined> {
  return abrirRecibo(dialog, {
    fecha: '',
    montoTotal: null,
    concepto: `ANTICIPO ${cliente.nombre}`,
    idCliente: cliente.id,
  });
}
