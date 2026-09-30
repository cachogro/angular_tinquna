// src/app/pages/contabilidad/services/traspaso.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  FiltroLibroTraspasos,
  FiltroTraspasoRequest,
  GuardarTraspasoRequest,
  Traspaso,
  TraspasosPaginados,
} from '../models/traspaso.models';

@Injectable({ providedIn: 'root' })
export class TraspasoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/traspaso`;

  /** Paginado: sin page/limit el back devuelve solo los primeros 10. */
  listar(filtro: FiltroTraspasoRequest = {}): Observable<TraspasosPaginados> {
    let params = new HttpParams();
    if (filtro.page) params = params.set('page', filtro.page);
    if (filtro.limit) params = params.set('limit', filtro.limit);
    if (filtro.idCaja != null) params = params.set('idCaja', filtro.idCaja);
    if (filtro.idCuentaBancaria != null)
      params = params.set('idCuentaBancaria', filtro.idCuentaBancaria);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.gestion != null) params = params.set('gestion', filtro.gestion);
    if (filtro.busqueda) params = params.set('busqueda', filtro.busqueda);
    if (filtro.orderBy) params = params.set('orderBy', filtro.orderBy);
    if (filtro.orderDirection)
      params = params.set('orderDirection', filtro.orderDirection);
    return this.http.get<TraspasosPaginados>(this.baseUrl, { params });
  }

  obtener(id: string): Observable<Traspaso> {
    return this.http.get<Traspaso>(`${this.baseUrl}/${id}`);
  }

  /** Sin `id` crea el traspaso (y ambos movimientos); con `id` lo actualiza. */
  guardar(data: GuardarTraspasoRequest): Observable<Traspaso> {
    return this.http.post<Traspaso>(this.baseUrl, data);
  }

  /** Excel "Libro de traspasos caja - banco" con los filtros dados. */
  descargarLibroExcel(filtro: FiltroLibroTraspasos): Observable<Blob> {
    let params = new HttpParams();
    if (filtro.idCuentaBancaria != null)
      params = params.set('idCuentaBancaria', filtro.idCuentaBancaria);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.moneda) params = params.set('moneda', filtro.moneda);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.fechaDesde) params = params.set('fechaDesde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fechaHasta', filtro.fechaHasta);
    if (filtro.busqueda) params = params.set('busqueda', filtro.busqueda);
    return this.http.get(`${this.baseUrl}/reporte/excel`, {
      params,
      responseType: 'blob',
    });
  }

  /** Anula/reactiva el traspaso y sus dos movimientos, en una sola transacción. */
  cambiarEstado(id: string | number, activo: boolean): Observable<Traspaso> {
    return this.http.patch<Traspaso>(`${this.baseUrl}/cambiar_estado/${id}`, {
      activo,
    });
  }
}
