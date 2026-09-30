// src/app/pages/contabilidad/models/prestamo-personal.models.ts
// Préstamos al personal de la empresa. Cada préstamo lleva su propio
// sub-libro (movimiento_prestamo: DEBE / HABER / saldo), aparte del kardex
// PERSONAL, para saber siempre cuánto se debe de ESE préstamo. El back
// devuelve los montos como string ("12000.00").

export type EstadoPrestamo = 'VIGENTE' | 'CANCELADO';
export type TipoMovimientoPrestamo = 'OTORGAMIENTO' | 'DESCUENTO_SUELDO' | 'ABONO';

export interface PersonaEnPrestamo {
  id: string;
  nombres: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  numeroDocumento?: string | null;
}

export interface PersonaAutorizoEnPrestamo {
  id: string;
  nombres: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
}

export interface ReciboEnPrestamo {
  id: string;
  serie: string;
  numero: number;
  tipo?: 'INGRESO' | 'EGRESO';
  estado?: string;
}

export interface BoletaEnPrestamo {
  id: string;
  numero: number;
  concepto?: string;
}

/** Línea del sub-libro del préstamo. */
export interface MovimientoPrestamo {
  id: string;
  idPrestamo: string;
  numeroLinea: number;
  fecha: string;
  tipo: TipoMovimientoPrestamo;
  detalle: string;
  debe: string;
  haber: string;
  saldo: string;
  idRecibo?: string | null;
  recibo?: ReciboEnPrestamo | null;
  idBoletaPago?: string | null;
  boletaPago?: BoletaEnPrestamo | null;
  /** Solo en la respuesta de la boleta (descuentosPrestamo). */
  prestamo?: Pick<PrestamoPersonal, 'id' | 'numero' | 'descripcion'> | null;
}

export interface PrestamoPersonal {
  id: string;
  numero: number;
  idPersona: string;
  persona?: PersonaEnPrestamo | null;
  fecha: string;
  descripcion: string;
  monto: string;
  cuotaMensual: string;
  saldo: string;
  estado: EstadoPrestamo;
  idRecibo?: string | null;
  recibo?: ReciboEnPrestamo | null;
  personaAutorizo?: PersonaAutorizoEnPrestamo | null;
  observaciones?: string | null;
  /** Usuario (login) que otorgó el préstamo. Viene en el listado. */
  usuarioRegistro?: string | null;
  /** Solo en el detalle (GET /:id). */
  movimientos?: MovimientoPrestamo[];
  activo?: boolean;
}

export interface PrestamosPaginados {
  data: PrestamoPersonal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosPrestamo {
  page?: number;
  limit?: number;
  idPersona?: string;
  estado?: EstadoPrestamo;
}

/** Datos de pago comunes (otorgar, abonar, boleta): generan un recibo. Sin
 *  cuenta bancaria el movimiento va a la caja de flujo en efectivo. */
export interface DatosPagoRequest {
  idFormaPago?: number;
  idCuentaBancaria?: number;
  nroComprobante?: string;
  idPersonaAutorizo: string;
  idDestinoGasto?: number;
}

/** POST /contabilidad/prestamo-personal */
export interface OtorgarPrestamoRequest extends DatosPagoRequest {
  idPersona: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  descripcion: string;
  monto: number;
  cuotaMensual: number;
  observaciones?: string;
}

/** POST /contabilidad/prestamo-personal/:id/abono — el empleado paga con
 *  dinero propio (recibo de INGRESO). */
export interface AbonarPrestamoRequest extends DatosPagoRequest {
  fecha: string;
  monto: number;
}

/** PATCH /contabilidad/prestamo-personal/:id/cuota */
export interface ActualizarCuotaRequest {
  cuotaMensual: number;
  observaciones?: string;
}
