// src/app/pages/contabilidad/models/bien-dacion-pago.models.ts
// Bienes recibidos en dación de pago (vehículos, maquinaria, etc.) de un
// actor productivo o de una persona a cuenta de su deuda de anticipos.
//
//   EN_POSESION    → retenido. Se puede devolver, vender directo o tomar en pago.
//   TOMADO_EN_PAGO → la empresa se lo queda: el valor acordado se abona a su
//                    kardex (sin mover caja). Ya no se devuelve; admite gastos
//                    y al venderlo solo entra el dinero.
//   VENDIDO        → el precio entró directo a caja o libreta (sin recibo).
//   DEVUELTO       → se le devolvió; no genera nada.
//
// Resultado para la empresa = precio de venta − amortizado − gastos.
import { DestinoGasto } from '../../configurations/parametricas/models/parametricas.models';
import { DatosPagoRequest } from './prestamo-personal.models';

export type EstadoBienDacion =
  | 'EN_POSESION'
  | 'TOMADO_EN_PAGO'
  | 'VENDIDO'
  | 'DEVUELTO';

/** Gasto que la empresa le invierte a un bien tomado en pago: egreso directo
 *  de caja o libreta, no toca el kardex del dueño. */
export interface GastoBienDacion {
  id: string;
  idBienDacionPago: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  concepto: string;
  monto: number | string;
  idDestinoGasto?: number | null;
  destinoGasto?: DestinoGasto | null;
  /** Uno de los dos: por dónde salió el dinero. */
  idMovimientoCaja?: string | null;
  idLibretaBanco?: string | null;
  activo: boolean;
}

export interface BienDacionPago {
  id: string;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: { id: string; nombre: string } | null;
  idPersona?: string | null;
  persona?: {
    id: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno?: string | null;
  } | null;
  /** "YYYY-MM-DD" */
  fechaRecepcion: string;
  descripcion: string;
  /** Valor acordado con el dueño (Bs): lo que se propone amortizar. Puede
   *  venir como string decimal; null solo en bienes antiguos. */
  valorReferencial?: number | string | null;
  estado: EstadoBienDacion;
  /** Fecha en que la empresa se quedó con el bien. */
  fechaTomaPago?: string | null;
  /** Lo abonado al kardex del dueño (al tomar en pago o en venta directa). */
  montoAmortizado?: number | string | null;
  fechaVenta?: string | null;
  montoVenta?: number | string | null;
  fechaDevolucion?: string | null;
  observaciones?: string | null;
  activo?: boolean;
  /** Ingreso de la venta: caja de flujo o libreta de bancos. */
  idMovimientoCaja?: string | null;
  idLibretaBanco?: string | null;
  /** Solo en bienes vendidos con el esquema anterior (con recibo). */
  idRecibo?: string | null;
  recibo?: { id: string; serie: string; numero: number; estado: string } | null;
  idMovimientoKardex?: string | null;
  gastos?: GastoBienDacion[];
  /** Calculados por el back. */
  totalGastos?: number;
  /** Amortizado + gastos; null si todavía no se amortizó nada. */
  costoTotal?: number | null;
  /** Solo VENDIDO: precio − costo total (> 0 ganancia, < 0 pérdida). */
  resultadoVenta?: number | null;
}

/** POST /contabilidad/bien-dacion-pago — idPersona e idActorProductivoMinero
 *  son excluyentes (uno de los dos, obligatorio). */
export interface RegistrarBienDacionRequest {
  idPersona?: string;
  idActorProductivoMinero?: string;
  fechaRecepcion: string;
  descripcion: string;
  /** Valor acordado (obligatorio). */
  valorReferencial: number;
  observaciones?: string;
}

/** POST /:id/tomar-en-pago — abona al kardex del dueño, sin mover caja. */
export interface TomarEnPagoBienDacionRequest {
  fecha: string;
  /** Si se omite, el back usa el valor acordado. */
  montoAmortizar?: number;
  observaciones?: string;
}

/** POST /:id/vender — el precio entra directo a caja (efectivo) o a la
 *  libreta (medio bancario), sin recibo. `montoAmortizar` solo aplica a la
 *  venta directa (bien EN_POSESION): lo que se abona al kardex del dueño. */
export interface VenderBienDacionRequest extends DatosPagoRequest {
  fechaVenta: string;
  montoVenta: number;
  montoAmortizar?: number;
  observaciones?: string;
}

/** POST /:id/devolver — observaciones obligatorio: es el motivo. */
export interface DevolverBienDacionRequest {
  fechaDevolucion: string;
  observaciones: string;
}

/** POST /:id/gasto — egreso directo de caja o libreta. */
export interface RegistrarGastoBienDacionRequest extends DatosPagoRequest {
  fecha: string;
  concepto: string;
  monto: number;
}

export interface FiltrosBienDacion {
  idPersona?: string;
  idActorProductivoMinero?: string;
  estado?: EstadoBienDacion;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}

export interface BienDacionPaginado {
  data: BienDacionPago[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
