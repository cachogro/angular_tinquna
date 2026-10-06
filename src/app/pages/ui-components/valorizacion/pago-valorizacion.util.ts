import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  PagoValorizacionDialogComponent,
  PagoValorizacionDialogData,
} from '../../contabilidad/pago-valorizacion/pago-valorizacion-dialog/pago-valorizacion-dialog.component';
import {
  ESTADO_VALORIZACION_VALORIZADO_ID,
  ValorizacionMineral,
} from '../models/valorizacion-mineral.models';

/** VALORIZADO y todavía sin pago. Las valorizaciones que se pagaron con el
 *  recibo de pago anterior (ya no se emite) cuentan como pagadas. */
export function faltaPagoValorizacion(v: ValorizacionMineral): boolean {
  return (
    v.idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO_ID &&
    !v.pagos?.length &&
    !v.recibos?.length
  );
}

/** Abre el pago de la valorización (transacción interna, sin recibo): para
 *  registrarlo, o para verlo y anularlo si ya existe. Emite true si se
 *  registró o anuló algo. */
export function abrirPagoValorizacion(
  dialog: MatDialog,
  v: ValorizacionMineral,
): Observable<boolean | undefined> {
  const data: PagoValorizacionDialogData = { idValorizacion: v.id };
  return dialog
    .open(PagoValorizacionDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'tema-contabilidad',
    })
    .afterClosed();
}
