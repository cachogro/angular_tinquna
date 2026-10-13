// src/app/pages/contabilidad/services/reporte-plan-cuentas.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  DetallePlanCuentas,
  FiltroReportePlanCuentas,
  ResumenCuentasPlan,
} from '../models/reporte-plan-cuentas.models';

@Injectable({ providedIn: 'root' })
export class ReportePlanCuentasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/reportes/plan-cuentas`;

  /** Totales generales y una fila por plan de cuentas (incluye "SIN PLAN DE CUENTAS"). */
  resumen(filtro: FiltroReportePlanCuentas): Observable<ResumenCuentasPlan> {
    return this.http.get<ResumenCuentasPlan>(this.baseUrl, {
      params: this.params(filtro),
    });
  }

  /** Movimientos de una cuenta puntual del plan bajo el mismo filtro. */
  detalle(
    idDestino: number,
    filtro: FiltroReportePlanCuentas,
  ): Observable<DetallePlanCuentas> {
    return this.http.get<DetallePlanCuentas>(`${this.baseUrl}/${idDestino}`, {
      params: this.params(filtro),
    });
  }

  /** Solo se envían los filtros que tengan valor. */
  private params(filtro: FiltroReportePlanCuentas): HttpParams {
    let params = new HttpParams().set('moneda', filtro.moneda);
    if (filtro.idCaja != null) params = params.set('idCaja', filtro.idCaja);
    if (filtro.fechaDesde) params = params.set('fechaDesde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fechaHasta', filtro.fechaHasta);
    return params;
  }
}
