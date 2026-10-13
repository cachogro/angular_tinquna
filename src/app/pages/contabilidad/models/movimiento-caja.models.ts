// src/app/pages/contabilidad/models/movimiento-caja.models.ts
// Caja de flujo: registro maestro de la empresa. Mismo mecanismo que
// LibretaBanco, pero por (caja, moneda) — una caja opera en BS y USD a la
// vez, cada una con su propia cadena de períodos y saldo. Un recibo puede
// generar hasta dos movimientos acá (un INGRESO por lo aplicado a kardex y
// un EGRESO por la porción EFECTIVO). El back devuelve los montos como
// string ("3300.00").
import {
  PlanCuentas,
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
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

export type TipoOrigenMovimiento =
  | 'RECIBO'
  | 'TRASPASO'
  | 'PAGO_VALORIZACION'
  | 'BIEN_DACION_VENTA'
  | 'BIEN_DACION_GASTO';

/** Documento que generó un movimiento de caja o de libreta. Con origen, el
 *  movimiento se corrige o anula desde ese documento, no desde la bandeja. */
export interface OrigenMovimiento {
  tipo: TipoOrigenMovimiento;
  id: string;
  etiqueta: string;
}

interface DestinoOrigen {
  icono: string;
  /** Pantalla desde la que se gestiona el documento. */
  ruta: string;
  pantalla: string;
}

export const DESTINO_ORIGEN_MOVIMIENTO: Record<TipoOrigenMovimiento, DestinoOrigen> = {
  RECIBO: { icono: 'receipt', ruta: '/contabilidad/recibos', pantalla: 'Recibos' },
  TRASPASO: { icono: 'sync_alt', ruta: '/contabilidad/traspasos', pantalla: 'Traspasos' },
  PAGO_VALORIZACION: {
    icono: 'payments',
    ruta: '/ui-components/valorizacion',
    pantalla: 'Valorización',
  },
  BIEN_DACION_VENTA: { icono: 'sell', ruta: '/contabilidad/kardex', pantalla: 'Kardex' },
  BIEN_DACION_GASTO: { icono: 'sell', ruta: '/contabilidad/kardex', pantalla: 'Kardex' },
};

export interface MovimientoCaja {
  id: string;
  idCaja: number;
  idPeriodoCaja: string;
  periodoCaja?: PeriodoCaja;
  moneda: MonedaCuenta;
  /** Bs por 1 USD con el que entró o salió el monto ("6.9600"); null en BS.
   *  Solo informativo: la caja en USD lleva su saldo en dólares. */
  tipoCambio?: string | null;
  /** Correlativo por (caja, moneda, gestión). */
  folio?: number | null;
  fecha: string;
  /** "Nº CPTE" — n° de transacción / comprobante del pago. */
  nroComprobante?: string | null;
  /** "FACTURA Y/O RECIBO" — referencia del recibo que originó el movimiento
   *  (ej. "R-0009"); presente cuando `idRecibo` no es null. */
  facturaRecibo?: string | null;
  idFormaPago?: number | null;
  /** Beneficiario / contraparte ("ENTREGA DE FONDOS A:"). Columna
   *  `entrega_fondos_a` (antes `nombres_apellidos`). */
  entregaFondosA?: string | null;
  /** Persona CI vinculada (null = solo texto libre en entregaFondosA). */
  idPersona?: string | null;
  persona?: PersonaMovimientoRef | null;
  concepto: string;
  /** "PLAN DE CUENTAS". Los movimientos que nacen de un recibo lo traen como
   *  objeto del catálogo (`idPlanCuentas` + `planCuentas`); los cargados a
   *  mano pueden traerlo como texto libre. */
  idPlanCuentas?: number | null;
  planCuentas?: PlanCuentas | string | null;
  /** Presente cuando el movimiento nace de generar un recibo. */
  idRecibo?: string | null;
  /** Presente cuando el movimiento nace de un traspaso caja↔banco. */
  idTraspaso?: string | null;
  /** Presente cuando el movimiento se cargó desde un kardex: al editarlo o
   *  desactivarlo acá, el back sincroniza esa línea. */
  idMovimientoKardex?: string | null;
  /** Documento que lo generó (recibo, traspaso, pago de valorización, bien en
   *  dación). null = manual o de kardex directo. */
  origen?: OrigenMovimiento | null;
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
  /** Bs por 1 USD del día. Obligatorio si `moneda` = USD. */
  tipoCambio?: number;
  /** "YYYY-MM-DD" — define el mes/gestión del movimiento. */
  fecha: string;
  nroComprobante?: string;
  /** "FACTURA Y/O RECIBO" (ej. "FACT:19877"). Vacío = sin respaldo. */
  facturaRecibo?: string;
  idFormaPago?: number;
  /** Texto del beneficiario ("entrega de fondos a"). Con `idPersona` y sin
   *  esto, el back lo deriva de la persona. */
  entregaFondosA?: string;
  /** Persona CI elegida de la lista. Sin `idPersona` = texto libre. */
  idPersona?: string;
  concepto: string;
  /** Id del catálogo de cuentas del plan de cuentas (parametrica.plan_cuentas). */
  idPlanCuentas?: number;
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
