// src/app/pages/contabilidad/models/libreta-banco.models.ts
// Libreta de bancos: el mayor de cada cuenta bancaria de la empresa.
// El back devuelve los montos como string ("3300.00").

export type TipoMovimientoBanco = 'DEBE' | 'HABER';
export type EstadoPeriodoBanco = 'ABIERTO' | 'CERRADO';
export type TipoPeriodoBanco = 'MENSUAL' | 'GESTION';

export interface PeriodoBanco {
  id: string;
  idCuentaBancaria: number;
  tipo: TipoPeriodoBanco;
  gestion: number;
  /** 1-12 en MENSUAL; null en GESTION (fila de cierre anual). */
  mes: number | null;
  estado: EstadoPeriodoBanco;
  saldoInicial: string;
  totalDebe: string;
  totalHaber: string;
  /** Se fija al cerrar. */
  saldoFinal: string | null;
  fechaCierre: string | null;
  cerradoPor: string | null;
}

/** Persona CI vinculada a un movimiento (subset que devuelve el back). */
export interface PersonaMovimientoRef {
  id: string | number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  numeroDocumento?: string | null;
}

export interface MovimientoBanco {
  id: string;
  idCuentaBancaria: number;
  idPeriodoBanco: string;
  periodoBanco?: PeriodoBanco;
  folio: number;
  fecha: string;
  nroTransaccion?: string | null;
  /** Beneficiario / contraparte. Si hay persona vinculada, el back lo deriva de ella. */
  nombresApellidos?: string | null;
  /** Persona CI vinculada (null = texto libre). */
  idPersona?: string | null;
  persona?: PersonaMovimientoRef | null;
  concepto: string;
  /** "DEBE" = egreso/salida. */
  debe: string;
  /** "HABER" = ingreso/entrada. */
  haber: string;
  /** Saldo corriente tras el movimiento. */
  saldo: string;
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface CuentaLibreta {
  id: number;
  numeroCuenta: string;
  moneda: string;
  saldoInicial: string;
  fechaSaldoInicial: string | null;
}

/** Respuesta de GET /contabilidad/libreta-banco */
export interface LibretaBancoResponse {
  cuenta: CuentaLibreta;
  periodos: PeriodoBanco[];
  movimientos: MovimientoBanco[];
}

/** POST /contabilidad/libreta-banco — sin `id` crea, con `id` edita. */
export interface GuardarMovimientoBancoRequest {
  id?: string | number;
  idCuentaBancaria: number;
  /** "YYYY-MM-DD" — define el mes/gestión del movimiento. */
  fecha: string;
  nroTransaccion?: string;
  /** Persona CI elegida de la lista. Sin `idPersona` = texto libre. */
  idPersona?: string | number | null;
  /** Texto del beneficiario. Con `idPersona` y sin esto, el back lo deriva de la persona. */
  nombresApellidos?: string;
  concepto: string;
  tipo: TipoMovimientoBanco;
  /** > 0, hasta 2 decimales. */
  monto: number;
}

/** Body de cerrar/reabrir mes. Para gestión se omite `mes`. */
export interface PeriodoBancoAccionRequest {
  idCuentaBancaria: number;
  gestion: number;
  mes?: number;
}
