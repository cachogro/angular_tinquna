// src/app/pages/contabilidad/services/fondo-rendir.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  EntregarFondoRendirRequest,
  ExcelFondoRendirRequest,
  FiltroFondoRendirRequest,
  FondoRendirCuentas,
  FondosRendirPaginados,
  GuardarDetalleFondoRendirRequest,
  ReponerFondoRendirRequest,
  SaldoFavorFondoRendir,
} from '../models/fondo-rendir.models';
import { FormatoReporte } from '../../../shared/utils/descarga-archivo.util';

@Injectable({ providedIn: 'root' })
export class FondoRendirService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/contabilidad/fondo-rendir`;

  /** Bandeja paginada; sin filtros trae todo (default page=1, limit=10). */
  listar(filtros: FiltroFondoRendirRequest): Observable<FondosRendirPaginados> {
    let params = new HttpParams()
      .set('page', filtros.page ?? 1)
      .set('limit', filtros.limit ?? 10);
    if (filtros.idPersona) params = params.set('idPersona', filtros.idPersona);
    if (filtros.idActorProductivoMinero)
      params = params.set(
        'idActorProductivoMinero',
        filtros.idActorProductivoMinero,
      );
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    return this.http.get<FondosRendirPaginados>(this.baseUrl, { params });
  }

  /** Detalle completo, con `detalles` (líneas de justificación). */
  obtener(id: string | number): Observable<FondoRendirCuentas> {
    return this.http.get<FondoRendirCuentas>(`${this.baseUrl}/${id}`);
  }

  /** Entrega el fondo (siempre crea uno nuevo). */
  entregar(data: EntregarFondoRendirRequest): Observable<FondoRendirCuentas> {
    return this.http.post<FondoRendirCuentas>(this.baseUrl, data);
  }

  /** Sin `id` agrega una línea de justificación, con `id` la actualiza.
   *  Devuelve el fondo completo con los totales recalculados. */
  guardarDetalle(
    data: GuardarDetalleFondoRendirRequest,
  ): Observable<FondoRendirCuentas> {
    return this.http.post<FondoRendirCuentas>(`${this.baseUrl}/detalle`, data);
  }

  /** Baja lógica de una línea de justificación; devuelve el fondo completo. */
  cambiarEstadoDetalle(
    id: string | number,
    activo: boolean,
  ): Observable<FondoRendirCuentas> {
    return this.http.patch<FondoRendirCuentas>(
      `${this.baseUrl}/detalle/cambiar_estado/${id}`,
      { activo },
    );
  }

  /** Carga el saldo pendiente al kardex del destinatario. Acción manual,
   *  no se puede deshacer justificando después. */
  cerrarConDeuda(id: string | number): Observable<FondoRendirCuentas> {
    return this.http.post<FondoRendirCuentas>(
      `${this.baseUrl}/${id}/cerrar-con-deuda`,
      {},
    );
  }

  /** Da por rendido el fondo sin comprobantes: una línea por el saldo
   *  pendiente lo deja en RENDIDO_TOTAL. Se deshace anulando esa línea. */
  rendirSinComprobantes(id: string | number): Observable<FondoRendirCuentas> {
    return this.http.post<FondoRendirCuentas>(
      `${this.baseUrl}/${id}/rendir-sin-comprobantes`,
      {},
    );
  }

  /** Devuelve el excedente al destinatario con un recibo de egreso. */
  reponer(
    id: string | number,
    data: ReponerFondoRendirRequest,
  ): Observable<FondoRendirCuentas> {
    return this.http.post<FondoRendirCuentas>(
      `${this.baseUrl}/${id}/reponer`,
      data,
    );
  }

  /** Aplica a este fondo el saldo a favor de fondos anteriores del
   *  destinatario (al entregar un fondo nuevo el back ya lo hace solo). */
  aplicarSaldoFavor(id: string | number): Observable<FondoRendirCuentas> {
    return this.http.post<FondoRendirCuentas>(
      `${this.baseUrl}/${id}/aplicar-saldo-favor`,
      {},
    );
  }

  /** Saldo a favor del destinatario en sus fondos rendidos en exceso. */
  saldoFavor(destinatario: {
    idPersona?: string;
    idActorProductivoMinero?: string;
  }): Observable<SaldoFavorFondoRendir> {
    let params = new HttpParams();
    if (destinatario.idPersona)
      params = params.set('idPersona', destinatario.idPersona);
    if (destinatario.idActorProductivoMinero)
      params = params.set(
        'idActorProductivoMinero',
        destinatario.idActorProductivoMinero,
      );
    return this.http.get<SaldoFavorFondoRendir>(`${this.baseUrl}/saldo-favor`, {
      params,
    });
  }

  /** Excel de rendición de cuentas de un destinatario. Con `mes` es el
   *  reporte mensual; sin `mes`, el anual de toda la gestión. */
  descargarExcel(
    filtro: ExcelFondoRendirRequest,
    formato: FormatoReporte = 'EXCEL',
  ): Observable<Blob> {
    let params = new HttpParams()
      .set('gestion', filtro.gestion)
      .set('formato', formato);
    if (filtro.idPersona) params = params.set('idPersona', filtro.idPersona);
    if (filtro.idActorProductivoMinero)
      params = params.set(
        'idActorProductivoMinero',
        filtro.idActorProductivoMinero,
      );
    if (filtro.mes != null) params = params.set('mes', filtro.mes);
    return this.http.get(`${this.baseUrl}/excel`, {
      params,
      responseType: 'blob',
    });
  }
}
