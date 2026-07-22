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
}

export interface FiltrosPersona {
  page: number;
  limit: number;
  busqueda?: string;
  numeroDocumento?: string;
  idTipoPersona?: number;
  activo?: boolean;
}

export interface PersonasPaginadas {
  data: PersonaCI[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
