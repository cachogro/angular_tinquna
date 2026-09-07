// src/app/pages/contabilidad/models/kardex.models.ts
// Kardex: cuenta corriente de anticipos por actor productivo minero o por
// persona. Un solo kardex ABIERTO por destinatario; al cerrar se abre el
// siguiente número arrastrando el saldo (saldoCierre(N) = saldoInicial(N+1)).

export type TipoKardex = 'ACTOR' | 'PERSONAL';
export type EstadoKardex = 'ABIERTO' | 'CERRADO';

/** Actor tal como viene anidado en el kardex (subset). */
export interface ActorEnKardex {
  id: string;
  nombre: string;
}

/** Persona tal como viene anidada en el kardex (subset). */
export interface PersonaEnKardex {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}

export interface Kardex {
  id: string;
  tipo: TipoKardex;
  idActorProductivoMinero?: string | null;
  idPersona?: string | null;
  actorProductivoMinero?: ActorEnKardex | null;
  persona?: PersonaEnKardex | null;
  /** N° del libro (1, 2, 3…), correlativo por destinatario. No es el id. */
  numero: number;
  gestion: number;
  descripcion: string;
  estado: EstadoKardex;
  saldoInicial: string;
  /** "TOTAL ANTICIPOS POR COBRAR": DEBE sube, HABER baja. */
  saldoActual: string;
  /** Se llena al cerrar. */
  saldoCierre?: string | null;
  idKardexAnterior?: string | null;
  kardexAnterior?: Partial<Kardex> | null;
  /** "YYYY-MM-DD" */
  fechaApertura?: string | null;
  fechaCierre?: string | null;
  cerradoPor?: string | null;
  activo?: boolean;
  usuarioRegistro?: string | null;
  usuarioUltimaModificacion?: string | null;
  fechaRegistro?: string | null;
  fechaUltimaModificacion?: string | null;
}

/** POST /contabilidad/kardex — abre el N°1 de un destinatario. */
export interface AbrirKardexRequest {
  tipo: TipoKardex;
  idActorProductivoMinero?: string;
  idPersona?: string;
  descripcion?: string;
  gestion?: number;
  saldoInicial: number;
}

export type OrdenKardex = 'id' | 'numero' | 'gestion' | 'estado' | 'fechaApertura';

/** GET /contabilidad/kardex — todos los parámetros son opcionales; sin
 *  ninguno trae todo paginado (default page=1, limit=10). */
export interface FiltrosKardex {
  page?: number;
  limit?: number;
  tipo?: TipoKardex;
  estado?: EstadoKardex;
  gestion?: number;
  /** Historial completo (N°1, N°2…) de un actor puntual. */
  idActorProductivoMinero?: string;
  /** Historial completo de una persona puntual. */
  idPersona?: string;
  /** Busca en nombre de actor, nombres/apellidos de persona y descripción. */
  busqueda?: string;
  orderBy?: OrdenKardex;
  orderDirection?: 'ASC' | 'DESC';
}

export interface KardexPaginado {
  data: Kardex[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Respuesta de PATCH /contabilidad/kardex/:id/cerrar */
export interface CerrarKardexResponse {
  cerrado: Kardex;
  nuevo: Kardex;
}
