// src/app/pages/contabilidad/models/movimiento-kardex.models.ts
// Líneas del kardex de anticipos (contabilidad.movimiento_kardex).
//   DEBE  = anticipo entregado (sube la deuda del destinatario)
//   HABER = pago / descuento (la baja)
import {
  DestinoGasto,
  FormaPago,
  KardexSubcuenta,
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { Kardex } from './kardex.models';

export type { DestinoGasto, FormaPago, KardexSubcuenta };

export type TipoMovimientoKardexLinea = 'DEBE' | 'HABER';

/** Persona tal como viene anidada como cobrador (subset). */
export interface PersonaEnMovimientoKardex {
  id: string | number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}

export interface MovimientoKardex {
  id: string;
  idKardex: string;
  numeroLinea: number;
  fecha: string;
  /** N° real de la transacción bancaria (transferencia / QR / depósito). */
  nroComprobante?: string | null;
  /** Documento que respalda la línea (ej. "REC:C-406", "DET. ADJ."). */
  facturaRecibo?: string | null;
  detalle: string;
  idSubcuenta?: number | null;
  subcuenta?: KardexSubcuenta | null;
  idFormaPago?: number | null;
  formaPago?: FormaPago | null;
  /** Cuenta bancaria usada (solo formas de pago bancarias / transacción). */
  idCuentaBancaria?: number | null;
  cuentaBancaria?: {
    id: number;
    numeroCuenta: string;
    moneda?: string;
    alias?: string | null;
    entidadFinanciera?: { id: number; nombre: string; sigla: string } | null;
  } | null;
  /** Categoría contable (catálogo destino-gasto). */
  idDestinoGasto?: number | null;
  destinoGasto?: DestinoGasto | null;
  idCobrador?: string | null;
  cobrador?: PersonaEnMovimientoKardex | null;
  idValorizacion?: string | null;
  valorizacion?: { id: string | number } | null;
  /** Moneda de la línea (BS por defecto). En USD la caja o el banco reciben
   *  dólares y el kardex el equivalente en Bs. */
  moneda?: MonedaCuenta;
  /** Bs por 1 USD ("6.9600"); null en BS. */
  tipoCambio?: string | null;
  /** Importe original en USD ("0.00" si la línea es BS). */
  debeUsd?: string;
  haberUsd?: string;
  /** SIEMPRE en Bs (en USD, ya convertidos con el tipo de cambio). */
  debe: string;
  haber: string;
  saldo: string;
  activo?: boolean;
  usuarioRegistro?: string | null;
  usuarioUltimaModificacion?: string | null;
  fechaRegistro?: string | null;
  fechaUltimaModificacion?: string | null;
}

/** POST /contabilidad/movimiento-kardex — sin `id` crea, con `id` edita. */
export interface GuardarMovimientoKardexRequest {
  id?: string | number;
  idKardex: string;
  fecha: string;
  /** N° real de la transacción bancaria. */
  nroComprobante?: string;
  /** Documento que respalda la línea (ej. "REC:C-406", "DET. ADJ."). */
  facturaRecibo?: string;
  detalle: string;
  idSubcuenta?: number;
  idFormaPago?: number;
  /** Obligatorio cuando la forma de pago es bancaria (transacción, QR, cheque…). */
  idCuentaBancaria?: number;
  idDestinoGasto?: number;
  idCobrador?: string;
  idValorizacion?: string;
  tipo: TipoMovimientoKardexLinea;
  /** En la moneda de la línea: en USD va en dólares. */
  monto: number;
  /** Por defecto BS. */
  moneda?: MonedaCuenta;
  /** Bs por 1 USD, > 0 y hasta 4 decimales. Obligatorio solo en USD. */
  tipoCambio?: number;
}

/** GET /contabilidad/movimiento-kardex?idKardex= */
/** GET /contabilidad/movimiento-kardex?idKardex&page&limit — paginado, la
 *  última línea primero (numeroLinea descendente). Sin page/limit el back
 *  usa page=1, limit=10. */
export interface MovimientosKardexResponse {
  kardex: Kardex;
  data: MovimientoKardex[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
