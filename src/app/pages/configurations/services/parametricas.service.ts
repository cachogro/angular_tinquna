import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  ActoresProductivosMinerosPaginados,
  ActorProductivoMinero,
  ActualizarCodificacionRequest,
  ActualizarCotizacionRequest,
  Codificacion,
  Cotizacion,
  CotizacionesPaginadas,
  CrearCodificacionRequest,
  CrearCotizacionRequest,
  EntidadAporte,
  FiltrosActorProductivoMinero,
  FiltrosCotizacion,
  GuardarActorProductivoMineroRequest,
  GuardarEntidadAporteRequest,
  GuardarLaboratorioRequest,
  GuardarMineralRequest,
  Laboratorio,
  Mineral,
  TipoActorProductivoMinero,
} from '../parametricas/models/parametricas.models';

@Injectable({ providedIn: 'root' })
export class ParametricasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/parametricas`;

  // ==========================================================
  // CODIFICACIONES
  // ==========================================================

  // Estado reactivo: la tabla lee esto y se refresca sola cuando cambia,
  // sin que el modal necesite conocer a la tabla ni viceversa.
  readonly codificaciones = signal<Codificacion[]>([]);
  readonly cargandoCodificaciones = signal<boolean>(false);

  crearCodificacion(data: CrearCodificacionRequest): Observable<Codificacion> {
    return this.http
      .post<Codificacion>(`${this.baseUrl}/codificacion`, data)
      .pipe(tap(() => this.cargarCodificaciones()));
  }

  actualizarCodificacion(
    data: ActualizarCodificacionRequest,
  ): Observable<Codificacion> {
    return this.http
      .put<Codificacion>(`${this.baseUrl}/codificacion`, data)
      .pipe(tap(() => this.cargarCodificaciones()));
  }

  obtenerMinerales(): Observable<Mineral[]> {
    return this.http.get<Mineral[]>(`${this.baseUrl}/allMinerales`);
  }

  obtenerCodificaciones(): Observable<Codificacion[]> {
    return this.http.get<Codificacion[]>(`${this.baseUrl}/allCodificacion`);
  }

  /** Carga las codificaciones y actualiza el signal para que la tabla se refresque */
  cargarCodificaciones(): void {
    this.cargandoCodificaciones.set(true);
    this.obtenerCodificaciones().subscribe({
      next: (data) => {
        this.codificaciones.set(data);
        this.cargandoCodificaciones.set(false);
      },
      error: () => {
        this.cargandoCodificaciones.set(false);
      },
    });
  }

  // ==========================================================
  // COTIZACIONES
  // ==========================================================

  readonly cotizaciones = signal<Cotizacion[]>([]);
  readonly totalCotizaciones = signal<number>(0);
  readonly cargandoCotizaciones = signal<boolean>(false);

  // Recordamos los últimos filtros usados para poder recargar la misma
  // página/búsqueda después de crear o actualizar una cotización.
  private filtrosCotizacionActuales: FiltrosCotizacion = { page: 1, limit: 10 };

  crearCotizacion(data: CrearCotizacionRequest): Observable<Cotizacion> {
    return this.http
      .post<Cotizacion>(`${this.baseUrl}/cotizacion`, data)
      .pipe(tap(() => this.cargarCotizaciones(this.filtrosCotizacionActuales)));
  }

  actualizarCotizacion(
    data: ActualizarCotizacionRequest,
  ): Observable<Cotizacion> {
    return this.http
      .post<Cotizacion>(`${this.baseUrl}/cotizacion`, data)
      .pipe(tap(() => this.cargarCotizaciones(this.filtrosCotizacionActuales)));
  }

  /** Cotización vigente de un mineral en este instante exacto (según NOW()
   *  de la base de datos). Responde 404 si el mineral no tiene ninguna
   *  vigente ahora mismo. */
  obtenerCotizacionVigentePorMineral(
    idMineral: number,
  ): Observable<Cotizacion> {
    return this.http.get<Cotizacion>(
      `${this.baseUrl}/cotizacion/vigente/${idMineral}`,
    );
  }

  listarCotizaciones(
    filtros: FiltrosCotizacion,
  ): Observable<CotizacionesPaginadas> {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.idMineral) params = params.set('idMineral', filtros.idMineral);
    if (filtros.vigente !== undefined)
      params = params.set('vigente', filtros.vigente);
    if (filtros.activo !== undefined)
      params = params.set('activo', filtros.activo);

    return this.http.get<CotizacionesPaginadas>(
      `${this.baseUrl}/cotizacionPag`,
      {
        params,
      },
    );
  }

  /** Carga las cotizaciones (paginadas/filtradas) y actualiza los signals */
  cargarCotizaciones(filtros: FiltrosCotizacion): void {
    this.filtrosCotizacionActuales = filtros;
    this.cargandoCotizaciones.set(true);
    this.listarCotizaciones(filtros).subscribe({
      next: (res) => {
        this.cotizaciones.set(res.data);
        this.totalCotizaciones.set(res.total);
        this.cargandoCotizaciones.set(false);
      },
      error: () => {
        this.cargandoCotizaciones.set(false);
      },
    });
  }

  // ==========================================================
  // ACTOR PRODUCTIVO MINERO (antes "Ingenio")
  // ==========================================================

  private readonly actorProductivoMineroUrl = `${this.baseUrl}/actor-productivo-minero`;

  readonly actoresProductivosMineros = signal<ActorProductivoMinero[]>([]);
  readonly totalActoresProductivosMineros = signal<number>(0);
  readonly cargandoActoresProductivosMineros = signal<boolean>(false);

  private filtrosActorProductivoMineroActuales: FiltrosActorProductivoMinero = {
    page: 1,
    limit: 10,
  };

  private tiposActorProductivoMinero$?: Observable<TipoActorProductivoMinero[]>;

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  obtenerTiposActorProductivoMinero(): Observable<TipoActorProductivoMinero[]> {
    if (!this.tiposActorProductivoMinero$) {
      this.tiposActorProductivoMinero$ = this.http
        .get<
          TipoActorProductivoMinero[]
        >(`${this.actorProductivoMineroUrl}/allTipoActor`)
        .pipe(shareReplay(1));
    }
    return this.tiposActorProductivoMinero$;
  }

  /** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
  guardarActorProductivoMinero(
    data: GuardarActorProductivoMineroRequest,
  ): Observable<ActorProductivoMinero> {
    return this.http
      .post<ActorProductivoMinero>(this.actorProductivoMineroUrl, data)
      .pipe(
        tap(() =>
          this.cargarActoresProductivosMineros(
            this.filtrosActorProductivoMineroActuales,
          ),
        ),
      );
  }

  listarActoresProductivosMineros(
    filtros: FiltrosActorProductivoMinero,
  ): Observable<ActoresProductivosMinerosPaginados> {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);

    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.activo !== undefined)
      params = params.set('activo', filtros.activo);
    if (filtros.idTipoActorProductivoMinero !== undefined)
      params = params.set(
        'idTipoActorProductivoMinero',
        filtros.idTipoActorProductivoMinero,
      );
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);

    return this.http.get<ActoresProductivosMinerosPaginados>(
      this.actorProductivoMineroUrl,
      { params },
    );
  }

  /** Carga los actores productivos mineros (paginados/filtrados) y actualiza los signals */
  cargarActoresProductivosMineros(filtros: FiltrosActorProductivoMinero): void {
    this.filtrosActorProductivoMineroActuales = filtros;
    this.cargandoActoresProductivosMineros.set(true);
    this.listarActoresProductivosMineros(filtros).subscribe({
      next: (res) => {
        this.actoresProductivosMineros.set(res.data);
        this.totalActoresProductivosMineros.set(res.total);
        this.cargandoActoresProductivosMineros.set(false);
      },
      error: () => {
        this.cargandoActoresProductivosMineros.set(false);
      },
    });
  }

  // ⚠️ AJUSTA ESTA RUTA si tu back usa otro path para activar/desactivar.
  // Sigue el mismo patrón que cambiarEstadoUsuario/cambiarEstado
  // (usuario-admin.service.ts / persona.service.ts).
  cambiarEstadoActorProductivoMinero(
    id: string,
    activo: boolean,
  ): Observable<ActorProductivoMinero> {
    return this.http
      .patch<ActorProductivoMinero>(
        `${this.actorProductivoMineroUrl}/cambiar_estado/${id}`,
        { activo },
      )
      .pipe(
        tap(() =>
          this.cargarActoresProductivosMineros(
            this.filtrosActorProductivoMineroActuales,
          ),
        ),
      );
  }

  // ==========================================================
  // LABORATORIOS
  // ==========================================================

  private readonly laboratorioUrl = `${this.baseUrl}/laboratorio`;

  // Máximo ~10 registros esperados: sin paginación, igual que Codificación.
  readonly laboratorios = signal<Laboratorio[]>([]);
  readonly cargandoLaboratorios = signal<boolean>(false);

  /** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
  guardarLaboratorio(data: GuardarLaboratorioRequest): Observable<Laboratorio> {
    return this.http
      .post<Laboratorio>(this.laboratorioUrl, data)
      .pipe(tap(() => this.cargarLaboratorios()));
  }

  obtenerLaboratorios(): Observable<Laboratorio[]> {
    return this.http.get<Laboratorio[]>(this.laboratorioUrl);
  }

  /** Carga los laboratorios y actualiza el signal para que la tabla se refresque */
  cargarLaboratorios(): void {
    this.cargandoLaboratorios.set(true);
    this.obtenerLaboratorios().subscribe({
      next: (data) => {
        this.laboratorios.set(data);
        this.cargandoLaboratorios.set(false);
      },
      error: () => {
        this.cargandoLaboratorios.set(false);
      },
    });
  }

  cambiarEstadoLaboratorio(
    id: string,
    activo: boolean,
  ): Observable<Laboratorio> {
    return this.http
      .patch<Laboratorio>(`${this.laboratorioUrl}/cambiar_estado/${id}`, {
        activo,
      })
      .pipe(tap(() => this.cargarLaboratorios()));
  }

  // ==========================================================
  // ENTIDAD DE APORTE
  // ==========================================================

  private readonly entidadAporteUrl = `${this.baseUrl}/entidad-aporte`;

  readonly entidadesAporte = signal<EntidadAporte[]>([]);
  readonly cargandoEntidadesAporte = signal<boolean>(false);

  /** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
  guardarEntidadAporte(
    data: GuardarEntidadAporteRequest,
  ): Observable<EntidadAporte> {
    return this.http
      .post<EntidadAporte>(this.entidadAporteUrl, data)
      .pipe(tap(() => this.cargarEntidadesAporte()));
  }

  obtenerAllEntidadesAporte(): Observable<EntidadAporte[]> {
    return this.http.get<EntidadAporte[]>(this.baseUrl + '/entidad-aporte2');
  }

  obtenerEntidadesAporte(): Observable<EntidadAporte[]> {
    return this.http.get<EntidadAporte[]>(this.entidadAporteUrl);
  }

  /** Carga las entidades de aporte y actualiza el signal para que la tabla se refresque */
  cargarEntidadesAporte(): void {
    this.cargandoEntidadesAporte.set(true);
    this.obtenerEntidadesAporte().subscribe({
      next: (data) => {
        this.entidadesAporte.set(data);
        this.cargandoEntidadesAporte.set(false);
      },
      error: () => {
        this.cargandoEntidadesAporte.set(false);
      },
    });
  }

  cambiarEstadoEntidadAporte(
    id: number,
    activo: boolean,
  ): Observable<EntidadAporte> {
    return this.http
      .patch<EntidadAporte>(`${this.entidadAporteUrl}/cambiar_estado/${id}`, {
        activo,
      })
      .pipe(tap(() => this.cargarEntidadesAporte()));
  }

  // ==========================================================
  // MINERALES
  // ==========================================================

  // Recurso propio, no vive bajo /parametricas.
  private readonly mineralUrl = `${this.baseUrl}/mineral`;

  readonly minerales = signal<Mineral[]>([]);
  readonly cargandoMinerales = signal<boolean>(false);

  /** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
  guardarMineral(data: GuardarMineralRequest): Observable<Mineral> {
    return this.http
      .post<Mineral>(this.mineralUrl, data)
      .pipe(tap(() => this.cargarMinerales()));
  }

  obtenerMineralesGestion(): Observable<Mineral[]> {
    return this.http.get<Mineral[]>(this.baseUrl + '/allMinerales');
  }

  /** Carga los minerales y actualiza el signal para que la tabla se refresque */
  cargarMinerales(): void {
    this.cargandoMinerales.set(true);
    this.obtenerMineralesGestion().subscribe({
      next: (data) => {
        this.minerales.set(data);
        this.cargandoMinerales.set(false);
      },
      error: () => {
        this.cargandoMinerales.set(false);
      },
    });
  }

  cambiarEstadoMineral(id: number, activo: boolean): Observable<Mineral> {
    return this.http
      .patch<Mineral>(`${this.mineralUrl}/cambiar_estado/${id}`, { activo })
      .pipe(tap(() => this.cargarMinerales()));
  }
}
