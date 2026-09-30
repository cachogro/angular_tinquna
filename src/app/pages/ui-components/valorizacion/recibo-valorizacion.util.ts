import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Recibo } from '../../contabilidad/models/recibo.models';
import {
  ReciboFormDialogComponent,
  ReciboFormDialogData,
} from '../../contabilidad/recibos/recibo-form-dialog/recibo-form-dialog.component';
import {
  ESTADO_VALORIZACION_VALORIZADO_ID,
  ValorizacionMineral,
} from '../models/valorizacion-mineral.models';

/** Líquido pagable (Bs) redondeado a 2 decimales, igual que lo compara el back. */
function saldoAPagar(v: ValorizacionMineral): number {
  return Math.round(Number(v.totalValorLiquidoVentaBolivianos ?? 0) * 100) / 100;
}

/** VALORIZADO, con saldo a pagar y sin recibo vigente (BORRADOR/PROCESADO). */
export function faltaReciboValorizacion(v: ValorizacionMineral): boolean {
  return (
    v.idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO_ID &&
    saldoAPagar(v) > 0 &&
    !v.recibos?.length
  );
}

/** Abre el diálogo completo de recibo (EGRESO, borrador) precargado con el
 *  líquido pagable de la valorización y vinculado a ella vía
 *  `idValorizacionMineral`. Mismo flujo que el anticipo de recepción (ver
 *  recepcion-mineral/recibo-anticipo.util). Emite el recibo creado, o
 *  undefined si se cerró sin guardar. */
export function abrirReciboValorizacion(
  dialog: MatDialog,
  v: ValorizacionMineral,
): Observable<Recibo | boolean | undefined> {
  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const data: ReciboFormDialogData = {
    tipo: 'EGRESO',
    modo: 'GENERAR',
    prefill: {
      fecha: (v.fechaValorizacion ?? fechaHoy).slice(0, 10),
      montoTotal: saldoAPagar(v),
      concepto: `PAGO VALORIZACIÓN ${v.recepcionMineral?.codigoOperacion ?? ''}`.trim(),
      idPersona: v.recepcionMineral?.idPersona,
      idValorizacionMineral: v.id,
    },
  };
  return dialog
    .open(ReciboFormDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
    })
    .afterClosed();
}
