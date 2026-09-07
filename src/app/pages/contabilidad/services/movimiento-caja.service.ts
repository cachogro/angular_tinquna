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
    return this.http.post<PeriodoCaja>(`${this.baseUrl}/periodo/cerrar`, body);
  }

  reabrirPeriodo(body: PeriodoCajaAccionRequest): Observable<PeriodoCaja> {
    return this.http.post<PeriodoCaja>(`${this.baseUrl}/periodo/reabrir`, body);
  }

  cerrarGestion(
    body: Omit<PeriodoCajaAccionRequest, 'mes'>,
  ): Observable<PeriodoCaja> {
    return this.http.post<PeriodoCaja>(
      `${this.baseUrl}/periodo/cerrar-gestion`,
      body,
    );
  }

  reabrirGestion(
    body: Omit<PeriodoCajaAccionRequest, 'mes'>,
  ): Observable<PeriodoCaja> {
    return this.http.post<PeriodoCaja>(
      `${this.baseUrl}/periodo/reabrir-gestion`,
      body,
    );
  }
}
