// src/app/pages/contabilidad/services/prestamo-personal.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  AbonarPrestamoRequest,
  ActualizarCuotaRequest,
  FiltrosPrestamo,
  OtorgarPrestamoRequest,
  PrestamoPersonal,
  PrestamosPaginados,
} from '../models/prestamo-personal.models';

@Injectable({ providedIn: 'root' })
export class PrestamoPersonalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/prestamo-personal`;

  listar(filtros: FiltrosPrestamo = {}): Observable<PrestamosPaginados> {
    let params = new HttpParams();
    if (filtros.page) params = params.set('page', filtros.page);
    if (filtros.limit) params = params.set('limit', filtros.limit);
    if (filtros.idPersona) params = params.set('idPersona', filtros.idPersona);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    return this.http.get<PrestamosPaginados>(this.baseUrl, { params });
  }

  /** Préstamo con su sub-libro (movimientos). */
  obtener(id: string): Observable<PrestamoPersonal> {
    return this.http.get<PrestamoPersonal>(`${this.baseUrl}/${id}`);
  }

  /** Recibo de EGRESO + DEBE en el kardex PERSONAL + línea OTORGAMIENTO. */
  otorgar(data: OtorgarPrestamoRequest): Observable<PrestamoPersonal> {
    return this.http.post<PrestamoPersonal>(this.baseUrl, data);
  }

  /** Recibo de INGRESO + HABER en el kardex + línea ABONO. */
  abonar(id: string, data: AbonarPrestamoRequest): Observable<PrestamoPersonal> {
    return this.http.post<PrestamoPersonal>(`${this.baseUrl}/${id}/abono`, data);
  }

  actualizarCuota(
    id: string,
    data: ActualizarCuotaRequest,
  ): Observable<PrestamoPersonal> {
    return this.http.patch<PrestamoPersonal>(`${this.baseUrl}/${id}/cuota`, data);
  }
}
