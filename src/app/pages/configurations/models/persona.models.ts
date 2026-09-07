// src/app/pages/configurations/models/persona.models.ts

export interface TipoDocumentoCatalogo {
  id: number;
  nombre: string;
}

export interface PersonaTipoCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
}

/** POST /parametricas/persona-tipo — sin `id` crea, con `id` actualiza.
 *  El backend guarda todo en mayúsculas. `descripcion` "" se guarda como null. */
export interface GuardarPersonaTipoRequest {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
}

export interface TipoActorProductivoMineroCatalogo {
  id: string;
  descripcion: string;
}

export interface ActorProductivoMinero {
  id: string;
  idTipoActorProductivoMinero: string;
  tipoActorProductivoMinero?: TipoActorProductivoMineroCatalogo;
  nombre: string;
  direccion?: string;
  telefono?: string;
}

export interface PersonaTipoAsignado {
  idPersona: string;
  idPersonaTipo: number;
  personaTipo?: PersonaTipoCatalogo; // puede venir undefined si el backend tiene el bug de paginación+join
}

export interface PersonaCI {
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  idTipoDocumento: number;
  tipoDocumento?: TipoDocumentoCatalogo;
  numeroDocumento: string;
  celular: string;
  observaciones?: string | null;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: ActorProductivoMinero | null;
  personaTipos: PersonaTipoAsignado[];
  /** Solo para personal de la propia empresa (actor productivo minero id 1).
   *  Formato "YYYY-MM-DD". */
  fechaNacimiento?: string | null;
  fechaInicioLaboral?: string | null;
  direccion?: string | null;
}

/** id presente = actualizar (solo se mandan los campos a cambiar); sin id = crear (todos requeridos) */
export interface GuardarPersonaRequest {
  id?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  idTipoDocumento?: string | number;
  numeroDocumento?: string;
  celular?: string;
  tiposPersona?: number[];
  idActorProductivoMinero?: string | number | null;
  /** Solo se envían cuando el actor productivo minero es la propia empresa
   *  (id 1, "TINKURIKUNA"): registro completo de personal. Formato "YYYY-MM-DD". */
  fechaNacimiento?: string;
  fechaInicioLaboral?: string;
  direccion?: string;
}

export interface FiltrosPersona {
  page: number;
  limit: number;
  busqueda?: string;
  numeroDocumento?: string;
  idTipoPersona?: number;
  activo?: boolean;
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'nombres' | 'numeroDocumento';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
}

export interface PersonasPaginadas {
  data: PersonaCI[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
