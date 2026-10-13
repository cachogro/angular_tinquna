// src/app/pages/configurations/roles-permisos/models/roles-permisos.models.ts

export interface RolMatriz {
  /** bigint: llega como string. */
  id: string;
  /** ej: 'ROLE_OPERADOR'. */
  codigo: string;
  nombre: string;
  /** El administrador tiene siempre todos los permisos y no se edita. */
  esAdministrador: boolean;
}

export interface PermisoMatriz {
  /** ej: 'contabilidad.recibos' (ver core/auth/models/permisos.ts). */
  codigo: string;
  nombre: string;
  descripcion: string | null;
  /** Códigos de rol a los que se les puede otorgar el permiso. */
  rolesPermitidos: string[];
  /** Códigos de rol que hoy lo tienen. */
  rolesAsignados: string[];
}

export interface ModuloMatriz {
  modulo: string;
  permisos: PermisoMatriz[];
}

/** GET /administrador/roles_permisos */
export interface MatrizPermisos {
  roles: RolMatriz[];
  modulos: ModuloMatriz[];
}

/** POST /administrador/roles_permisos — se envía la lista completa del rol:
 *  lo que no venga se le quita. */
export interface GuardarPermisosRolRequest {
  idRol: number;
  permisos: string[];
}
