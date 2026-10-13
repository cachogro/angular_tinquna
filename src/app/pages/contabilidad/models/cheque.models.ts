// src/app/pages/contabilidad/models/cheque.models.ts
// Cheques por cuenta bancaria: talonarios (chequeras) y cheques usados.

/** Días para presentar un cheque al cobro desde su fecha (Código de
 *  Comercio, art. 607). El back calcula `fechaLimiteCobro` con este plazo. */
export const DIAS_COBRO_CHEQUE = 30;

export type EstadoCheque = 'EMITIDO' | 'COBRADO' | 'ANULADO';

/** Talonario con cuántos cheques le quedan. */
export interface TalonarioCheque {
  id: number;
  idCuentaBancaria: number;
  serie: string | null;
  numeroInicial: number;
  numeroFinal: number;
  /** "YYYY-MM-DD" */
  fechaRecepcion: string;
  /** "YYYY-MM-DD"; null = sin vencimiento (lo normal: por ley no vence). */
  fechaVencimiento: string | null;
  observacion: string | null;
  activo: boolean;
  total: number;
  emitidos: number;
  cobrados: number;
  anulados: number;
  disponibles: number;
  /** Próximo número sin usar; null si el talonario se terminó. */
  siguienteNumero: number | null;
}

/** POST /contabilidad/talonario-cheque — sin `id` crea, con `id` actualiza. */
export interface GuardarTalonarioChequeRequest {
  id?: number;
  idCuentaBancaria: number;
  serie?: string;
  numeroInicial: number;
  numeroFinal: number;
  fechaRecepcion: string;
  fechaVencimiento?: string;
  observacion?: string;
}

/** GET /contabilidad/cheque/siguiente */
export interface SiguienteCheque {
  /** false = la cuenta no usa chequera: el N° de comprobante es libre. */
  manejaCheques: boolean;
  siguienteNumero: number | null;
  serie: string | null;
  idTalonarioCheque: number | null;
  disponibles: number;
}

export interface Cheque {
  /** bigint: llega como string. */
  id: string;
  idTalonarioCheque: number;
  idCuentaBancaria: number;
  serie: string | null;
  numero: number;
  estado: EstadoCheque;
  fechaEmision: string | null;
  /** Último día para presentarlo al cobro. */
  fechaLimiteCobro: string | null;
  fechaRevalidacion: string | null;
  fechaCobro: string | null;
  monto: number | null;
  beneficiario: string | null;
  concepto: string | null;
  motivoAnulacion: string | null;
  /** Movimiento de la libreta que lo emitió; null si se anuló sin usar. */
  idLibretaBanco: string | null;
  /** Solo EMITIDO. */
  vencido: boolean;
  /** Solo EMITIDO: días hasta la fecha límite (negativo si ya venció). */
  diasParaVencer: number | null;
}

export interface FiltroCheque {
  idCuentaBancaria?: number;
  idTalonarioCheque?: number;
  estado?: EstadoCheque;
}

/** POST /contabilidad/cheque/anular — cheque que nunca se usó en un pago. */
export interface AnularChequeEnBlancoRequest {
  idTalonarioCheque: number;
  numero: number;
  motivo: string;
}

/** Fila de `cheques` en GET /dashboard/resumen. */
export interface CuentaChequesDashboard {
  idCuentaBancaria: number;
  entidadFinanciera: string;
  numeroCuenta: string;
  alias: string | null;
  moneda: string;
  disponibles: number;
  total: number;
  emitidosSinCobrar: number;
  montoSinCobrar: number;
  porVencer: number;
  vencidos: number;
  talonarioVence: string | null;
}
