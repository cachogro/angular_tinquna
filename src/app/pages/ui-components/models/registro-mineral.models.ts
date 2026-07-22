// src/app/pages/ui-components/models/registro-mineral.models.ts

export interface MineralResumen {
  id: number | string;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  tipo?: string;
}

export interface CodificacionCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  /** Minerales que integran esta codificación (ej. BZL -> Zinc, Plata) */
  minerales: MineralResumen[];
}

export interface EstadoOperacion {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

/** Catálogo fijo (dado que rara vez cambia). Si luego tienes un endpoint,
 *  reemplaza el uso de esta constante por una llamada al servicio. */
export const ESTADOS_OPERACION: EstadoOperacion[] = [
  { id: 1, nombre: 'PENDIENTE' },
  { id: 2, nombre: 'EN RECEPCIÓN' },
  { id: 3, nombre: 'EN REVISIÓN' },
  { id: 4, nombre: 'APROBADO' },
  { id: 5, nombre: 'RECHAZADO A TOL' },
  { id: 6, nombre: 'CANCELADO' },
  { id: 7, nombre: 'LIQUIDADO' },
];

export const ESTADO_LIQUIDADO_ID = 7;

export interface PersonaResumen {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroDocumento: string;
  celular?: string;
  idActorProductivoMinero?: string | null;
}

export type LeyUnidad = '%' | 'g/TM';

export interface DetalleMineralRegistro {
  id?: string;
  idRecepcionMineral?: string;
  idMineral: string;
  mineral?: MineralResumen;
  ley: number | string;
  leyUnidad: LeyUnidad;
}

export interface RegistroMineral {
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion: string | null;
  id: string;
  correlativo: string;
  codigoOperacion: string;
  idCodificacion: string;
  codificacion?: CodificacionCatalogo;
  idPersona: string;
  persona?: PersonaResumen;
  numeroSacos: number | null;
  pesoNeto: string; // el backend lo devuelve como string numérico
  anticipo: string;
  /** @deprecated el backend ya no gestiona este campo */
  totalValorBruto?: string;
  fechaOperacion: string; // ISO 8601 con offset, ej. '2026-07-22T14:35:00-04:00'
  observaciones?: string | null;
  idEstado: number;
  estado?: EstadoOperacion;
  /** Una fila por cada mineral que integra la codificación, con su ley individual */
  detalles: DetalleMineralRegistro[];
}

export interface DetalleMineralRequest {
  idMineral: number;
  ley: number;
  leyUnidad: LeyUnidad;
}

/** id presente = actualizar; sin id = crear.
 *  Ya no se envía totalValorBruto: el backend dejó de gestionarlo. */
export interface GuardarRegistroMineralRequest {
  id?: string;
  idCodificacion: string;
  idPersona: string;
  numeroSacos: number | null;
  pesoNeto: number;
  anticipo: number;
  fechaOperacion: string; // ISO 8601 con offset, ej. '2026-07-22T14:35:00-04:00'
  observaciones: string;
  detalles: DetalleMineralRequest[];
}

export interface FiltrosRegistroMineral {
  page: number;
  limit: number;
  busqueda?: string; // nombre de proveedor
  numeroDocumento?: string; // carnet
  idEstado?: number;
  fechaDesde?: string; // 'YYYY-MM-DD'
  fechaHasta?: string; // 'YYYY-MM-DD'
}

export interface RegistrosMineralPaginados {
  data: RegistroMineral[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}