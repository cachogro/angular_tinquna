// src/app/pages/ui-components/services/venta-lote.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { PromedioMineral } from '../models/promedio-mineral.models';
import {
  ActualizarVentaLoteRequest,
  CrearVentaLoteRequest,
  FiltrosVentaLote,
  LiquidarVentaLoteRequest,
  VentaLote,
  VentasLotePaginadas,
} from '../models/venta-lote.models';

@Injectable({ providedIn: 'root' })
export class VentaLoteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/venta-lote`;

  private toParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return params;
  }

  /** Promedios activos que todavía no se vendieron. */
  promediosDisponibles(busqueda?: string): Observable<PromedioMineral[]> {
    return this.http.get<PromedioMineral[]>(
      `${this.baseUrl}/promedios-disponibles`,
      { params: this.toParams({ busqueda }) },
    );
  }

  listar(filtros: FiltrosVentaLote): Observable<VentasLotePaginadas> {
    return this.http.get<VentasLotePaginadas>(this.baseUrl, {
      params: this.toParams({ ...filtros }),
    });
  }

  obtener(id: string): Observable<VentaLote> {
    return this.http.get<VentaLote>(`${this.baseUrl}/${id}`);
  }

  crear(data: CrearVentaLoteRequest): Observable<VentaLote> {
    return this.http.post<VentaLote>(this.baseUrl, data);
  }

  actualizar(id: string, data: ActualizarVentaLoteRequest): Observable<VentaLote> {
    return this.http.patch<VentaLote>(`${this.baseUrl}/${id}`, data);
  }

  liquidar(id: string, data: LiquidarVentaLoteRequest): Observable<VentaLote> {
    return this.http.patch<VentaLote>(`${this.baseUrl}/${id}/liquidar`, data);
  }

  reabrir(id: string): Observable<VentaLote> {
    return this.http.patch<VentaLote>(`${this.baseUrl}/${id}/reabrir`, {});
  }

  anular(id: string): Observable<VentaLote> {
    return this.http.patch<VentaLote>(`${this.baseUrl}/${id}/anular`, {});
  }
}
