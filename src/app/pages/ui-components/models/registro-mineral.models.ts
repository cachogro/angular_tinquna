// src/app/pages/ui-components/models/registro-mineral.models.ts

export interface CodificacionCatalogo {
  id: string;
  codigo: string;
  nombre: string;
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
  numeroSacos: number;
  pesoNeto: string; // el backend lo devuelve como string numérico
  anticipo: string;
  ley: string;
  totalValorBruto: string;
  fechaOperacion: string;
  observaciones?: string | null;
  idEstado: number;
  estado?: EstadoOperacion;
}

/** id presente = actualizar; sin id = crear */
export interface GuardarRegistroMineralRequest {
  id?: string;
  idCodificacion: string;
  idPersona: string;
  numeroSacos: number;
  pesoNeto: number;
  anticipo: number;
  ley: number;
  totalValorBruto: number;
  fechaOperacion: string; // 'YYYY-MM-DD'
  observaciones?: string;
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
