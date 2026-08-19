// src/app/pages/configurations/services/bitacora-acceso.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  BitacoraAccesoPaginada,
  FiltrosBitacoraAcceso,
} from '../historial-accesos/models/bitacora-acceso.models';

@Injectable({ providedIn: 'root' })
export class BitacoraAccesoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/administrador`;

  listar(filtros: FiltrosBitacoraAcceso): Observable<BitacoraAccesoPaginada> {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);

    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.idUsuario) params = params.set('idUsuario', filtros.idUsuario);
    if (filtros.tipoEvento) params = params.set('tipoEvento', filtros.tipoEvento);
    if (filtros.exitoso !== undefined)
      params = params.set('exitoso', filtros.exitoso);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);

    return this.http.get<BitacoraAccesoPaginada>(
      `${this.baseUrl}/bitacora_acceso`,
      { params },
    );
  }
}
