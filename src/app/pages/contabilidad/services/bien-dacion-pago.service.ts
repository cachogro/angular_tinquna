// src/app/pages/contabilidad/services/bien-dacion-pago.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  BienDacionPaginado,
  BienDacionPago,
  DevolverBienDacionRequest,
  FiltrosBienDacion,
  RegistrarBienDacionRequest,
  VenderBienDacionRequest,
} from '../models/bien-dacion-pago.models';

@Injectable({ providedIn: 'root' })
export class BienDacionPagoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/bien-dacion-pago`;

  listar(filtros: FiltrosBienDacion = {}): Observable<BienDacionPaginado> {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<BienDacionPaginado>(this.baseUrl, { params });
  }

  obtener(id: string | number): Observable<BienDacionPago> {
    return this.http.get<BienDacionPago>(`${this.baseUrl}/${id}`);
  }

  /** 400 si el destinatario no tiene kardex ABIERTO. */
  registrar(data: RegistrarBienDacionRequest): Observable<BienDacionPago> {
    return this.http.post<BienDacionPago>(this.baseUrl, data);
  }

  /** Solo si está EN_POSESION. */
  vender(
    id: string | number,
    data: VenderBienDacionRequest,
  ): Observable<BienDacionPago> {
    return this.http.post<BienDacionPago>(`${this.baseUrl}/${id}/vender`, data);
  }

  /** Solo si está EN_POSESION. */
  devolver(
    id: string | number,
    data: DevolverBienDacionRequest,
  ): Observable<BienDacionPago> {
    return this.http.post<BienDacionPago>(
      `${this.baseUrl}/${id}/devolver`,
      data,
    );
  }
}
