// src/app/pages/contabilidad/services/movimiento-caja.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { MonedaCuenta } from '../../configurations/parametricas/models/parametricas.models';
import {
  CajaFlujoResponse,
  FiltroMovimientoCajaRequest,
  GuardarMovimientoCajaRequest,
  MovimientoCaja,
  PeriodoCaja,
  PeriodoCajaAccionRequest,
} from '../models/movimiento-caja.models';
import { FormatoReporte } from '../../../shared/utils/descarga-archivo.util';

@Injectable({ providedIn: 'root' })
export class MovimientoCajaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/movimiento-caja`;

  /** Caja de flujo de una caja en una moneda. Sin `gestion` trae todo; con
   *  `gestion` el año; con `gestion` + `mes` solo ese mes. */
  listar(filtro: FiltroMovimientoCajaRequest): Observable<CajaFlujoResponse> {
    let params = new HttpParams()
      .set('idCaja', filtro.idCaja)
      .set('moneda', filtro.moneda);
    if (filtro.gestion != null) params = params.set('gestion', filtro.gestion);
    if (filtro.mes != null) params = params.set('mes', filtro.mes);
    return this.http.get<CajaFlujoResponse>(this.baseUrl, { params });
  }

  /** Todos los períodos de una caja en una moneda (mensuales y de gestión). */
  listarPeriodos(idCaja: number, moneda: MonedaCuenta): Observable<PeriodoCaja[]> {
    return this.http.get<PeriodoCaja[]>(`${this.baseUrl}/periodo`, {
      params: new HttpParams().set('idCaja', idCaja).set('moneda', moneda),
    });
  }

  /** Sin `id` crea, con `id` edita. El back asigna folio, período y saldo. */
  guardarMovimiento(
    data: GuardarMovimientoCajaRequest,
  ): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(this.baseUrl, data);
  }

  /** Baja lógica de un movimiento (solo si su período está abierto). */
  cambiarEstadoMovimiento(
    id: string | number,
    activo: boolean,
  ): Observable<MovimientoCaja> {
    return this.http.patch<MovimientoCaja>(
      `${this.baseUrl}/cambiar_estado/${id}`,
      { activo },
    );
  }

  cerrarPeriodo(body: PeriodoCajaAccionRequest): Observable<PeriodoCaja> {
    return this.accionPeriodo('cerrar', 'MES', body);
  }

  reabrirPeriodo(body: PeriodoCajaAccionRequest): Observable<PeriodoCaja> {
    return this.accionPeriodo('reabrir', 'MES', body);
  }

  cerrarGestion(
    body: Omit<PeriodoCajaAccionRequest, 'mes'>,
  ): Observable<PeriodoCaja> {
    return this.accionPeriodo('cerrar', 'GESTION', body);
  }

  reabrirGestion(
    body: Omit<PeriodoCajaAccionRequest, 'mes'>,
  ): Observable<PeriodoCaja> {
    return this.accionPeriodo('reabrir', 'GESTION', body);
  }

  /** Una sola ruta para los cuatro cierres: la acción va en la URL y el
   *  alcance (mes o gestión) en el cuerpo. */
  private accionPeriodo(
    accion: 'cerrar' | 'reabrir',
    alcance: 'MES' | 'GESTION',
    body: PeriodoCajaAccionRequest,
  ): Observable<PeriodoCaja> {
    return this.http.post<PeriodoCaja>(`${this.baseUrl}/periodo/${accion}`, {
      ...body,
      alcance,
    });
  }

  /** Excel (o PDF) de la caja de flujo de un mes puntual. `gestion` y `mes`
   *  son obligatorios para este endpoint. */
  descargarExcel(filtro: {
    idCaja: number;
    moneda: MonedaCuenta;
    gestion: number;
    mes: number;
  }, formato: FormatoReporte = 'EXCEL'): Observable<Blob> {
    const params = new HttpParams()
      .set('idCaja', filtro.idCaja)
      .set('moneda', filtro.moneda)
      .set('gestion', filtro.gestion)
      .set('mes', filtro.mes)
      .set('formato', formato);
    return this.http.get(`${this.baseUrl}/excel`, {
      params,
      responseType: 'blob',
    });
  }

  /** Excel (o PDF) de la caja de flujo completa del mes: caja en Bs, caja en
   *  $us y todas las cuentas bancarias en una sola hoja. */
  descargarExcelCompleto(filtro: {
    idCaja: number;
    gestion: number;
    mes: number;
  }, formato: FormatoReporte = 'EXCEL'): Observable<Blob> {
    const params = new HttpParams()
      .set('completo', true)
      .set('idCaja', filtro.idCaja)
      .set('gestion', filtro.gestion)
      .set('mes', filtro.mes)
      .set('formato', formato);
    return this.http.get(`${this.baseUrl}/excel`, {
      params,
      responseType: 'blob',
    });
  }
}
