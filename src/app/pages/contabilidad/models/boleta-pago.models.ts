// src/app/pages/contabilidad/models/boleta-pago.models.ts
// Boleta de pago del personal: muestra el salario completo por ley; el
// recibo de EGRESO sale solo por el neto (líquido pagable − descuentos de
// préstamos). Si todo el sueldo va a la deuda, no se genera recibo.
import {
  DatosPagoRequest,
  MovimientoPrestamo,
  PersonaAutorizoEnPrestamo,
  PersonaEnPrestamo,
  ReciboEnPrestamo,
} from './prestamo-personal.models';

export type EstadoBoletaPago = 'PAGADA' | 'ANULADA';

export interface BoletaPago {
  id: string;
  numero: number;
  idPersona: string;
  persona?: PersonaEnPrestamo | null;
  fechaDesde: string;
  fechaHasta: string;
  fechaPago: string;
  diasTrabajados?: number | null;
  concepto: string;
  salarioBase: string;
  bonoAntiguedad: string;
  otrosIngresos: string;
  totalGanado: string;
  aporteLaboral: string;
  rcIva: string;
  otrosDescuentosLey: string;
  totalDescuentosLey: string;
  liquidoPagable: string;
  totalDescuentoPrestamos: string;
  montoPagado: string;
  idRecibo?: string | null;
  recibo?: ReciboEnPrestamo | null;
  estado: EstadoBoletaPago;
  personaAutorizo?: PersonaAutorizoEnPrestamo | null;
  observaciones?: string | null;
  usuarioRegistro?: string | null;
  /** Solo en el detalle: líneas DESCUENTO_SUELDO del sub-libro de cada préstamo. */
  descuentosPrestamo?: MovimientoPrestamo[];
}

export interface BoletasPaginadas {
  data: BoletaPago[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** GET /contabilidad/boleta-pago/resumen — personal interno que trabajaba
 *  en el mes: pagado = tiene boleta PAGADA con fecha de pago en ese mes. */
export interface ResumenBoletasMes {
  gestion: number;
  mes: number;
  totalPersonal: number;
  pagados: number;
  pendientes: number;
  totalNetoPagado: number;
  pendientesDetalle: { id: string; nombre: string }[];
}

export interface FiltrosBoleta {
  page?: number;
  limit?: number;
  idPersona?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

/** GET /contabilidad/boleta-pago/preparar/:idPersona — montos como número. */
export interface PrestamoParaBoleta {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  monto: number;
  saldo: number;
  cuotaMensual: number;
  /** Cuota pactada, o el saldo si es menor. */
  descuentoSugerido: number;
}

export interface PrepararBoletaResponse {
  persona: {
    id: string;
    nombres: string;
    apellidoPaterno?: string | null;
    apellidoMaterno?: string | null;
    numeroDocumento?: string | null;
    fechaInicioLaboral?: string | null;
    salarioMensual: number | null;
  };
  /** Kardex PERSONAL abierto; null si no tiene (no se puede descontar préstamos). */
  kardex: { id: string; numero: number; saldoActual: number } | null;
  prestamos: PrestamoParaBoleta[];
  totalDescuentoSugerido: number;
}

export interface DescuentoPrestamoRequest {
  idPrestamo: string;
  monto: number;
}

/** POST /contabilidad/boleta-pago — emite y paga en un solo paso. Los
 *  descuentos de ley son opcionales (0 por defecto) y se ingresan como
 *  montos: el sistema no los calcula. */
export interface EmitirBoletaRequest extends DatosPagoRequest {
  idPersona: string;
  fechaDesde: string;
  fechaHasta: string;
  fechaPago: string;
  diasTrabajados?: number;
  salarioBase?: number;
  bonoAntiguedad?: number;
  otrosIngresos?: number;
  aporteLaboral?: number;
  rcIva?: number;
  otrosDescuentosLey?: number;
  /** Omitido = cuota pactada de cada préstamo; enviado (aunque sea []) = tal cual. */
  descuentos?: DescuentoPrestamoRequest[];
  concepto?: string;
  observaciones?: string;
}
