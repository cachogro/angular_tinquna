// src/app/pages/contabilidad/models/movimiento-kardex.models.ts
// Líneas del kardex de anticipos (contabilidad.movimiento_kardex).
//   DEBE  = anticipo entregado (sube la deuda del destinatario)
//   HABER = pago / descuento (la baja)
import {
  FormaPago,
  KardexSubcuenta,
  TipoMovimientoKardex,
} from '../../configurations/parametricas/models/parametricas.models';
import { Kardex } from './kardex.models';

export type { FormaPago, KardexSubcuenta, TipoMovimientoKardex };

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
  nroComprobante?: string | null;
  detalle: string;
  idSubcuenta?: number | null;
  subcuenta?: KardexSubcuenta | null;
  idFormaPago?: number | null;
  formaPago?: FormaPago | null;
  idTipoMovimiento?: number | null;
  tipoMovimiento?: TipoMovimientoKardex | null;
  idCobrador?: string | null;
  cobrador?: PersonaEnMovimientoKardex | null;
  idValorizacion?: string | null;
  valorizacion?: { id: string | number } | null;
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
  nroComprobante?: string;
  detalle: string;
  idSubcuenta?: number;
  idFormaPago?: number;
  idTipoMovimiento?: number;
  idCobrador?: string;
  idValorizacion?: string;
  tipo: TipoMovimientoKardexLinea;
  monto: number;
}

/** GET /contabilidad/movimiento-kardex?idKardex= */
export interface MovimientosKardexResponse {
  kardex: Kardex;
  movimientos: MovimientoKardex[];
}
