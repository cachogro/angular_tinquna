export interface Mineral {
  id: number;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  calculoRegalia?: string | null;
  tipo?: string;
  activo?: boolean;
}

/** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
export interface GuardarMineralRequest {
  id?: number;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  tipo?: string;
}

export interface Codificacion {
  id: string;
  codigo: string;
  nombre: string;
  minerales: Mineral[];
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

export interface CrearCodificacionRequest {
  codigo: string;
  nombre: string;
  minerales: number[];
}

export interface ActualizarCodificacionRequest {
  id: string;
  codigo: string;
  nombre: string;
  minerales: number[];
}

// ==========================================================
// COTIZACIONES
// ==========================================================

/**
 * Versión resumida del mineral tal como viene anidado en la
 * respuesta de cotización. El backend devuelve el `id` como
 * string en este anidado (aunque en /allMinerales viene number),
 * por eso se tipa como number | string para no romper en runtime.
 */
export interface MineralEnCotizacion {
  id: number | string;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  tipo?: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface Cotizacion {
  id: number;
  idMineral: number;
  cotizacionMineralDolares: number;
  alicuotaExterna: number;
  alicuotaInterna: number;
  fechaVigenciaInicial: string;
  fechaVigenciaFinal: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
  mineral?: MineralEnCotizacion;
}

/** El back asigna fechaVigenciaInicial automáticamente, por eso no va aquí */
export interface CrearCotizacionRequest {
  idMineral: number;
  cotizacionMineralDolares: number;
  alicuotaExterna?: number;
  alicuotaInterna?: number;
  fechaVigenciaFinal: string;
}

/** No se permite cambiar idMineral ni fechaVigenciaInicial.
 *  Todos los campos salvo `id` son opcionales: lo que se omite, no se modifica. */
export interface ActualizarCotizacionRequest {
  id: number;
  cotizacionMineralDolares?: number;
  alicuotaExterna?: number;
  alicuotaInterna?: number;
  fechaVigenciaFinal?: string;
}

export interface FiltrosCotizacion {
  page: number;
  limit: number;
  busqueda?: string;
  idMineral?: number;
  /** true = solo la cotización vigente de cada mineral */
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'mineral' | 'fechaVigenciaInicial' | 'fechaVigenciaFinal';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
  vigente?: boolean;
  activo?: boolean;
}

export interface CotizacionesPaginadas {
  data: Cotizacion[];
  total: number;
  page: number;
  limit: number;
}

export interface Ingenio {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

// ==========================================================
// ACTOR PRODUCTIVO MINERO (antes "Ingenio")
// ==========================================================

export interface TipoActorProductivoMinero {
  id: number | string;
  descripcion: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface ActorProductivoMinero {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  idTipoActorProductivoMinero: number | string;
  tipoActorProductivoMinero?: TipoActorProductivoMinero;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

export interface GuardarActorProductivoMineroRequest {
  id?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  idTipoActorProductivoMinero: number | string;
}

export interface FiltrosActorProductivoMinero {
  page: number;
  limit: number;
  /** Solo se busca por nombre */
  busqueda?: string;
  activo?: boolean;
  idTipoActorProductivoMinero?: number | string;
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'nombre' | 'direccion' | 'telefono' | 'tipoActorProductivoMinero';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
}

export interface ActoresProductivosMinerosPaginados {
  data: ActorProductivoMinero[];
  total: number;
  page: number;
  limit: number;
}

export interface Laboratorio {
  id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activo: boolean;
  fechaRegistro?: string;
  fechaUltimaModificacion?: string;
  usuarioUltimaModificacion?: string;
}

export interface GuardarLaboratorioRequest {
  id?: string | number;
  nombre: string;
  direccion?: string;
  telefono?: string;
}


// Bases de cálculo del aporte: VBV = Valor Bruto de Venta, VNV = Valor Neto de Venta
export type TipoBaseAporte = 'VBV' | 'VNV';

// Detalle de cada aporte
export interface DetalleAporte {
  alicuota: number;
  tipoBaseAporte: TipoBaseAporte;
}

/** Catálogo fijo, codificado en el front (el back no expone servicio para esto) */
export interface TipoEntidadAporte {
  id: number;
  descripcion: string;
}

// Entidad de aporte completa
export interface EntidadAporte {
  id: number;               // En la respuesta es number, no string
  descripcion: string;
  activo: boolean;
  usuarioUltimaModificacion: string | null;
  fechaUltimaModificacion: string | null; // ISO date string o null
  detalleAporte: DetalleAporte[] | null;  // Puede ser null
  idTipoEntidadAporte: number | string;
  tipoEntidadAporte?: TipoEntidadAporte;
}

/** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
export interface GuardarEntidadAporteRequest {
  id?: number;
  descripcion: string;
  detalleAporte: DetalleAporte[];
  idTipoEntidadAporte: number;
}