// src/app/pages/ui-components/services/promedio-mineral.service.ts
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { aHttpParams } from 'src/app/shared/utils/http-params.util';
import {
  CodificacionLote,
  FiltrosDisponibles,
  FiltroReportePromedio,
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
      { params: aHttpParams(filtros) },
    );
  }

  listar(filtros: FiltrosPromedio): Observable<PromediosPaginados> {
    return this.http.get<PromediosPaginados>(this.baseUrl, {
      params: aHttpParams(filtros),
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

  /** Excel de promedios. Se pide la respuesta completa para leer el nombre
   *  del archivo del header Content-Disposition. */
  descargarReporteExcel(
    filtros: FiltroReportePromedio,
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/reporte/excel`, {
      params: aHttpParams(filtros),
      responseType: 'blob',
      observe: 'response',
    });
  }
}
