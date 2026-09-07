// src/app/pages/contabilidad/services/libreta-banco.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  GuardarMovimientoBancoRequest,
  LibretaBancoResponse,
  MovimientoBanco,
  PeriodoBanco,
  PeriodoBancoAccionRequest,
} from '../models/libreta-banco.models';

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
    return this.http.post<PeriodoBanco>(`${this.baseUrl}/periodo/cerrar`, body);
  }

  reabrirMes(body: PeriodoBancoAccionRequest): Observable<PeriodoBanco> {
    return this.http.post<PeriodoBanco>(`${this.baseUrl}/periodo/reabrir`, body);
  }

  cerrarGestion(
    body: Omit<PeriodoBancoAccionRequest, 'mes'>,
  ): Observable<PeriodoBanco> {
    return this.http.post<PeriodoBanco>(
      `${this.baseUrl}/periodo/cerrar-gestion`,
      body,
    );
  }

  reabrirGestion(
    body: Omit<PeriodoBancoAccionRequest, 'mes'>,
  ): Observable<PeriodoBanco> {
    return this.http.post<PeriodoBanco>(
      `${this.baseUrl}/periodo/reabrir-gestion`,
      body,
    );
  }
}
