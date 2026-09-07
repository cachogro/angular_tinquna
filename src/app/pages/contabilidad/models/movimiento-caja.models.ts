// src/app/pages/contabilidad/models/movimiento-caja.models.ts
// Caja de flujo: registro maestro de la empresa. Mismo mecanismo que
// LibretaBanco, pero por (caja, moneda) — una caja opera en BOB y USD a la
// vez, cada una con su propia cadena de períodos y saldo. Un recibo puede
// generar hasta dos movimientos acá (un INGRESO por lo aplicado a kardex y
// un EGRESO por la porción EFECTIVO). El back devuelve los montos como
// string ("3300.00").
import { MonedaCuenta } from '../../configurations/parametricas/models/parametricas.models';
import { PersonaMovimientoRef } from './libreta-banco.models';

export type TipoMovimientoCaja = 'INGRESO' | 'EGRESO';
export type TipoPeriodoCaja = 'MENSUAL' | 'GESTION';
export type EstadoPeriodoCaja = 'ABIERTO' | 'CERRADO';

export interface PeriodoCaja {
  id: string;
  idCaja: number;
  moneda: MonedaCuenta;
  tipo: TipoPeriodoCaja;
  gestion: number;
  /** 1-12 en MENSUAL; null en GESTION (fila de cierre anual). */
  mes: number | null;
  estado: EstadoPeriodoCaja;
  saldoInicial: string;
  totalIngreso: string;
  totalEgreso: string;
  /** Se fija al cerrar. */
  saldoFinal: string | null;
  responsable?: string | null;
  fechaCierre: string | null;
  cerradoPor: string | null;
}

export interface MovimientoCaja {
  id: string;
  idCaja: number;
  idPeriodoCaja: string;
  periodoCaja?: PeriodoCaja;
  moneda: MonedaCuenta;
  /** Correlativo por (caja, moneda, gestión). */
  folio?: number | null;
  fecha: string;
  /** "FACTURA Y/O RECIBO" / "Nº CPTE" (ej. "REC:R-0009"). */
  nroComprobante?: string | null;
  idFormaPago?: number | null;
  /** Beneficiario / contraparte ("ENTREGA DE FONDOS A:"). */
  nombresApellidos?: string | null;
  /** Persona CI vinculada (null = solo texto libre en nombresApellidos). */
  idPersona?: string | null;
  persona?: PersonaMovimientoRef | null;
  concepto: string;
  /** "DESTINO DEL GASTO" — texto libre. */
  destinoGasto?: string | null;
  /** Presente cuando el movimiento nace de generar un recibo. */
  idRecibo?: string | null;
  /** = entrada de efectivo. */
  ingreso: string;
  /** = salida de efectivo. */
  egreso: string;
  /** Saldo corriente tras el movimiento (por moneda). */
  saldo: string;
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface CajaEnMovimiento {
  id: number;
  nombre: string;
  moneda: MonedaCuenta;
  saldoInicial: number;
  fechaSaldoInicial: string | null;
}

/** Respuesta de GET /contabilidad/movimiento-caja */
export interface CajaFlujoResponse {
  caja: CajaEnMovimiento;
  periodos: PeriodoCaja[];
  movimientos: MovimientoCaja[];
}

/** POST /contabilidad/movimiento-caja — sin `id` crea, con `id` edita. */
export interface GuardarMovimientoCajaRequest {
  id?: string | number;
  idCaja: number;
  moneda: MonedaCuenta;
  /** "YYYY-MM-DD" — define el mes/gestión del movimiento. */
  fecha: string;
  nroComprobante?: string;
  idFormaPago?: number;
  /** Texto del beneficiario. Con `idPersona` y sin esto, el back lo deriva de la persona. */
  nombresApellidos?: string;
  /** Persona CI elegida de la lista. Sin `idPersona` = texto libre. */
  idPersona?: string;
  concepto: string;
  destinoGasto?: string;
  tipo: TipoMovimientoCaja;
  /** > 0, hasta 2 decimales. */
  monto: number;
}

export interface FiltroMovimientoCajaRequest {
  idCaja: number;
  moneda: MonedaCuenta;
  gestion?: number;
  mes?: number;
}

/** Body de cerrar/reabrir mes. Para gestión se omite `mes`. */
export interface PeriodoCajaAccionRequest {
  idCaja: number;
  moneda: MonedaCuenta;
  gestion: number;
  mes?: number;
}
