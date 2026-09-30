// src/app/pages/contabilidad/services/movimiento-kardex.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  GuardarMovimientoKardexRequest,
  MovimientoKardex,
  MovimientosKardexResponse,
} from '../models/movimiento-kardex.models';

@Injectable({ providedIn: 'root' })
export class MovimientoKardexService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/movimiento-kardex`;

  /** Movimientos de un kardex puntual, paginados y con la última línea
   *  primero, + el kardex (con su `saldoActual` = "TOTAL ANTICIPOS POR COBRAR"). */
  listar(
    idKardex: string,
    page = 1,
    limit = 10,
  ): Observable<MovimientosKardexResponse> {
    const params = new HttpParams()
      .set('idKardex', idKardex)
      .set('page', page)
      .set('limit', limit);
    return this.http.get<MovimientosKardexResponse>(this.baseUrl, { params });
  }

  /** Sin `id` crea, con `id` edita. Recalcula el saldo del kardex entero.
   *  400 si el kardex está cerrado. */
  guardar(
    data: GuardarMovimientoKardexRequest,
  ): Observable<MovimientoKardex> {
    return this.http.post<MovimientoKardex>(this.baseUrl, data);
  }

  /** Baja lógica — recalcula el saldo sin ese movimiento. Solo si el kardex
   *  está abierto. */
  cambiarEstado(
    id: string | number,
    activo: boolean,
  ): Observable<MovimientoKardex> {
    return this.http.patch<MovimientoKardex>(
      `${this.baseUrl}/cambiar_estado/${id}`,
      { activo },
    );
  }
}
