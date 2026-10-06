// src/app/pages/ui-components/services/venta-lote.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { aHttpParams } from 'src/app/shared/utils/http-params.util';
import { PromedioMineral } from '../models/promedio-mineral.models';
import {
  ActualizarVentaLoteRequest,
  CrearVentaLoteRequest,
  CuentaClienteDetalle,
  CuentaClienteFila,
  FiltrosVentaLote,
  LiquidarVentaLoteRequest,
  VentaLote,
  VentasLotePaginadas,
} from '../models/venta-lote.models';

@Injectable({ providedIn: 'root' })
export class VentaLoteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/venta-lote`;

  /** Promedios activos que todavía no se vendieron. */
  promediosDisponibles(busqueda?: string): Observable<PromedioMineral[]> {
    return this.http.get<PromedioMineral[]>(
      `${this.baseUrl}/promedios-disponibles`,
      { params: aHttpParams({ busqueda }) },
    );
  }

  listar(filtros: FiltrosVentaLote): Observable<VentasLotePaginadas> {
    return this.http.get<VentasLotePaginadas>(this.baseUrl, {
      params: aHttpParams(filtros),
    });
  }

  /** Clientes compradores activos con su cuenta corriente. */
  cuentasClientes(): Observable<CuentaClienteFila[]> {
    return this.http.get<CuentaClienteFila[]>(`${this.baseUrl}/clientes`);
  }

  /** Cuenta de un cliente: resumen, lotes y movimientos con saldo corrido. */
  cuentaCliente(idCliente: string): Observable<CuentaClienteDetalle> {
    return this.http.get<CuentaClienteDetalle>(
      `${this.baseUrl}/clientes/${idCliente}`,
    );
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

  /** Registra o corrige el monto estimado propio; `null` lo quita. */
  estimar(id: string, montoEstimado: number | null): Observable<VentaLote> {
    return this.http.patch<VentaLote>(`${this.baseUrl}/${id}/monto-estimado`, {
      montoEstimado,
    });
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
