// src/app/pages/configurations/historial-accesos/models/bitacora-acceso.models.ts

export enum TipoEventoBitacora {
  LOGIN_EXITOSO = 'LOGIN_EXITOSO',
  LOGIN_FALLIDO_USUARIO = 'LOGIN_FALLIDO_USUARIO',
  LOGIN_FALLIDO_CONTRASENA = 'LOGIN_FALLIDO_CONTRASENA',
  LOGIN_BLOQUEADO = 'LOGIN_BLOQUEADO',
  CUENTA_BLOQUEADA = 'CUENTA_BLOQUEADA',
  LOGOUT = 'LOGOUT',
}

export interface OpcionTipoEvento {
  value: TipoEventoBitacora;
  label: string;
  tono: 'exito' | 'advertencia' | 'peligro' | 'neutro';
}

export const OPCIONES_TIPO_EVENTO: OpcionTipoEvento[] = [
  { value: TipoEventoBitacora.LOGIN_EXITOSO, label: 'Login exitoso', tono: 'exito' },
  { value: TipoEventoBitacora.LOGIN_FALLIDO_USUARIO, label: 'Usuario no existe', tono: 'advertencia' },
  { value: TipoEventoBitacora.LOGIN_FALLIDO_CONTRASENA, label: 'Contraseña incorrecta', tono: 'advertencia' },
  { value: TipoEventoBitacora.LOGIN_BLOQUEADO, label: 'Intento con cuenta bloqueada', tono: 'peligro' },
  { value: TipoEventoBitacora.CUENTA_BLOQUEADA, label: 'Cuenta recién bloqueada', tono: 'peligro' },
  { value: TipoEventoBitacora.LOGOUT, label: 'Cierre de sesión', tono: 'neutro' },
];

/** Mapa rápido tipoEvento -> opción, para no recorrer el array en cada fila de la tabla. */
export const TIPO_EVENTO_MAP: Record<TipoEventoBitacora, OpcionTipoEvento> =
  OPCIONES_TIPO_EVENTO.reduce(
    (map, opcion) => ({ ...map, [opcion.value]: opcion }),
    {} as Record<TipoEventoBitacora, OpcionTipoEvento>,
  );

export interface RegistroBitacoraAcceso {
  id: string;
  /** null cuando el intento fue con un usuario que no existe: usar `usuarioIngresado` en ese caso. */
  idUsuario: string | null;
  usuarioIngresado: string;
  tipoEvento: TipoEventoBitacora;
  descripcion: string | null;
  ip: string | null;
  userAgent: string | null;
  exitoso: boolean;
  fechaRegistro: string;
}

export interface BitacoraAccesoPaginada {
  data: RegistroBitacoraAcceso[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosBitacoraAcceso {
  page: number;
  limit: number;
  busqueda?: string;
  idUsuario?: string;
  tipoEvento?: TipoEventoBitacora;
  exitoso?: boolean;
  /** formato YYYY-MM-DD, inclusive */
  fechaDesde?: string;
  /** formato YYYY-MM-DD, inclusive */
  fechaHasta?: string;
  orderBy?: 'fechaRegistro' | 'tipoEvento' | 'usuarioIngresado';
  orderDirection?: 'ASC' | 'DESC';
}
