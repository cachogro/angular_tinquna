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
