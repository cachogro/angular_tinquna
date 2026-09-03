// src/app/pages/ui-components/services/valorizacion-mineral.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
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

  /** Descarga el PDF de la valorización (generado por el backend) y lo abre
   *  en una pestaña nueva. El nombre del "Liquidador" en el PDF sale del
   *  usuario autenticado (token), no de este llamado. */
  descargarPdf(id: string): void {
    this.http
      .get(`${this.baseUrl}/valorizacion_mineral/pdf/${id}`, {
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      });
  }

  /** Descarga el Excel del reporte de valorizaciones con los filtros dados.
   *  El backend arma el archivo completo (no paginado); acá solo se dispara
   *  la descarga (el nombre real del archivo lo fija el backend). Las 3
   *  formas de acotar por fecha son excluyentes (ver FiltroReporteValorizacion). */
  descargarReporteExcel(filtros: FiltroReporteValorizacion): Observable<Blob> {
    let params = new HttpParams();
    const set = (clave: string, valor: string | number | undefined): void => {
      if (valor !== undefined && valor !== null && valor !== '')
        params = params.set(clave, valor);
    };
    set('estado', filtros.estado);
    set('entregado', filtros.entregado);
    set('idCodificacion', filtros.idCodificacion);
    set('fechaDesde', filtros.fechaDesde);
    set('fechaHasta', filtros.fechaHasta);
    set('anio', filtros.anio);
    set('mes', filtros.mes);
    set('semana', filtros.semana);

    return this.http.get(
      `${this.baseUrl}/reportes/valorizacion_mineral/excel`,
      { params, responseType: 'blob' },
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
      params = params.set('idEstadoValorizacion', filtros.idEstadoValorizacion);
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
