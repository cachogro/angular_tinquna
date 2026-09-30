// src/app/pages/contabilidad/services/boleta-pago.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  BoletaPago,
  BoletasPaginadas,
  EmitirBoletaRequest,
  FiltrosBoleta,
  PrepararBoletaResponse,
  ResumenBoletasMes,
} from '../models/boleta-pago.models';

@Injectable({ providedIn: 'root' })
export class BoletaPagoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/boleta-pago`;

  listar(filtros: FiltrosBoleta = {}): Observable<BoletasPaginadas> {
    let params = new HttpParams();
    if (filtros.page) params = params.set('page', filtros.page);
    if (filtros.limit) params = params.set('limit', filtros.limit);
    if (filtros.idPersona) params = params.set('idPersona', filtros.idPersona);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    return this.http.get<BoletasPaginadas>(this.baseUrl, { params });
  }

  /** Cuántos del personal ya cobraron en el mes y quiénes faltan. Sin
   *  gestion/mes, el mes actual. */
  resumen(gestion?: number, mes?: number): Observable<ResumenBoletasMes> {
    let params = new HttpParams();
    if (gestion) params = params.set('gestion', gestion);
    if (mes) params = params.set('mes', mes);
    return this.http.get<ResumenBoletasMes>(`${this.baseUrl}/resumen`, { params });
  }

  obtener(id: string): Observable<BoletaPago> {
    return this.http.get<BoletaPago>(`${this.baseUrl}/${id}`);
  }

  /** Salario, kardex PERSONAL y préstamos vigentes con el descuento sugerido. */
  preparar(idPersona: string): Observable<PrepararBoletaResponse> {
    return this.http.get<PrepararBoletaResponse>(
      `${this.baseUrl}/preparar/${idPersona}`,
    );
  }

  /** PDF de la boleta (Original + 2 copias). `interno = false` → versión
   *  solo de ley (sin préstamos, neto ni saldos). */
  obtenerPdf(id: string, interno = true): Observable<Blob> {
    let params = new HttpParams();
    if (!interno) params = params.set('interno', 'false');
    return this.http.get(`${this.baseUrl}/${id}/pdf`, {
      params,
      responseType: 'blob',
    });
  }

  /** Emite y paga la boleta (recibo por el neto + descuentos de préstamos). */
  emitir(data: EmitirBoletaRequest): Observable<BoletaPago> {
    return this.http.post<BoletaPago>(this.baseUrl, data);
  }
}
