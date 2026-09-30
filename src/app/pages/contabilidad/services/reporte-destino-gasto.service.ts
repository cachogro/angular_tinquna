// src/app/pages/contabilidad/services/reporte-destino-gasto.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  DetalleDestinoGasto,
  FiltroReporteDestinoGasto,
  ResumenDestinosGasto,
} from '../models/reporte-destino-gasto.models';

@Injectable({ providedIn: 'root' })
export class ReporteDestinoGastoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/reportes/destino-gasto`;

  /** Totales generales y una fila por destino (incluye "SIN DESTINO"). */
  resumen(filtro: FiltroReporteDestinoGasto): Observable<ResumenDestinosGasto> {
    return this.http.get<ResumenDestinosGasto>(this.baseUrl, {
      params: this.params(filtro),
    });
  }

  /** Movimientos de un destino puntual bajo el mismo filtro. */
  detalle(
    idDestino: number,
    filtro: FiltroReporteDestinoGasto,
  ): Observable<DetalleDestinoGasto> {
    return this.http.get<DetalleDestinoGasto>(`${this.baseUrl}/${idDestino}`, {
      params: this.params(filtro),
    });
  }

  /** Solo se envían los filtros que tengan valor. */
  private params(filtro: FiltroReporteDestinoGasto): HttpParams {
    let params = new HttpParams().set('moneda', filtro.moneda);
    if (filtro.idCaja != null) params = params.set('idCaja', filtro.idCaja);
    if (filtro.fechaDesde) params = params.set('fechaDesde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fechaHasta', filtro.fechaHasta);
    return params;
  }
}
