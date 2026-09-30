import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Recibo } from '../../contabilidad/models/recibo.models';
import {
  ReciboFormDialogComponent,
  ReciboFormDialogData,
} from '../../contabilidad/recibos/recibo-form-dialog/recibo-form-dialog.component';
import { RegistroMineral } from '../models/registro-mineral.models';

/** Hay anticipo y el back no devolvió recibo vigente (BORRADOR/PROCESADO). */
export function faltaReciboAnticipo(r: RegistroMineral): boolean {
  return Number(r.anticipo) > 0 && !(r.recibos?.length);
}

/** Abre el diálogo completo de recibo (EGRESO, borrador) precargado con los
 *  datos de la recepción y vinculado a ella vía `idRecepcionMineral`.
 *  Emite el recibo creado, o undefined si se cerró sin guardar. */
export function abrirReciboAnticipo(
  dialog: MatDialog,
  registro: RegistroMineral,
): Observable<Recibo | boolean | undefined> {
  const data: ReciboFormDialogData = {
    tipo: 'EGRESO',
    modo: 'GENERAR',
    prefill: {
      fecha: (registro.fechaRecepcion ?? '').slice(0, 10),
      montoTotal: Number(registro.anticipo),
      concepto: `ANTICIPO RECEPCIÓN ${registro.codigoOperacion}`,
      idPersona: registro.idPersona,
      idRecepcionMineral: registro.id,
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
