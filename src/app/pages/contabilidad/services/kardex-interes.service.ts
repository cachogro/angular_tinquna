// src/app/pages/contabilidad/services/kardex-interes.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  AplicarInteresRequest,
  CambiarTasaInteresRequest,
  CargarInteresRequest,
  CondonarInteresRequest,
  DetalleInteresKardex,
} from '../models/kardex-interes.models';

/** Intereses por mora de un kardex. Toda operación devuelve la sección
 *  completa ya actualizada (resumen, planes, cuotas y bitácora). */
@Injectable({ providedIn: 'root' })
export class KardexInteresService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad`;

  /** El back pone al día las cuotas de los meses cumplidos antes de responder. */
  detalle(idKardex: string): Observable<DetalleInteresKardex> {
    return this.http.get<DetalleInteresKardex>(
      `${this.baseUrl}/kardex/${idKardex}/interes`,
    );
  }

  aplicar(
    idKardex: string,
    data: AplicarInteresRequest,
  ): Observable<DetalleInteresKardex> {
    return this.http.post<DetalleInteresKardex>(
      `${this.baseUrl}/kardex/${idKardex}/interes`,
      data,
    );
  }

  /** Acuerdo de nueva tasa: recalcula todas las cuotas pendientes. */
  cambiarTasa(
    idPlan: string,
    data: CambiarTasaInteresRequest,
  ): Observable<DetalleInteresKardex> {
    return this.http.patch<DetalleInteresKardex>(
      `${this.baseUrl}/kardex-interes/${idPlan}/tasa`,
      data,
    );
  }

  /** Perdona las cuotas pendientes. */
  condonar(
    idPlan: string,
    data: CondonarInteresRequest,
  ): Observable<DetalleInteresKardex> {
    return this.http.patch<DetalleInteresKardex>(
      `${this.baseUrl}/kardex-interes/${idPlan}/condonar`,
      data,
    );
  }

  /** Pasa las cuotas pendientes al kardex como una línea DEBE. */
  cargar(
    idPlan: string,
    data: CargarInteresRequest,
  ): Observable<DetalleInteresKardex> {
    return this.http.post<DetalleInteresKardex>(
      `${this.baseUrl}/kardex-interes/${idPlan}/cargar`,
      data,
    );
  }

  /** Da de baja la línea del cargo; sus cuotas vuelven a PENDIENTE. */
  revertirCargo(
    idMovimientoKardex: string,
    observacion?: string,
  ): Observable<DetalleInteresKardex> {
    return this.http.patch<DetalleInteresKardex>(
      `${this.baseUrl}/kardex-interes/cargo/${idMovimientoKardex}/revertir`,
      observacion ? { observacion } : {},
    );
  }

  /** Deja de generar cuotas; las pendientes quedan para cargar o condonar. */
  finalizar(
    idPlan: string,
    observacion?: string,
  ): Observable<DetalleInteresKardex> {
    return this.http.patch<DetalleInteresKardex>(
      `${this.baseUrl}/kardex-interes/${idPlan}/finalizar`,
      observacion ? { observacion } : {},
    );
  }
}
