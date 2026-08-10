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
      `${this.baseUrl}/recepcion_mineral`,
      data,
    );
  }

  listarRegistros(
    filtros: FiltrosRegistroMineral,
  ): Observable<RegistrosMineralPaginados> {
    let params = this.construirParams(filtros);

    return this.http.get<RegistrosMineralPaginados>(
      `${this.baseUrl}/recepcion_mineral`,
      {
        params,
      },
    );
  }

  /** Descarga el Excel del listado con los filtros actuales (todas las páginas que apliquen, según el backend). */
  exportarExcel(filtros: FiltrosRegistroMineral): Observable<Blob> {
    const params = this.construirParams(filtros);

    return this.http.get(`${this.baseUrl}/recepcion_mineral/excel`, {
      params,
      responseType: 'blob',
    });
  }

  /** Descarga el PDF del listado con los mismos filtros/columnas que el Excel. */
  exportarReportePdf(filtros: FiltrosRegistroMineral): Observable<Blob> {
    const params = this.construirParams(filtros);

    return this.http.get(`${this.baseUrl}/recepcion_mineral/reporte_pdf`, {
      params,
      responseType: 'blob',
    });
  }

  private construirParams(filtros: FiltrosRegistroMineral): HttpParams {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);

    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.codigoOperacion)
      params = params.set('codigoOperacion', filtros.codigoOperacion);
    if (filtros.numeroDocumento)
      params = params.set('numeroDocumento', filtros.numeroDocumento);
    if (filtros.idCodificacion)
      params = params.set('idCodificacion', filtros.idCodificacion);
    if (filtros.idEstado) params = params.set('idEstado', filtros.idEstado);
    if (filtros.fechaDesde)
      params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta)
      params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.anio) params = params.set('anio', filtros.anio);
    if (filtros.mes) params = params.set('mes', filtros.mes);
    if (filtros.semana) params = params.set('semana', filtros.semana);
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);

    return params;
  }

  cambiarEstado(id: string, idEstado: number): Observable<RegistroMineral> {
    return this.http.patch<RegistroMineral>(
      `${this.baseUrl}/recepcion_mineral/cambiar_estado/${id}`,
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

  descargarPdf(id: number) {
    this.http
      .get(`${this.baseUrl}/recepcion_mineral/pdf/${id}`, {
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = window.URL.createObjectURL(blob);

        window.open(url, '_blank');
      });
  }
}
