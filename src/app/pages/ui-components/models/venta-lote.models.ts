// src/app/pages/ui-components/models/venta-lote.models.ts
import { Recibo } from '../../contabilidad/models/recibo.models';
import { Paginado, PromedioMineral } from './promedio-mineral.models';

export type EstadoVentaLote = 'ABIERTA' | 'LIQUIDADA' | 'ANULADA';
export type MonedaVentaLote = 'BS' | 'USD';

/**
 * Venta de un lote entero (promedio) a un cliente comprador. Los anticipos y
 * pagos son recibos de INGRESO (`Recibo.idVentaLote`) que van al kardex del
 * cliente y a caja o libreta bancaria. Todos los totales de seguimiento van
 * en Bs. (los recibos en USD, con su propio tipo de cambio).
 */
export interface VentaLote {
  id: string;
  idPromedioMineral: string;
  promedioMineral?: PromedioMineral;
  codigoLote: string | null;
  idCliente: string;
  cliente?: { id: string; nombre: string; nit?: string | null };
  fechaVenta: string;
  moneda: MonedaVentaLote;
  tipoCambio: number | null;
  /** Foto del efectivo invertido del promedio al vender (Bs). */
  totalEfectivoInvertido: number;
  /** Liquidación neta del comprador, en la moneda de la venta. */
  montoVenta: number | null;
  montoVentaBolivianos: number | null;
  fechaLiquidacion: string | null;
  estado: EstadoVentaLote;
  observaciones: string | null;
  activo: boolean;
  /** Recibos PROCESADOS (ya en kardex y caja/banco). */
  cobradoBolivianos: number;
  /** Parte de lo cobrado que entró en USD (monto original). */
  cobradoUsd: number;
  /** Recibos en BORRADOR (aún sin mover plata). */
  pendienteBolivianos: number;
  cantidadCobros: number;
  /** Solo LIQUIDADA: venta − cobrado. Negativo = saldo a favor del cliente. */
  porCobrarBolivianos: number | null;
  /** Solo LIQUIDADA: venta − invertido. */
  utilidadBolivianos: number | null;
  pagada: boolean;
  /** Solo en el detalle (GET /:id). Incluye anulados. */
  recibos?: Recibo[];
}

export interface CrearVentaLoteRequest {
  idPromedioMineral: string;
  idCliente: string;
  fechaVenta: string; // YYYY-MM-DD
  moneda: MonedaVentaLote;
  tipoCambio?: number;
  observaciones?: string;
}

export interface ActualizarVentaLoteRequest {
  fechaVenta?: string;
  tipoCambio?: number;
  observaciones?: string;
}

export interface LiquidarVentaLoteRequest {
  montoVenta: number;
  tipoCambio?: number;
  fechaLiquidacion: string; // YYYY-MM-DD
}

export interface FiltrosVentaLote {
  busqueda?: string;
  estado?: EstadoVentaLote;
  idCliente?: string;
  page?: number;
  limit?: number;
}

export type VentasLotePaginadas = Paginado<VentaLote>;
