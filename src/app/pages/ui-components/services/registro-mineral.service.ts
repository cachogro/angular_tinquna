// src/app/pages/ui-components/services/registro-mineral.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { aHttpParams } from 'src/app/shared/utils/http-params.util';
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
    return this.http.get<RegistrosMineralPaginados>(
      `${this.baseUrl}/recepcion_mineral`,
      { params: aHttpParams(filtros) },
    );
  }

  /** Recepción completa por id. El back responde null si no existe. */
  obtenerPorId(id: string): Observable<RegistroMineral | null> {
    return this.http.get<RegistroMineral | null>(
      `${this.baseUrl}/recepcion_mineral/busqueda/${id}`,
    );
  }

  /** Descarga el Excel del listado con los filtros actuales (todas las páginas que apliquen, según el backend). */
  exportarExcel(filtros: FiltrosRegistroMineral): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/recepcion_mineral/excel`, {
      params: aHttpParams(filtros),
      responseType: 'blob',
    });
  }

  /** Descarga el PDF del listado con los mismos filtros/columnas que el Excel. */
  exportarReportePdf(filtros: FiltrosRegistroMineral): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/recepcion_mineral/reporte_pdf`, {
      params: aHttpParams(filtros),
      responseType: 'blob',
    });
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

  /** Comprobante RM- de la recepción (constancia de entrega, sin montos). Se
   *  emite para toda recepción, tenga o no anticipo. */
  obtenerPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/recepcion_mineral/pdf/${id}`, {
      responseType: 'blob',
    });
  }
}
