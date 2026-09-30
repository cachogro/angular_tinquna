import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Recibo } from '../../contabilidad/models/recibo.models';
import {
  ReciboFormDialogComponent,
  ReciboFormDialogData,
} from '../../contabilidad/recibos/recibo-form-dialog/recibo-form-dialog.component';
import { VentaLote } from '../models/venta-lote.models';

/** Se puede cobrar mientras no esté anulada ni pagada del todo. */
export function puedeCobrarVentaLote(v: VentaLote): boolean {
  return v.estado !== 'ANULADA' && !v.pagada;
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
  const data: ReciboFormDialogData = {
    tipo: 'INGRESO',
    modo: 'PROCESAR',
    prefill: {
      fecha: '',
      montoTotal: v.estado === 'LIQUIDADA' && falta != null && falta > 0 && v.moneda === 'BS' ? falta : null,
      concepto: `${v.estado === 'LIQUIDADA' ? 'PAGO' : 'ANTICIPO'} VENTA LOTE ${lote}`,
      idVentaLote: v.id,
      idCliente: v.idCliente,
      lote,
      moneda: v.moneda,
      tipoCambio: v.tipoCambio,
    },
  };
  return dialog
    .open(ReciboFormDialogComponent, {
      data,
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
    })
    .afterClosed();
}
