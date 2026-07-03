// src/app/core/auth/models/auth.models.ts

export interface Persona {
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
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  codigo: string; // ej: 'ROLE_ADMINISTRADOR', 'ROLE_OPERADOR'
  activo: boolean;
}

export interface Usuario {
  id: string;
  usuario: string;
  persona: Persona;
  roles: Rol[];
}

export interface LoginRequest {
  usuario: string;
  contrasena: string;
}

export interface LoginResponse {
  user: Usuario;
  token: string;
  refreshToken: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

// Códigos de rol centralizados para no usar strings "mágicos" en el código
export enum RolCodigo {
  ADMINISTRADOR = 'ROLE_ADMINISTRADOR',
  OPERADOR = 'ROLE_OPERADOR',
}
