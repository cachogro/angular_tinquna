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
export type CalculoValorizacion = Record<string, unknown>;

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
  /** Solo BCL: peso bruto húmedo − agua (peso bruto húmedo × humedad%).
   *  No aplica en RAM/estándar. */
  pesoBrutoSecoKilogramos?: string | null;
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
  totalValorLiquidoVentaBolivianos: string;
  totalValorLiquidoVentaUsd: string | null;
  observaciones?: string | null;
  fechaValorizacion: string | null;
  detalles: DetalleValorizacion[];
  calculoAportes: CalculoAporteValorizacion[];
  /** Solo BCL: Gastos de Tratamiento y Penalidades ya guardados. */
  calculos?: CalculoValorizacion[];
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
  // ---- Solo para codificación RAM: precio por tabla de Escala de Precio
  // en vez de cotización de mercado (ver ParametricasService/EscalaPrecio).
  // No se manda idCotizacionMineral, porcentajeCotizacion, cotizacionAplicada,
  // leyPagable, precioKilo ni precio en estas filas. ----
  /** Entero que se resta a la ley real para buscar el tramo en la tabla
   *  (negativo suma). Resultado = "ley ajustada". */
  ajustePuntosLey?: number;
  /** ley − ajustePuntosLey, truncada al entero: la que efectivamente se usó
   *  para encontrar el tramo de la tabla vigente. */
  leyAjustada?: number;
  /** id del tramo (fila) de Escala de Precio encontrado para leyAjustada;
   *  solo se manda si la tabla vigente tenía un tramo para esa ley. */
  idEscalaPrecio?: number;
  /** USD/TM del tramo encontrado (ver EscalaPrecio.precioTm). Reemplaza a
   *  precioKilo, que no aplica en RAM. */
  precioUsdTm?: number;
  // ---- Solo para codificación BCL (Plata + Plomo): fórmula propia del
  // contrato de fundición (ver ValorizacionFormComponent.recalcularFilaLeyBcl).
  // No se manda leyPagable en estas filas. ----
  /** Puntos que se restan a la ley recalculada (no a la cotización) antes
   *  de aplicar el precio. */
  descuentoLey?: number;
  /** Ley recalculada (ley ÷ factorConversion × 100) − descuentoLey. */
  leyAplicada?: number;
  /** % Adición que multiplica a la ley aplicada antes de la cotización.
   *  Se guarda como porcentaje (ej. 83), no como fracción. */
  porcentajeAdicion?: number;
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

/**
 * Solo BCL: una fila por cada Gasto de Tratamiento o Penalidad activa (ver
 * catálogo `tipo-calculo-valorizacion`, grupo 1 y 2 respectivamente).
 * `extras` es un snapshot de los valores del catálogo usados en el cálculo
 * (más `ley` en penalidades), para que la valorización guardada no cambie
 * si el catálogo se edita después.
 */
export interface CalculoValorizacionRequest {
  idTipoCalculoValorizacion: number;
  /** Base sobre la que se aplicó la tasa: en Penalidades, peso neto seco
   *  en TMS; en Gastos de Tratamiento, la diferencia Actual−Base (ver
   *  extras.diferencia; ya no usan TMS/oz). */
  baseCalculo: number;
  importeBolivianos: number;
  /** Solo Gastos de Tratamiento: "Actual" tecleado por el liquidador. */
  valorAplicado?: number;
  extras?: {
    /** Gastos de Tratamiento: tecleado por el liquidador al momento de liquidar. */
    actual?: number;
    /** Gastos de Tratamiento: valor de referencia, tecleado por el
     *  liquidador (precargado con el del catálogo, pero editable). */
    base?: number;
    /** Gastos de Tratamiento: actual − base. */
    diferencia?: number;
    escalador?: number;
    ley?: number;
    leyLibre?: number;
    cargo?: number;
  };
}

export interface ActualizarValorizacionRequest {
  idLaboratorio?: number;
  idEstadoValorizacion?: number;
  fechaValorizacion?: string; // 'YYYY-MM-DD'
  pesoBrutoHumedoKilogramos?: number;
  pesoNetoHumedoKilogramos?: number;
  /** Solo BCL (ver ValorizacionFormComponent.recalcularPesoNetoSecoBcl). */
  pesoBrutoSecoKilogramos?: number;
  pesoNetoSecoKilogramos?: number;
  taraKilogramos?: number;
  humedadPorcentaje?: number;
  mermaPorcentaje?: number;
  mermaKilogramos?: number;
  /** No aplica en RAM (ver totalValorToneladaBolivianos/totalValorToneladaUsd). */
  totalValorBrutoBolivianos?: number;
  /** No aplica en RAM. */
  totalAportesBolivianos?: number;
  /** Solo RAM: USD/TM Total × tipo de cambio ÷ 1000 (ver
   *  ValorizacionFormComponent.valorToneladaBsRam). */
  totalValorToneladaBolivianos?: number;
  /** Solo RAM: suma de USD/TM (tabla) de todas las filas de ley (ver
   *  ValorizacionFormComponent.totalUsdTmRam). */
  totalValorToneladaUsd?: number;
  cotizacionDolar?: number;
  /** Positivo suma al saldo a pagar, negativo resta; 0 si no se ingresó nada. */
  ajusteTransporte?: number;
  /** 0 o mayor; siempre resta al saldo a pagar. */
  otrosAnticipo?: number;
  totalValorLiquidoVentaBolivianos?: number;
  totalValorLiquidoVentaUsd?: number;
  observaciones?: string;
  detalles?: DetalleValorizacionRequest[];
  aportes?: AporteValorizacionRequest[];
  /** Solo BCL: Gastos de Tratamiento y Penalidades (ver
   *  ValorizacionFormComponent.construirCalculosBcl). */
  calculos?: CalculoValorizacionRequest[];
  /** true = desactiva explícitamente todos los aportes activos, sin
   *  necesidad de mandar `aportes`. Es la única forma de comunicar "el
   *  usuario desmarcó todo": mandar `aportes: []` no hace nada en el back
   *  (solo reemplaza si el array trae contenido). */
  limpiarAportes?: boolean;
}

/**
 * Body del PATCH dedicado a cambiar de estado (.../valorizacion_mineral/:id/estado).
 * Solo acepta 2 (PRE-VALORIZADO) o 3 (VALORIZADO); ambos exigen que la
 * valorización esté activa, tenga totalValorLiquidoVentaBolivianos > 0 y al menos un
 * detalle de mineral registrado. Pasar a VALORIZADO además marca la
 * recepción de mineral asociada como TRANZADO.
 */
export interface CambiarEstadoValorizacionRequest {
  idEstadoValorizacion: number;
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
