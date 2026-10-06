// src/app/pages/ui-components/services/valorizacion-mineral.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { aHttpParams } from 'src/app/shared/utils/http-params.util';
import {
  ActualizarValorizacionRequest,
  CambiarEstadoValorizacionRequest,
  CrearBorradorValorizacionRequest,
  EstadoValorizacion,
  FiltroReporteValorizacion,
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
  crearBorrador(idRecepcionMineral: string): Observable<ValorizacionMineral> {
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
   * Cambia el estado de una valorización (PRE-VALORIZADO=2 o VALORIZADO=3)
   * vía el endpoint dedicado. Al pasar a VALORIZADO, el backend además marca
   * la recepción de mineral asociada como TRANZADO. El backend responde 400
   * si la valorización no está activa, la recepción ya fue tranzada, no
   * tiene totalValorLiquidoVentaBolivianos > 0, o no tiene detalle de mineral registrado.
   */
  cambiarEstadoValorizacion(
    id: string,
    idEstadoValorizacion: number,
  ): Observable<ValorizacionMineral> {
    const body: CambiarEstadoValorizacionRequest = { idEstadoValorizacion };
    return this.http.patch<ValorizacionMineral>(
      `${this.baseUrl}/valorizacion_mineral/${id}/estado`,
      body,
    );
  }

  /**
   * Marca / desmarca la valorización como "entregada" (el material salió del
   * ingenio) vía el endpoint dedicado. `entregado: true` fija además
   * `fechaEntregado`; `entregado: false` la revierte a null.
   */
  marcarEntregado(
    id: string,
    entregado: boolean,
  ): Observable<ValorizacionMineral> {
    return this.http.patch<ValorizacionMineral>(
      `${this.baseUrl}/valorizacion_mineral/${id}/entregado`,
      { entregado },
    );
  }

  listarValorizaciones(
    filtros: FiltrosValorizacionMineral,
  ): Observable<ValorizacionesMineralPaginadas> {
    return this.http.get<ValorizacionesMineralPaginadas>(
      `${this.baseUrl}/valorizacion_mineral`,
      { params: aHttpParams(filtros) },
    );
  }

  obtenerPorId(id: string): Observable<ValorizacionMineral> {
    return this.http.get<ValorizacionMineral>(
      `${this.baseUrl}/valorizacion_mineral/${id}`,
    );
  }

  /** PDF de la valorización (generado por el backend). El nombre del
   *  "Liquidador" en el PDF sale del usuario autenticado (token). */
  obtenerPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/valorizacion_mineral/pdf/${id}`, {
      responseType: 'blob',
    });
  }

  /** Descarga el Excel del reporte de valorizaciones con los filtros dados.
   *  El backend arma el archivo completo (no paginado); acá solo se dispara
   *  la descarga (el nombre real del archivo lo fija el backend). Las 3
   *  formas de acotar por fecha son excluyentes (ver FiltroReporteValorizacion). */
  descargarReporteExcel(filtros: FiltroReporteValorizacion): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reportes/valorizacion_mineral/excel`,
      { params: aHttpParams(filtros), responseType: 'blob' },
    );
  }
}
