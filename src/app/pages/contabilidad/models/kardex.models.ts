// src/app/pages/contabilidad/models/kardex.models.ts
// Kardex: cuenta corriente de anticipos por actor productivo minero o por
// persona. Un solo kardex ABIERTO por destinatario; al cerrar se abre el
// siguiente número arrastrando el saldo (saldoCierre(N) = saldoInicial(N+1)).

// 'PERSONAL' = personal interno de la propia empresa (persona con
// idActorProductivoMinero === '1'); 'ASOCIADO' = el resto de personas
// (ligadas a otro actor, o sueltas — incluye null/vacío). El front decide
// cuál mandar mirando `persona.idActorProductivoMinero` antes de abrir el
// kardex; el back igual lo valida y rechaza si no coincide.
export type TipoKardex = 'ACTOR' | 'ASOCIADO' | 'PERSONAL' | 'CLIENTE';
export type EstadoKardex = 'ABIERTO' | 'CERRADO';

/** Actividad calculada por el back: baja lógica por días sin movimientos
 *  (KARDEX_DIAS_INACTIVIDAD del .env). Un kardex INACTIVO sigue en los
 *  listados pero no admite transacciones hasta que un ADMINISTRADOR /
 *  OPERADOR lo reactive. */
export type EstadoActividadKardex = 'ACTIVO' | 'INACTIVO';

export interface ActividadKardex {
  estado: EstadoActividadKardex;
  /** "YYYY-MM-DD": último movimiento, apertura o reactivación (lo más reciente). */
  ultimaActividad: string;
  /** "YYYY-MM-DD": día en que pasa (o pasó) a INACTIVO. */
  inactivoDesde: string;
  diasSinActividad: number;
  /** Límite vigente en días. */
  diasInactividad: number;
}

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

/** Cliente tal como viene anidado en el kardex (subset). */
export interface ClienteEnKardex {
  id: string;
  nombre: string;
}

export interface Kardex {
  id: string;
  tipo: TipoKardex;
  idActorProductivoMinero?: string | null;
  idPersona?: string | null;
  idCliente?: string | null;
  actorProductivoMinero?: ActorEnKardex | null;
  persona?: PersonaEnKardex | null;
  cliente?: ClienteEnKardex | null;
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
  /** ISO; se llena al reactivar un kardex INACTIVO. */
  fechaReactivacion?: string | null;
  reactivadoPor?: string | null;
  /** Null en kardex cerrados o anulados. */
  actividad?: ActividadKardex | null;
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
  idCliente?: string;
  descripcion?: string;
  gestion?: number;
  saldoInicial: number;
}

export type OrdenKardex = 'id' | 'numero' | 'gestion' | 'estado' | 'fechaApertura';

/** GET /contabilidad/kardex/reporte/deudas-totales/excel. El back marca
 *  INACTIVO según KARDEX_DIAS_INACTIVIDAD (.env), igual que el listado. */
export interface FiltroResumenDeudas {
  /** Sin tipo, el reporte incluye todos los tipos de kardex. */
  tipo?: TipoKardex;
}

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
  /** Historial completo de un cliente puntual. */
  idCliente?: string;
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
