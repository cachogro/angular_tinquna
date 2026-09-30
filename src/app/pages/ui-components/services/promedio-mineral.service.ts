// src/app/pages/ui-components/services/promedio-mineral.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  CodificacionLote,
  FiltrosDisponibles,
  FiltrosPromedio,
  GuardarPromedioRequest,
  Paginado,
  PromedioMineral,
  PromediosPaginados,
  ValorizacionDisponible,
} from '../models/promedio-mineral.models';

@Injectable({ providedIn: 'root' })
export class PromedioMineralService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/comercio_interno/promedio_mineral`;

  private toParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return params;
  }

  /** Solo activas (paramétrica `codificacion-lote`); reemplaza a
   *  `promedio_mineral/codificaciones_lote`, que el back mantiene por compatibilidad. */
  codificacionesLote(): Observable<CodificacionLote[]> {
    return this.http.get<CodificacionLote[]>(
      `${APP_CONFIG.apiUrl}/parametricas/codificacion-lote`,
    );
  }

  disponibles(
    filtros: FiltrosDisponibles,
  ): Observable<Paginado<ValorizacionDisponible>> {
    return this.http.get<Paginado<ValorizacionDisponible>>(
      `${this.baseUrl}/disponibles`,
      { params: this.toParams({ ...filtros }) },
    );
  }

  listar(filtros: FiltrosPromedio): Observable<PromediosPaginados> {
    return this.http.get<PromediosPaginados>(this.baseUrl, {
      params: this.toParams({ ...filtros }),
    });
  }

  obtener(id: string): Observable<PromedioMineral> {
    return this.http.get<PromedioMineral>(`${this.baseUrl}/${id}`);
  }

  crear(data: GuardarPromedioRequest): Observable<PromedioMineral> {
    return this.http.post<PromedioMineral>(this.baseUrl, data);
  }

  /** `idsValorizacion` reemplaza la composición completa; omitirlo para
   *  editar solo los textos. */
  actualizar(
    id: string,
    data: GuardarPromedioRequest,
  ): Observable<PromedioMineral> {
    return this.http.patch<PromedioMineral>(`${this.baseUrl}/${id}`, data);
  }

  anular(id: string): Observable<PromedioMineral> {
    return this.http.delete<PromedioMineral>(`${this.baseUrl}/${id}`);
  }
}
