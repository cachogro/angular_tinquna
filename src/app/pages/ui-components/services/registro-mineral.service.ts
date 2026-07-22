// src/app/pages/ui-components/services/registro-mineral.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  CodificacionCatalogo,
  FiltrosRegistroMineral,
  GuardarRegistroMineralRequest,
  RegistroMineral,
  RegistrosMineralPaginados,
} from '../models/registro-mineral.models';

@Injectable({ providedIn: 'root' })
export class RegistroMineralService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/comercio_interno`;
  private readonly parametricasUrl = `${APP_CONFIG.apiUrl}/parametricas`;

  private codificaciones$?: Observable<CodificacionCatalogo[]>;

  /** Sin `id` en el request -> crea. Con `id` -> actualiza. */
  guardarRegistro(
    data: GuardarRegistroMineralRequest,
  ): Observable<RegistroMineral> {
    return this.http.post<RegistroMineral>(
      `${this.baseUrl}/registro_mineral`,
      data,
    );
  }

  listarRegistros(
    filtros: FiltrosRegistroMineral,
  ): Observable<RegistrosMineralPaginados> {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);

    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.numeroDocumento)
      params = params.set('numeroDocumento', filtros.numeroDocumento);
    if (filtros.idEstado) params = params.set('idEstado', filtros.idEstado);
    if (filtros.fechaDesde)
      params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta)
      params = params.set('fechaHasta', filtros.fechaHasta);

    return this.http.get<RegistrosMineralPaginados>(
      `${this.baseUrl}/registro_mineral`,
      {
        params,
      },
    );
  }

  cambiarEstado(id: string, idEstado: number): Observable<RegistroMineral> {
    return this.http.patch<RegistroMineral>(
      `${this.baseUrl}/registro_mineral/cambiar_estado/${id}`,
      { idEstado },
    );
  }

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  getAllCodificaciones(): Observable<CodificacionCatalogo[]> {
    if (!this.codificaciones$) {
      this.codificaciones$ = this.http
        .get<CodificacionCatalogo[]>(`${this.parametricasUrl}/allCodificacion`)
        .pipe(shareReplay(1));
    }
    return this.codificaciones$;
  }
}
