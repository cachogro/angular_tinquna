// src/app/pages/contabilidad/services/kardex.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  AbrirKardexRequest,
  CerrarKardexResponse,
  FiltrosKardex,
  Kardex,
  KardexPaginado,
} from '../models/kardex.models';

@Injectable({ providedIn: 'root' })
export class KardexService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/kardex`;

  /** Bandeja paginada; sin filtros trae todo (default page=1, limit=10). */
  listar(filtros: FiltrosKardex): Observable<KardexPaginado> {
    let params = new HttpParams();
    if (filtros.page != null) params = params.set('page', filtros.page);
    if (filtros.limit != null) params = params.set('limit', filtros.limit);
    if (filtros.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.gestion != null)
      params = params.set('gestion', filtros.gestion);
    if (filtros.idActorProductivoMinero)
      params = params.set(
        'idActorProductivoMinero',
        filtros.idActorProductivoMinero,
      );
    if (filtros.idPersona) params = params.set('idPersona', filtros.idPersona);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);
    return this.http.get<KardexPaginado>(this.baseUrl, { params });
  }

  obtener(id: string): Observable<Kardex> {
    return this.http.get<Kardex>(`${this.baseUrl}/${id}`);
  }

  /** Abre el N°1 de un destinatario (actor o persona). */
  abrir(data: AbrirKardexRequest): Observable<Kardex> {
    return this.http.post<Kardex>(this.baseUrl, data);
  }

  /** Cierra y abre el siguiente número con el arrastre del saldo. */
  cerrar(id: string): Observable<CerrarKardexResponse> {
    return this.http.patch<CerrarKardexResponse>(
      `${this.baseUrl}/${id}/cerrar`,
      {},
    );
  }

  /** Reabre; borra el N°+1 si no tuvo movimientos. */
  reabrir(id: string): Observable<Kardex> {
    return this.http.patch<Kardex>(`${this.baseUrl}/${id}/reabrir`, {});
  }

  /** Baja lógica — solo permitida en el N°1 sin historial. */
  cambiarEstado(id: string, activo: boolean): Observable<Kardex> {
    return this.http.patch<Kardex>(`${this.baseUrl}/${id}/cambiar_estado`, {
      activo,
    });
  }
}
