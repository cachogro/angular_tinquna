// src/app/pages/contabilidad/services/cheque.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  AnularChequeEnBlancoRequest,
  Cheque,
  FiltroCheque,
  GuardarTalonarioChequeRequest,
  SiguienteCheque,
  TalonarioCheque,
} from '../models/cheque.models';

@Injectable({ providedIn: 'root' })
export class ChequeService {
  private readonly http = inject(HttpClient);
  private readonly talonarioUrl = `${APP_CONFIG.apiUrl}/contabilidad/talonario-cheque`;
  private readonly chequeUrl = `${APP_CONFIG.apiUrl}/contabilidad/cheque`;

  // ---------- talonarios ----------

  listarTalonarios(idCuentaBancaria: number): Observable<TalonarioCheque[]> {
    return this.http.get<TalonarioCheque[]>(this.talonarioUrl, {
      params: { idCuentaBancaria },
    });
  }

  /** Un solo POST: sin `id` crea, con `id` actualiza. */
  guardarTalonario(data: GuardarTalonarioChequeRequest): Observable<TalonarioCheque> {
    return this.http.post<TalonarioCheque>(this.talonarioUrl, data);
  }

  cambiarEstadoTalonario(id: number, activo: boolean): Observable<TalonarioCheque> {
    return this.http.patch<TalonarioCheque>(
      `${this.talonarioUrl}/cambiar_estado/${id}`,
      { activo },
    );
  }

  // ---------- cheques ----------

  /** Próximo cheque disponible de la cuenta (para proponerlo al pagar). */
  siguiente(idCuentaBancaria: number): Observable<SiguienteCheque> {
    return this.http.get<SiguienteCheque>(`${this.chequeUrl}/siguiente`, {
      params: { idCuentaBancaria },
    });
  }

  listarCheques(filtro: FiltroCheque): Observable<Cheque[]> {
    let params = new HttpParams();
    if (filtro.idCuentaBancaria)
      params = params.set('idCuentaBancaria', filtro.idCuentaBancaria);
    if (filtro.idTalonarioCheque)
      params = params.set('idTalonarioCheque', filtro.idTalonarioCheque);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    return this.http.get<Cheque[]>(this.chequeUrl, { params });
  }

  cobrar(id: string, fechaCobro: string): Observable<Cheque> {
    return this.http.patch<Cheque>(`${this.chequeUrl}/${id}/cobrar`, { fechaCobro });
  }

  deshacerCobro(id: string): Observable<Cheque> {
    return this.http.patch<Cheque>(`${this.chequeUrl}/${id}/deshacer-cobro`, {});
  }

  revalidar(id: string): Observable<Cheque> {
    return this.http.patch<Cheque>(`${this.chequeUrl}/${id}/revalidar`, {});
  }

  anularEnBlanco(data: AnularChequeEnBlancoRequest): Observable<Cheque> {
    return this.http.post<Cheque>(`${this.chequeUrl}/anular`, data);
  }
}
