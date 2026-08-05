// src/app/pages/ui-components/models/valorizacion-mineral.models.ts
import { LeyUnidad, RegistroMineral } from './registro-mineral.models';
import {
  DetalleAporte,
  EntidadAporte,
  TipoBaseAporte as TipoBaseAporteCatalogo,
} from 'src/app/pages/configurations/parametricas/models/parametricas.models';

export type { DetalleAporte, EntidadAporte, TipoBaseAporteCatalogo };

export interface EstadoValorizacion {
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  id: number;
  nombre: string;
  descripcion?: string | null;
}

/**
 * Catálogo de respaldo con los mismos ids/nombres que devuelve
 * GET parametricas/valorizacion_mineral/allEstados, por si el catálogo
 * remoto tarda en cargar. La fuente de verdad es el endpoint
 * (ValorizacionMineralService.obtenerEstadosValorizacion()).
 */
export const ESTADOS_VALORIZACION: EstadoValorizacion[] = [
  { id: 1, nombre: 'BORRADOR' },
  { id: 2, nombre: 'PRE-VALORIZADO' },
  { id: 3, nombre: 'VALORIZADO' },
];

export const ESTADO_VALORIZACION_BORRADOR_ID = 1;
export const ESTADO_VALORIZACION_PREVALORIZADO_ID = 2;
export const ESTADO_VALORIZACION_VALORIZADO_ID = 3;

/**
 * TODO: falta confirmar con backend la fórmula exacta de cálculo
 * (ver preguntas sobre la planilla de referencia). Estos tipos ya reflejan
 * la forma del PATCH que sí está confirmada.
 */
export type DetalleValorizacion = Record<string, unknown>;
export type CalculoAporteValorizacion = Record<string, unknown>;

export interface ValorizacionMineral {
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion: string | null;
  id: string;
  uuid: string;
  idRecepcionMineral: string;
  recepcionMineral?: RegistroMineral;
  idLaboratorio?: string | null;
  laboratorio?: unknown | null; // TODO: tipar cuando exista catálogo de laboratorios
  idEstadoValorizacion: number;
  estadoValorizacion?: EstadoValorizacion;
  pesoBrutoHumedoKilogramos: string | null;
  pesoNetoHumedoKilogramos: string | null;
  pesoNetoSecoKilogramos: string | null;
  taraKilogramos: string | null;
  humedadPorcentaje: string | null;
  mermaPorcentaje: string | null;
  mermaKilogramos: string | null;
  totalValorBrutoBolivianos: string | null;
  totalAportesBolivianos: string | null;
  cotizacionDolar: string | null;
  anticipo: string;
  /** Ajuste manual de transporte que teclea el operador: positivo suma al
   *  saldo a pagar, negativo resta. 0 si no se ingresó nada. */
  ajusteTransporte?: string | null;
  /** Otro anticipo aparte del de la recepción: siempre resta al saldo a
   *  pagar. 0 si no se ingresó nada. */
  otrosAnticipo?: string | null;
  liquidoPagableBolivianos: string | null;
  saldoPagarBolivianos: string;
  observaciones?: string | null;
  fechaValorizacion: string | null;
  detalles: DetalleValorizacion[];
  calculoAportes: CalculoAporteValorizacion[];
}

/** Body para crear el borrador de valorización a partir de una recepción de mineral. */
export interface CrearBorradorValorizacionRequest {
  idRecepcionMineral: string;
}

// ==========================================================
// ACTUALIZAR VALORIZACIÓN (PATCH) — estructura confirmada
// ==========================================================

/**
 * Una fila por mineral valorizado, con su ley de laboratorio. El back
 * mergea por idMineral: mandar solo los minerales que cambiaron no afecta a
 * los demás ya guardados (upsert), y reenviar el mismo payload sin cambios
 * es seguro (no duplica ni desactiva nada).
 */
export interface DetalleValorizacionRequest {
  idMineral: number;
  ley: number;
  leyUnidad: LeyUnidad;
  /** Entero tecleado por el liquidador para armar el factor de "precio"
   *  (ej. 45 → 0.000045). Se persiste para poder retomar el borrador más
   *  tarde sin perder este dato manual. */
  precio?: number;
  /** Solo se manda si ya se resolvió la cotización vigente del mineral. */
  idCotizacionMineral?: number;
  porcentajeCotizacion?: number;
  cotizacionAplicada?: number;
  leyPagable?: number;
  precioKilo?: number;
}

/**
 * Confirmado: "VBV" = Valor Bruto de Venta, "VNV" = Valor Neto de Venta
 * (ver TipoBaseAporteCatalogo más abajo, junto al modelo de entidad_aporte).
 */
export type TipoBaseAporte = TipoBaseAporteCatalogo;

export interface AporteValorizacionRequest {
  idEntidadAporte: number;
  tipoBaseAporte: TipoBaseAporte;
  porcentajeAporte: number;
  baseCalculo: number;
  importeBolivianos: number;
}

export interface ActualizarValorizacionRequest {
  idLaboratorio?: number;
  idEstadoValorizacion?: number;
  fechaValorizacion?: string; // 'YYYY-MM-DD'
  pesoBrutoHumedoKilogramos?: number;
  pesoNetoHumedoKilogramos?: number;
  pesoNetoSecoKilogramos?: number;
  taraKilogramos?: number;
  humedadPorcentaje?: number;
  mermaPorcentaje?: number;
  mermaKilogramos?: number;
  totalValorBrutoBolivianos?: number;
  totalAportesBolivianos?: number;
  cotizacionDolar?: number;
  /** Positivo suma al saldo a pagar, negativo resta; 0 si no se ingresó nada. */
  ajusteTransporte?: number;
  /** 0 o mayor; siempre resta al saldo a pagar. */
  otrosAnticipo?: number;
  liquidoPagableBolivianos?: number;
  saldoPagarBolivianos?: number;
  observaciones?: string;
  detalles?: DetalleValorizacionRequest[];
  aportes?: AporteValorizacionRequest[];
  /** true = desactiva explícitamente todos los aportes activos, sin
   *  necesidad de mandar `aportes`. Es la única forma de comunicar "el
   *  usuario desmarcó todo": mandar `aportes: []` no hace nada en el back
   *  (solo reemplaza si el array trae contenido). */
  limpiarAportes?: boolean;
}

// ==========================================================
// ENTIDADES DE APORTE
//
// `EntidadAporte` y `DetalleAporte` son los mismos tipos que usa
// ParametricasService (fuente de verdad: parametricas.models.ts).
// ==========================================================

export type OrdenDireccionValorizacion = 'ASC' | 'DESC';

export interface FiltrosValorizacionMineral {
  page: number;
  limit: number;
  /** Busca por nombre del proveedor (de la recepción asociada) */
  busqueda?: string;
  /** Código o número de operación de la recepción asociada */
  codigoOperacion?: string;
  /** N° de carnet del proveedor de la recepción asociada */
  numeroDocumento?: string;
  idEstadoValorizacion?: number;
  fechaDesde?: string; // 'YYYY-MM-DD'
  fechaHasta?: string; // 'YYYY-MM-DD'
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'codigoOperacion' | 'fechaValorizacion' | 'numeroDocumento' | 'estado';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: OrdenDireccionValorizacion;
}

export interface ValorizacionesMineralPaginadas {
  data: ValorizacionMineral[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
