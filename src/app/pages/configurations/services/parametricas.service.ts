import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  ActoresProductivosMinerosPaginados,
  ActorProductivoMinero,
  ActualizarCodificacionRequest,
  ActualizarCotizacionRequest,
  ActualizarEscalaPrecioRequest,
  Caja,
  Codificacion,
  Cotizacion,
  CotizacionesPaginadas,
  CrearCodificacionRequest,
  CrearCotizacionRequest,
  CrearEscalaPrecioRequest,
  CuentaFinanciera,
  DestinoGasto,
  EntidadAporte,
  EntidadFinanciera,
  EscalaPrecio,
  FiltrosActorProductivoMinero,
  FiltrosCotizacion,
  FormaPago,
  GuardarActorProductivoMineroRequest,
  GuardarCajaRequest,
  GuardarEntidadAporteRequest,
  GuardarEntidadFinancieraRequest,
  GuardarLaboratorioRequest,
  GuardarMineralRequest,
  GuardarTipoCalculoValorizacionRequest,
  KardexSubcuenta,
  Laboratorio,
  Mineral,
  Municipio,
  TipoActorProductivoMinero,
  TipoCalculoValorizacionAgrupado,
  TipoMovimientoKardex,
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
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);

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
  // ESCALA DE PRECIO (tabla de precios por tramo de ley, para "cargas")
  // ==========================================================

  private readonly escalaPrecioUrl = `${this.baseUrl}/escala-precio`;

  /** Tramos vigentes del mineral consultado por última vez, ordenados por ley. */
  readonly escalaPrecioVigente = signal<EscalaPrecio[]>([]);
  readonly cargandoEscalaPrecio = signal<boolean>(false);

  crearEscalaPrecio(
    data: CrearEscalaPrecioRequest,
  ): Observable<EscalaPrecio[]> {
    return this.http
      .post<EscalaPrecio[]>(this.escalaPrecioUrl, data)
      .pipe(tap(() => this.cargarEscalaPrecioVigente(data.idMineral)));
  }

  /** El back busca cada tramo por su `id` dentro de `filas`, por eso no
   *  necesita idMineral en el body; se lo pasamos aparte para recargar la
   *  tabla correcta después. */
  actualizarEscalaPrecio(
    data: ActualizarEscalaPrecioRequest,
    idMineral: number,
  ): Observable<EscalaPrecio[]> {
    return this.http
      .patch<EscalaPrecio[]>(this.escalaPrecioUrl, data)
      .pipe(tap(() => this.cargarEscalaPrecioVigente(idMineral)));
  }

  /** Sin `fecha`: la tabla vigente ahora mismo. Con `fecha` ("YYYY-MM-DD"):
   *  la tabla que regía ese día (historial). */
  obtenerEscalaPrecioVigente(
    idMineral: number,
    fecha?: string,
  ): Observable<EscalaPrecio[]> {
    let params = new HttpParams();
    if (fecha) params = params.set('fecha', fecha);
    return this.http.get<EscalaPrecio[]>(
      `${this.escalaPrecioUrl}/vigente/${idMineral}`,
      { params },
    );
  }

  /** Carga los tramos vigentes de un mineral (o los vigentes en `fecha`, para
   *  consultar el historial) y actualiza el signal para que la tabla se
   *  refresque sola. */
  cargarEscalaPrecioVigente(idMineral: number, fecha?: string): void {
    this.cargandoEscalaPrecio.set(true);
    this.obtenerEscalaPrecioVigente(idMineral, fecha).subscribe({
      next: (data) => {
        this.escalaPrecioVigente.set([...data].sort((a, b) => a.ley - b.ley));
        this.cargandoEscalaPrecio.set(false);
      },
      error: () => {
        // 404 = no había tabla vigente (ahora, o en la fecha consultada): no es un error a mostrar.
        this.escalaPrecioVigente.set([]);
        this.cargandoEscalaPrecio.set(false);
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
        console.log('actoresssss',this.actoresProductivosMineros);
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
  // MUNICIPIO
  // ==========================================================

  private municipios$?: Observable<Municipio[]>;

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  obtenerMunicipios(): Observable<Municipio[]> {
    if (!this.municipios$) {
      this.municipios$ = this.http
        .get<Municipio[]>(`${this.baseUrl}/municipio`)
        .pipe(shareReplay(1));
    }
    return this.municipios$;
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
  // ENTIDAD FINANCIERA (banco / entidad + sus cuentas)
  // ==========================================================

  private readonly entidadFinancieraUrl = `${this.baseUrl}/entidad-financiera`;

  // Máximo ~5 entidades esperadas: se listan todas (con sus cuentas) sin paginación.
  readonly entidadesFinancieras = signal<EntidadFinanciera[]>([]);
  readonly cargandoEntidadesFinancieras = signal<boolean>(false);

  /** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza.
   *  Acepta `cuentas[]` (upsert incremental). */
  guardarEntidadFinanciera(
    data: GuardarEntidadFinancieraRequest,
  ): Observable<EntidadFinanciera> {
    return this.http
      .post<EntidadFinanciera>(this.entidadFinancieraUrl, data)
      .pipe(tap(() => this.cargarEntidadesFinancieras()));
  }

  obtenerEntidadesFinancieras(): Observable<EntidadFinanciera[]> {
    return this.http.get<EntidadFinanciera[]>(this.entidadFinancieraUrl);
  }

  /** Carga las entidades financieras (con sus cuentas) y actualiza el signal
   *  para que la tabla se refresque sola. */
  cargarEntidadesFinancieras(): void {
    this.cargandoEntidadesFinancieras.set(true);
    this.obtenerEntidadesFinancieras().subscribe({
      next: (data) => {
        this.entidadesFinancieras.set(data);
        this.cargandoEntidadesFinancieras.set(false);
      },
      error: () => {
        this.cargandoEntidadesFinancieras.set(false);
      },
    });
  }

  /** Activa/desactiva la entidad (no toca sus cuentas). */
  cambiarEstadoEntidadFinanciera(
    id: number,
    activo: boolean,
  ): Observable<EntidadFinanciera> {
    return this.http
      .patch<EntidadFinanciera>(
        `${this.entidadFinancieraUrl}/cambiar_estado/${id}`,
        { activo },
      )
      .pipe(tap(() => this.cargarEntidadesFinancieras()));
  }

  /** Activa/desactiva una cuenta puntual de una entidad. */
  cambiarEstadoCuentaFinanciera(
    id: number,
    activo: boolean,
  ): Observable<CuentaFinanciera> {
    return this.http
      .patch<CuentaFinanciera>(
        `${this.entidadFinancieraUrl}/cuenta/cambiar_estado/${id}`,
        { activo },
      )
      .pipe(tap(() => this.cargarEntidadesFinancieras()));
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

  // ==========================================================
  // TIPO DE CÁLCULO VALORIZACIÓN (Gastos de Tratamiento, Penalidades y Otros)
  // idTipoCalculo fijo: 1 = Gastos de Tratamiento, 2 = Penalidades, 3 = Otros
  // (AL, ROLLBACK).
  // ==========================================================

  private readonly tipoCalculoValorizacionUrl = `${this.baseUrl}/tipo-calculo-valorizacion`;

  // El back ya devuelve los tres grupos juntos en una sola respuesta, así
  // que una sola carga (cargarTipoCalculoValorizacion) alimenta los tres signals.
  readonly gastosTratamiento = signal<
    TipoCalculoValorizacionAgrupado['gastos']
  >([]);
  readonly penalidadesValorizacion = signal<
    TipoCalculoValorizacionAgrupado['penalidades']
  >([]);
  readonly otrosCalculoValorizacion = signal<
    TipoCalculoValorizacionAgrupado['otros']
  >([]);
  readonly cargandoTipoCalculoValorizacion = signal<boolean>(false);

  crearTipoCalculoValorizacion(
    data: GuardarTipoCalculoValorizacionRequest,
  ): Observable<TipoCalculoValorizacionAgrupado['gastos'][number]> {
    return this.http
      .post<
        TipoCalculoValorizacionAgrupado['gastos'][number]
      >(this.tipoCalculoValorizacionUrl, data)
      .pipe(tap(() => this.cargarTipoCalculoValorizacion()));
  }

  /** A diferencia del resto de catálogos, este recurso separa POST (crear)
   *  de PATCH (actualizar); y el PATCH pide el body completo, no parcial:
   *  hay que reenviar descripcion e idTipoCalculo igual que en la creación. */
  actualizarTipoCalculoValorizacion(
    data: GuardarTipoCalculoValorizacionRequest,
  ): Observable<TipoCalculoValorizacionAgrupado['gastos'][number]> {
    return this.http
      .patch<
        TipoCalculoValorizacionAgrupado['gastos'][number]
      >(this.tipoCalculoValorizacionUrl, data)
      .pipe(tap(() => this.cargarTipoCalculoValorizacion()));
  }

  obtenerTipoCalculoValorizacionAgrupado(): Observable<TipoCalculoValorizacionAgrupado> {
    return this.http.get<TipoCalculoValorizacionAgrupado>(
      this.tipoCalculoValorizacionUrl,
    );
  }

  /** Carga gastos de tratamiento, penalidades y otros juntos (una sola
   *  llamada al back) y actualiza los tres signals para que las tablas se
   *  refresquen. */
  cargarTipoCalculoValorizacion(): void {
    this.cargandoTipoCalculoValorizacion.set(true);
    this.obtenerTipoCalculoValorizacionAgrupado().subscribe({
      next: (data) => {
        this.gastosTratamiento.set(data.gastos);
        this.penalidadesValorizacion.set(data.penalidades);
        this.otrosCalculoValorizacion.set(data.otros);
        this.cargandoTipoCalculoValorizacion.set(false);
      },
      error: () => {
        this.cargandoTipoCalculoValorizacion.set(false);
      },
    });
  }

  cambiarEstadoTipoCalculoValorizacion(
    id: number,
    activo: boolean,
  ): Observable<TipoCalculoValorizacionAgrupado['gastos'][number]> {
    return this.http
      .patch<
        TipoCalculoValorizacionAgrupado['gastos'][number]
      >(`${this.tipoCalculoValorizacionUrl}/cambiar_estado/${id}`, { activo })
      .pipe(tap(() => this.cargarTipoCalculoValorizacion()));
  }

  // ==========================================================
  // CATÁLOGOS DEL KARDEX DE ANTICIPOS (forma de pago, tipo de movimiento,
  // subcuenta) — usados por el formulario de movimiento de kardex.
  // ==========================================================

  private formasPago$?: Observable<FormaPago[]>;

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  obtenerFormasPago(): Observable<FormaPago[]> {
    if (!this.formasPago$) {
      this.formasPago$ = this.http
        .get<FormaPago[]>(`${this.baseUrl}/forma-pago`)
        .pipe(shareReplay(1));
    }
    return this.formasPago$;
  }

  private tiposMovimientoKardex$?: Observable<TipoMovimientoKardex[]>;

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  obtenerTiposMovimientoKardex(): Observable<TipoMovimientoKardex[]> {
    if (!this.tiposMovimientoKardex$) {
      this.tiposMovimientoKardex$ = this.http
        .get<TipoMovimientoKardex[]>(`${this.baseUrl}/tipo-movimiento-kardex`)
        .pipe(shareReplay(1));
    }
    return this.tiposMovimientoKardex$;
  }

  private destinosGasto$?: Observable<DestinoGasto[]>;

  /** Catálogo cacheado de destinos de gasto (categoría contable del recibo).
   *  Trae todos; filtrar por `esEgreso` según el tipo de recibo. */
  obtenerDestinosGasto(): Observable<DestinoGasto[]> {
    if (!this.destinosGasto$) {
      this.destinosGasto$ = this.http
        .get<DestinoGasto[]>(`${this.baseUrl}/destino-gasto`)
        .pipe(shareReplay(1));
    }
    return this.destinosGasto$;
  }

  private kardexSubcuentas$?: Observable<KardexSubcuenta[]>;

  /** Catálogo cacheado — extensible (PRINCIPAL, COMPRESORA...). `forzar: true`
   *  descarta la caché (p.ej. si en algún momento se agrega una subcuenta nueva). */
  obtenerKardexSubcuentas(forzar = false): Observable<KardexSubcuenta[]> {
    if (forzar || !this.kardexSubcuentas$) {
      this.kardexSubcuentas$ = this.http
        .get<KardexSubcuenta[]>(`${this.baseUrl}/kardex-subcuenta`)
        .pipe(shareReplay(1));
    }
    return this.kardexSubcuentas$;
  }

  // ==========================================================
  // CAJA (fondo de efectivo — lo usa la Caja de Flujo en Contabilidad)
  // ==========================================================

  private readonly cajaUrl = `${this.baseUrl}/caja`;

  // Máximo unas pocas cajas esperadas: se listan todas sin paginación.
  readonly cajas = signal<Caja[]>([]);
  readonly cargandoCajas = signal<boolean>(false);

  /** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza. */
  guardarCaja(data: GuardarCajaRequest): Observable<Caja> {
    return this.http
      .post<Caja>(this.cajaUrl, data)
      .pipe(tap(() => this.cargarCajas()));
  }

  obtenerCajas(): Observable<Caja[]> {
    return this.http.get<Caja[]>(this.cajaUrl);
  }

  /** Carga las cajas y actualiza el signal para que la tabla/selector se refresque */
  cargarCajas(): void {
    this.cargandoCajas.set(true);
    this.obtenerCajas().subscribe({
      next: (data) => {
        this.cajas.set(data);
        this.cargandoCajas.set(false);
      },
      error: () => {
        this.cargandoCajas.set(false);
      },
    });
  }

  cambiarEstadoCaja(id: number, activo: boolean): Observable<Caja> {
    return this.http
      .patch<Caja>(`${this.cajaUrl}/cambiar_estado/${id}`, { activo })
      .pipe(tap(() => this.cargarCajas()));
  }
}
