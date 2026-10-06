// src/app/pages/contabilidad/services/pago-valorizacion.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  PagoValorizacion,
  PrepararPagoValorizacion,
  RegistrarPagoValorizacionRequest,
} from '../models/pago-valorizacion.models';

@Injectable({ providedIn: 'root' })
export class PagoValorizacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/pago-valorizacion`;

  /** Montos de la valorización, kardex del anticipo y pago vigente (si hay). */
  preparar(idValorizacion: string): Observable<PrepararPagoValorizacion> {
    return this.http.get<PrepararPagoValorizacion>(
      `${this.baseUrl}/preparar/${idValorizacion}`,
    );
  }

  /** Registra el pago: egreso de caja/libreta + HABER en los kardex. */
  registrar(data: RegistrarPagoValorizacionRequest): Observable<PagoValorizacion> {
    return this.http.post<PagoValorizacion>(this.baseUrl, data);
  }

  /** Da de baja los movimientos del pago; la valorización queda sin pagar. */
  anular(id: string): Observable<PagoValorizacion> {
    return this.http.patch<PagoValorizacion>(`${this.baseUrl}/${id}/anular`, {});
  }
}
