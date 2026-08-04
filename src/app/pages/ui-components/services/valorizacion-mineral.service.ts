// src/app/pages/ui-components/services/valorizacion-mineral.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  ActualizarValorizacionRequest,
  CrearBorradorValorizacionRequest,
  EstadoValorizacion,
  FiltrosValorizacionMineral,
  ValorizacionMineral,
  ValorizacionesMineralPaginadas,
} from '../models/valorizacion-mineral.models';

@Injectable({ providedIn: 'root' })
export class ValorizacionMineralService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/comercio_interno`;
  private readonly parametricasUrl = `${APP_CONFIG.apiUrl}/parametricas`;

  private estadosValorizacion$?: Observable<EstadoValorizacion[]>;

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  obtenerEstadosValorizacion(): Observable<EstadoValorizacion[]> {
    if (!this.estadosValorizacion$) {
      this.estadosValorizacion$ = this.http
        .get<
          EstadoValorizacion[]
        >(`${this.parametricasUrl}/valorizacion_mineral/allEstados`)
        .pipe(shareReplay(1));
    }
    return this.estadosValorizacion$;
  }

  /**
   * Crea el borrador de valorización a partir de una recepción de mineral ya
   * aprobada / rechazada a tol / en remuestreo. El backend responde 400 si la
   * recepción ya tiene una valorización registrada.
   */
  crearBorrador(
    idRecepcionMineral: string,
  ): Observable<ValorizacionMineral> {
    const body: CrearBorradorValorizacionRequest = { idRecepcionMineral };
    return this.http.post<ValorizacionMineral>(
      `${this.baseUrl}/valorizacion_mineral`,
      body,
    );
  }

  /**
   * Actualiza una valorización existente (laboratorio, pesos, merma, leyes
   * de laboratorio por mineral, aportes y/o cambio de estado).
   */
  actualizarValorizacion(
    id: string,
    data: ActualizarValorizacionRequest,
  ): Observable<ValorizacionMineral> {
    return this.http.patch<ValorizacionMineral>(
      `${this.baseUrl}/valorizacion_mineral/${id}`,
      data,
    );
  }

  /**
   * TODO: confirmar con backend el endpoint y los query params exactos de
   * listado. Por ahora se asume la misma convención que
   * RegistroMineralService.listarRegistros (GET al recurso, con
   * page/limit/filtros como query params).
   */
  listarValorizaciones(
    filtros: FiltrosValorizacionMineral,
  ): Observable<ValorizacionesMineralPaginadas> {
    const params = this.construirParams(filtros);

    return this.http.get<ValorizacionesMineralPaginadas>(
      `${this.baseUrl}/valorizacion_mineral`,
      { params },
    );
  }

  /** TODO: confirmar con backend el endpoint de detalle por id. */
  obtenerPorId(id: string): Observable<ValorizacionMineral> {
    return this.http.get<ValorizacionMineral>(
      `${this.baseUrl}/valorizacion_mineral/${id}`,
    );
  }

  private construirParams(filtros: FiltrosValorizacionMineral): HttpParams {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);

    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.codigoOperacion)
      params = params.set('codigoOperacion', filtros.codigoOperacion);
    if (filtros.numeroDocumento)
      params = params.set('numeroDocumento', filtros.numeroDocumento);
    if (filtros.idEstadoValorizacion)
      params = params.set(
        'idEstadoValorizacion',
        filtros.idEstadoValorizacion,
      );
    if (filtros.fechaDesde)
      params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta)
      params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);

    return params;
  }
}
