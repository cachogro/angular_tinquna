// export interface Mineral {
//   id: number;
//   descripcion: string;
//   simbolo: string;
//   activo?: boolean;
// }

// export interface Codificacion {
//   id: string;
//   codigo: string;
//   nombre: string;
//   minerales: Mineral[];
// }

// export interface CrearCodificacionPayload {
//   codigo: string;
//   nombre: string;
//   minerales: number[];
// }

// export interface ActualizarCodificacionPayload extends CrearCodificacionPayload {
//   id: string;
// }

// // A futuro, cuando implementes Ley e Ingenio, agrega aquí sus interfaces
// // siguiendo el mismo patrón: Ley, CrearLeyPayload, ActualizarLeyPayload, etc.

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

/** No se permite cambiar idMineral ni fechaVigenciaInicial */
export interface ActualizarCotizacionRequest {
  id: number;
  cotizacionMineralDolares: number;
  alicuotaExterna?: number;
  alicuotaInterna?: number;
  fechaVigenciaFinal: string;
}

export interface FiltrosCotizacion {
  page: number;
  limit: number;
  busqueda?: string;
  idMineral?: number;
  /** true = solo la cotización vigente de cada mineral */
   /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'nombre' | 'fechaRegistro';
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

/**
 * El back usa un solo POST tanto para crear como para actualizar:
 * sin `id` -> crea, con `id` -> actualiza.
 */
export interface GuardarIngenioRequest {
  id?: string;
  nombre: string;
  direccion: string;
  telefono: string;
}

export interface FiltrosIngenio {
  page: number;
  limit: number;
  /** Solo se busca por nombre */
  busqueda?: string;
  activo?: boolean;
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'nombre' | 'fechaRegistro';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
}

export interface IngeniosPaginados {
  data: Ingenio[];
  total: number;
  page: number;
  limit: number;
}
