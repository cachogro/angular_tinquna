// src/app/pages/contabilidad/services/libreta-banco.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  GuardarMovimientoBancoRequest,
  LibretaBancoResponse,
  MovimientoBanco,
  MovimientoBancoDetalle,
  PeriodoBanco,
  PeriodoBancoAccionRequest,
} from '../models/libreta-banco.models';
import { FormatoReporte } from '../../../shared/utils/descarga-archivo.util';

@Injectable({ providedIn: 'root' })
export class LibretaBancoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/libreta-banco`;

  /** Libreta de una cuenta. Sin `gestion` trae todo; con `gestion` el año;
   *  con `gestion` + `mes` solo ese mes. */
  listar(
    idCuentaBancaria: number,
    gestion?: number | null,
    mes?: number | null,
  ): Observable<LibretaBancoResponse> {
    let params = new HttpParams().set('idCuentaBancaria', idCuentaBancaria);
    if (gestion != null) params = params.set('gestion', gestion);
    if (mes != null) params = params.set('mes', mes);
    return this.http.get<LibretaBancoResponse>(this.baseUrl, { params });
  }

  /** Excel de la libreta. Sin `gestion` sale toda la historia de la cuenta;
   *  `mes` requiere `gestion`. */
  descargarExcel(
    idCuentaBancaria: number,
    gestion?: number | null,
    mes?: number | null,
    formato: FormatoReporte = 'EXCEL',
  ): Observable<Blob> {
    let params = new HttpParams()
      .set('idCuentaBancaria', idCuentaBancaria)
      .set('formato', formato);
    if (gestion != null) {
      params = params.set('gestion', gestion);
      if (mes != null) params = params.set('mes', mes);
    }
    return this.http.get(`${this.baseUrl}/excel`, {
      params,
      responseType: 'blob',
    });
  }

  /** Movimiento completo para el visor (la bandeja trae solo lo necesario). */
  obtener(id: string): Observable<MovimientoBancoDetalle> {
    return this.http.get<MovimientoBancoDetalle>(`${this.baseUrl}/detalle/${id}`);
  }

  /** Todos los períodos de una cuenta (mensuales y de gestión), año más nuevo primero. */
  listarPeriodos(idCuentaBancaria: number): Observable<PeriodoBanco[]> {
    return this.http.get<PeriodoBanco[]>(`${this.baseUrl}/periodo`, {
      params: new HttpParams().set('idCuentaBancaria', idCuentaBancaria),
    });
  }

  /** Sin `id` crea, con `id` edita. El back asigna folio, período y saldo. */
  guardarMovimiento(
    data: GuardarMovimientoBancoRequest,
  ): Observable<MovimientoBanco> {
    return this.http.post<MovimientoBanco>(this.baseUrl, data);
  }

  /** Baja lógica de un movimiento (solo si su período está abierto). */
  cambiarEstadoMovimiento(
    id: string | number,
    activo: boolean,
  ): Observable<MovimientoBanco> {
    return this.http.patch<MovimientoBanco>(
      `${this.baseUrl}/cambiar_estado/${id}`,
      { activo },
    );
  }

  cerrarMes(body: PeriodoBancoAccionRequest): Observable<PeriodoBanco> {
    return this.accionPeriodo('cerrar', 'MES', body);
  }

  reabrirMes(body: PeriodoBancoAccionRequest): Observable<PeriodoBanco> {
    return this.accionPeriodo('reabrir', 'MES', body);
  }

  cerrarGestion(
    body: Omit<PeriodoBancoAccionRequest, 'mes'>,
  ): Observable<PeriodoBanco> {
    return this.accionPeriodo('cerrar', 'GESTION', body);
  }

  reabrirGestion(
    body: Omit<PeriodoBancoAccionRequest, 'mes'>,
  ): Observable<PeriodoBanco> {
    return this.accionPeriodo('reabrir', 'GESTION', body);
  }

  /** Una sola ruta para los cuatro cierres: la acción va en la URL y el
   *  alcance (mes o gestión) en el cuerpo. */
  private accionPeriodo(
    accion: 'cerrar' | 'reabrir',
    alcance: 'MES' | 'GESTION',
    body: PeriodoBancoAccionRequest,
  ): Observable<PeriodoBanco> {
    return this.http.post<PeriodoBanco>(`${this.baseUrl}/periodo/${accion}`, {
      ...body,
      alcance,
    });
  }
}
