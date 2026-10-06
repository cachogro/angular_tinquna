import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Recibo } from '../../contabilidad/models/recibo.models';
import {
  ReciboFormDialogComponent,
  ReciboFormDialogData,
  ReciboFormModo,
} from '../../contabilidad/recibos/recibo-form-dialog/recibo-form-dialog.component';
import {
  RegistroMineral,
  nombreProveedorRecepcion,
} from '../models/registro-mineral.models';

/** Hay anticipo y el back no devolvió recibo vigente (BORRADOR/PROCESADO). */
export function faltaReciboAnticipo(r: RegistroMineral): boolean {
  return Number(r.anticipo) > 0 && !(r.recibos?.length);
}

/** El anticipo todavía no movió dinero: no tiene recibo, o el que tiene sigue
 *  en BORRADOR (se generó pero no se procesó). */
export function anticipoSinProcesar(r: RegistroMineral): boolean {
  if (!(Number(r.anticipo) > 0)) return false;
  const recibo = r.recibos?.[0];
  return !recibo || recibo.estado === 'BORRADOR';
}

/** Abre "Procesar recibo" sobre un recibo de anticipo que ya existe en
 *  BORRADOR. Recibe el recibo completo (GET /recibo/:id), no el resumen que
 *  viene en la recepción. Emite el recibo procesado, o undefined si se cerró. */
export function abrirProcesarBorradorAnticipo(
  dialog: MatDialog,
  recibo: Recibo,
): Observable<Recibo | boolean | undefined> {
  const data: ReciboFormDialogData = {
    tipo: recibo.tipo,
    modo: 'PROCESAR',
    recibo,
  };
  return dialog
    .open(ReciboFormDialogComponent, {
      data,
      width: '860px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'tema-contabilidad',
    })
    .afterClosed();
}

/** Abre el diálogo completo de recibo (EGRESO) precargado con los datos de la
 *  recepción y vinculado a ella vía `idRecepcionMineral`. Con modo 'GENERAR'
 *  queda en BORRADOR; con 'PROCESAR' se procesa en el acto (sin borrador).
 *  Emite el recibo creado, o undefined si se cerró sin guardar. */
export function abrirReciboAnticipo(
  dialog: MatDialog,
  registro: RegistroMineral,
  modo: ReciboFormModo = 'GENERAR',
): Observable<Recibo | boolean | undefined> {
  const data: ReciboFormDialogData = {
    tipo: 'EGRESO',
    modo,
    prefill: {
      fecha: (registro.fechaRecepcion ?? '').slice(0, 10),
      montoTotal: Number(registro.anticipo),
      concepto: `ANTICIPO RECEPCIÓN ${registro.codigoOperacion}`,
      idPersona: registro.idPersona,
      idActorProductivoMinero: registro.idActorProductivoMinero,
      nombreContraparte: nombreProveedorRecepcion(registro),
      idRecepcionMineral: registro.id,
    },
  };
  return dialog
    .open(ReciboFormDialogComponent, {
      data,
      // Procesar muestra además el reparto del recibo: mismo ancho que en la
      // bandeja de recibos.
      width: modo === 'PROCESAR' ? '860px' : '720px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'tema-contabilidad',
    })
    .afterClosed();
}
