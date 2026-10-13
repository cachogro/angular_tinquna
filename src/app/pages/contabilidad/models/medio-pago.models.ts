// src/app/pages/contabilidad/models/medio-pago.models.ts
// Pago mixto: un mismo recibo (o boleta de pago, o pago de valorización)
// puede moverse por más de un medio a la vez — por ejemplo, la mitad en
// efectivo y el resto por QR o transferencia. Cada medio genera su propio
// movimiento: en la caja de flujo (efectivo) o en la libreta de su cuenta.
import { FormaPago } from '../../configurations/parametricas/models/parametricas.models';

/** Un medio del pago mixto, tal como se envía en `pagos`. La suma de los
 *  montos debe ser igual al total que se paga; el primero es el principal
 *  (sus datos quedan también en la cabecera). */
export interface MedioPagoRequest {
  idFormaPago: number;
  /** > 0, hasta 2 decimales. */
  monto: number;
  /** Obligatorios con forma de pago bancaria. */
  idCuentaBancaria?: number;
  nroComprobante?: string;
}

/** Un medio del pago mixto, tal como lo devuelve el back (`recibo.pagos`,
 *  `pagoValorizacion.medios`). La lista viene vacía si se pagó por un solo
 *  medio: ese vive en la cabecera. */
export interface MedioPago {
  id: string;
  orden: number;
  idFormaPago: number;
  formaPago?: FormaPago | null;
  idCuentaBancaria?: number | null;
  cuentaBancaria?: {
    id: number;
    numeroCuenta: string;
    entidadFinanciera?: { nombre: string; sigla?: string | null } | null;
  } | null;
  nroComprobante?: string | null;
  /** String tipo "500.00". */
  monto: string;
}

/** "QR · BUN 1000123 · N° 4613" — texto de un medio ya registrado. */
export function descripcionMedioPago(m: MedioPago): string {
  const origen = m.cuentaBancaria
    ? `${m.cuentaBancaria.entidadFinanciera?.sigla || m.cuentaBancaria.entidadFinanciera?.nombre || 'Banco'} ${m.cuentaBancaria.numeroCuenta}`
    : 'Caja de flujo';
  return [m.formaPago?.nombre ?? 'Forma de pago', origen, m.nroComprobante && `N° ${m.nroComprobante}`]
    .filter(Boolean)
    .join(' · ');
}

/** Medios de un pago mixto en orden; vacío si se pagó por un solo medio. */
export function mediosMixtos(medios: MedioPago[] | null | undefined): MedioPago[] {
  const lista = medios ?? [];
  return lista.length > 1 ? [...lista].sort((a, b) => a.orden - b.orden) : [];
}
