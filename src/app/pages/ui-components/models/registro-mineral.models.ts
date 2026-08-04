// src/app/pages/ui-components/models/registro-mineral.models.ts
import { ActorProductivoMinero } from 'src/app/pages/configurations/models/persona.models';

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
  { id: 1, nombre: 'EN RECEPCIÓN' },
  { id: 2, nombre: 'APROBADO' },
  { id: 3, nombre: 'RECHAZADO A TOL' },
  { id: 4, nombre: 'CANCELADO' },
  { id: 5, nombre: 'TRANZADO' },
  { id: 6, nombre: 'REMUESTREO' },
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
  actorProductivoMinero?: ActorProductivoMinero | null;
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
  balanzaL: string; // el backend lo devuelve como string numérico
  balanzaT: string;
  anticipo: string;
  humedad?: string | number | null;
  idPersonalInterno?: string | null;
  personalInterno?: PersonaResumen | null;
  /** @deprecated el backend ya no gestiona este campo */
  totalValorBruto?: string;
  fechaRecepcion: string; // ISO 8601 con offset, ej. '2026-07-22T14:35:00-04:00'
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
  balanzaL: number;
  balanzaT: number;
  anticipo: number;
  humedad: number;
  /** Id de la persona (tipo muestrero) asignada a la recepción. Opcional. */
  idPersonalInterno?: string;
  fechaRecepcion: string; // ISO 8601 con offset, ej. '2026-07-22T14:35:00-04:00'
  observaciones: string;
  // detalles: DetalleMineralRequest[];
}

export type OrdenDireccion = 'ASC' | 'DESC';

export interface FiltrosRegistroMineral {
  page: number;
  limit: number;
  busqueda?: string; // nombre de proveedor
  codigoOperacion?: string; // código o número de operación/correlativo
  numeroDocumento?: string; // carnet
  idEstado?: number;
  fechaDesde?: string; // 'YYYY-MM-DD'
  fechaHasta?: string; // 'YYYY-MM-DD'
  orderBy?: string;
  orderDirection?: OrdenDireccion;
}

export interface RegistrosMineralPaginados {
  data: RegistroMineral[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
