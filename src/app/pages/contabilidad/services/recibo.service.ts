// src/app/pages/contabilidad/services/recibo.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  FiltrosRecibo,
  GenerarReciboRequest,
  ProcesarReciboRequest,
  Recibo,
  RecibosPaginados,
} from '../models/recibo.models';

@Injectable({ providedIn: 'root' })
export class ReciboService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/recibo`;

  /** Bandeja paginada; sin filtros trae todo (default page=1, limit=10). */
  listar(filtros: FiltrosRecibo): Observable<RecibosPaginados> {
    let params = new HttpParams();
    if (filtros.page != null) params = params.set('page', filtros.page);
    if (filtros.limit != null) params = params.set('limit', filtros.limit);
    if (filtros.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.idPersona) params = params.set('idPersona', filtros.idPersona);
    if (filtros.fechaDesde)
      params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta)
      params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);
    return this.http.get<RecibosPaginados>(this.baseUrl, { params });
  }

  obtener(id: string): Observable<Recibo> {
    return this.http.get<Recibo>(`${this.baseUrl}/${id}`);
  }

  /** PDF del recibo (disponible desde que existe, incluso en BORRADOR). */
  obtenerPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  /** POST — sin `detalles` crea un BORRADOR; con `detalles` crea y procesa
   *  en el acto (queda PROCESADO). */
  generar(data: GenerarReciboRequest): Observable<Recibo> {
    return this.http.post<Recibo>(this.baseUrl, data);
  }

  /** PATCH /:id/procesar — procesa un BORRADOR: puebla kardex + caja de flujo. */
  procesar(id: string, data: ProcesarReciboRequest): Observable<Recibo> {
    return this.http.patch<Recibo>(`${this.baseUrl}/${id}/procesar`, data);
  }

  /** PATCH /:id/anular — solo si el recibo sigue en BORRADOR. */
  anular(id: string): Observable<Recibo> {
    return this.http.patch<Recibo>(`${this.baseUrl}/${id}/anular`, {});
  }
}
