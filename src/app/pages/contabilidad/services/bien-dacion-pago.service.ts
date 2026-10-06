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
  RegistrarGastoBienDacionRequest,
  TomarEnPagoBienDacionRequest,
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

  /** Solo EN_POSESION: abona el valor acordado al kardex del dueño (sin
   *  mover caja) y el bien pasa a ser de la empresa. */
  tomarEnPago(
    id: string | number,
    data: TomarEnPagoBienDacionRequest,
  ): Observable<BienDacionPago> {
    return this.http.post<BienDacionPago>(
      `${this.baseUrl}/${id}/tomar-en-pago`,
      data,
    );
  }

  /** EN_POSESION (venta directa) o TOMADO_EN_PAGO. */
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

  /** Solo TOMADO_EN_PAGO: egreso directo de caja o libreta. */
  registrarGasto(
    id: string | number,
    data: RegistrarGastoBienDacionRequest,
  ): Observable<BienDacionPago> {
    return this.http.post<BienDacionPago>(`${this.baseUrl}/${id}/gasto`, data);
  }

  /** Da de baja el gasto y su egreso; devuelve el bien actualizado. */
  anularGasto(idGasto: string | number): Observable<BienDacionPago> {
    return this.http.patch<BienDacionPago>(
      `${this.baseUrl}/gasto/${idGasto}/anular`,
      {},
    );
  }
}
