// src/app/pages/ui-components/models/venta-lote.models.ts
import {
  Cliente,
  ModalidadVentaCliente,
} from '../../configurations/parametricas/models/parametricas.models';
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
  /** Lo que la empresa estima que vale el lote, en la moneda de la venta.
   *  Solo referencial: para comparar con la liquidación del comprador. */
  montoEstimado: number | null;
  /** Liquidación neta del comprador, en la moneda de la venta. */
  montoVenta: number | null;
  montoVentaBolivianos: number | null;
  fechaLiquidacion: string | null;
  estado: EstadoVentaLote;
  observaciones: string | null;
  activo: boolean;
  /** Modalidad del cliente comprador (define cómo se cobra el lote). */
  modalidadVenta: ModalidadVentaCliente;
  /** Lo cobrado del lote. EXPORTACION: sus recibos propios más lo que le
   *  toque de los anticipos sin lote. COMERCIO_INTERNO: lo que la cuenta
   *  corriente del cliente le asigna (solo si el lote está LIQUIDADO). */
  cobradoBolivianos: number;
  /** Parte de lo cobrado que viene de la cuenta del cliente. */
  cobradoAnticiposClienteBolivianos: number;
  /** Anticipos del cliente que aún no pagan ningún lote. */
  anticipoDisponibleClienteBolivianos: number;
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
  /** Liquidación − estimado, en la moneda de la venta; null si falta alguno.
   *  Negativo = el comprador liquidó menos de lo estimado. */
  diferenciaEstimado: number | null;
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

/**
 * Cuenta corriente de un cliente comprador (Bs.), calculada desde su kardex.
 * Lo recibido paga sus lotes LIQUIDADOS del más antiguo al más nuevo.
 */
export interface CuentaClienteVenta {
  idCliente: string;
  modalidadVenta: ModalidadVentaCliente;
  kardexAbierto: boolean;
  /** Todo lo que entregó el cliente. */
  anticiposBolivianos: number;
  otrosCargosBolivianos: number;
  /** Suma de las liquidaciones de sus lotes. */
  liquidadoBolivianos: number;
  aplicadoBolivianos: number;
  /** Recibido que todavía no tiene un lote liquidado que pagar. */
  anticipoDisponibleBolivianos: number;
  /** Positivo = a favor del cliente (se le deben lotes); negativo = debe. */
  saldoBolivianos: number;
  lotesAbiertos: number;
  lotesLiquidados: number;
  lotesPagados: number;
  estimadoAbiertosBolivianos: number;
  lotesAbiertosSinEstimar: number;
  /** Saldo si los lotes abiertos se liquidaran por lo estimado. */
  saldoProyectadoBolivianos: number;
}

/** Fila de la bandeja por cliente (GET /venta-lote/clientes). */
export interface CuentaClienteFila extends CuentaClienteVenta {
  cliente: Cliente;
}

export interface MovimientoCuentaCliente {
  id: string;
  fecha: string;
  tipo: 'ANTICIPO' | 'LOTE' | 'CARGO';
  detalle: string;
  lote: string | null;
  comprobante: string | null;
  idRecibo: string | null;
  moneda: MonedaVentaLote;
  montoUsd: number;
  /** Positivo = a favor del cliente; negativo = cargo. */
  montoBolivianos: number;
  saldoBolivianos: number;
}

/** GET /venta-lote/clientes/:idCliente */
export interface CuentaClienteDetalle {
  cliente: Cliente;
  cuenta: CuentaClienteVenta;
  ventas: VentaLote[];
  movimientos: MovimientoCuentaCliente[];
}

export interface FiltrosVentaLote {
  busqueda?: string;
  estado?: EstadoVentaLote;
  idCliente?: string;
  modalidad?: ModalidadVentaCliente;
  page?: number;
  limit?: number;
}

export type VentasLotePaginadas = Paginado<VentaLote>;
