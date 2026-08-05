// src/app/core/auth/models/usuario-admin.models.ts

export interface PersonaRegistro {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular: string;
  correoElectronico: string;
  fechaNacimiento: string; // formato 'DD-MM-YYYY' según tu backend
  numeroDocumento: string;
  idLugarEmisionDocumento: string;
  idTipoDocumento: string;
}

export interface RegistrarUsuarioRequest {
  usuario: string;
  contrasena: string;
  idRol: string;
  persona: PersonaRegistro;
}

// Para actualizar, todos los campos son opcionales (PATCH-like aunque el verbo sea PUT)
export interface ActualizarUsuarioRequest {
  usuario?: string;
  idRol?: string | number;
  persona?: Partial<PersonaRegistro>;
}

export interface PersonaUsuarioAdmin {
  activo: boolean;
  usuarioUltimaModificacion: string | null;
  fechaUltimaModificacion: string;
  id: string;
  celular: string;
  correoElectronico: string;
  fechaNacimiento: string;
  idLugarEmisionDocumento: string | null;
  idTipoDocumento: string | null;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroDocumento: string;
  fechaRegistro?: string;
}

export interface RolAsignado {
  id: string;
  nombre: string;
  descripcion: string;
  codigo: string;
  activo: boolean;
}

/**
 * Respuesta de crear/actualizar usuario.
 * OJO: el endpoint de crear devuelve "rolAsignado" (objeto único),
 * el de actualizar devuelve "roles" (array). Se soportan ambos casos
 * y el getter `rol` normaliza a uno solo, que es lo que usarás en la UI.
 */
export interface UsuarioAdmin {
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion: string;
  id: string;
  usuario: string;
  cambioClave: boolean;
  bloqueadoHasta: string | null;
  ultimoAcceso: string | null;
  persona: PersonaUsuarioAdmin;
  fechaRegistro?: string;
  rolAsignado?: RolAsignado;
  roles?: RolAsignado[];
}

/** Devuelve el rol del usuario sin importar si vino como "rolAsignado" o "roles" */
export function obtenerRolUsuario(usuario: UsuarioAdmin): RolAsignado | undefined {
  return usuario.rolAsignado ?? usuario.roles?.[0];
}

// Catálogos — placeholders hasta confirmar si hay endpoint o son fijos.
// Basado en los códigos que ya vimos: ADMINISTRADOR=1, OPERADOR=2, TECNICO=3.
export interface RolCatalogo {
  id: string;
  nombre: string;
  codigo: string;
}

export const ROLES_CATALOGO_TEMPORAL: RolCatalogo[] = [
  { id: '1', nombre: 'Administrador', codigo: 'ROLE_ADMINISTRADOR' },
  { id: '2', nombre: 'Operador', codigo: 'ROLE_OPERADOR' },
  { id: '3', nombre: 'Técnico', codigo: 'ROLE_TECNICO' },
];

// ---------------------------------------------------------------------
// Listado paginado
// ---------------------------------------------------------------------
export interface UsuariosPaginados {
  data: UsuarioAdmin[];
  total: number;
  page: number;
  limit: number;
}

export interface FiltrosListadoUsuarios {
  page: number;
  limit: number;
  busqueda?: string;
  idRol?: string;
  activo?: boolean;
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'usuario' | 'nombres';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
}
