// src/app/pages/ui-components/models/promedio-mineral.models.ts

export type EstadoDisponibles = 'ambas' | 'pre_valorizadas' | 'valorizadas';

export interface LeyDisponible {
  idMineral: string;
  mineral: string;
  ley: number;
  unidad: string;
}

/** Fila de `GET /promedio_mineral/disponibles`. */
export interface ValorizacionDisponible {
  idValorizacion: string;
  codigoOperacion: string;
  /** Codificación efectiva (con la que se valorizó). */
  codificacion: string;
  /** Codificación original de la recepción; si difiere de `codificacion`
   *  se muestra "ICC → BCL". */
  codificacionRecepcion?: string | null;
  proveedor: string;
  numeroSacos: number | null;
  pesoKg: number;
  /** Valor neto de venta (Bs) de la valorización. */
  valorNetoVentaBolivianos: number;
  /** Humedad (%) de la valorización; si no la tiene, la de la recepción. */
  humedadPorcentaje: number | null;
  leyes: LeyDisponible[];
  idEstadoValorizacion: number;
  estadoValorizacion: string;
  entregado: boolean;
  fechaValorizacion: string;
}

export interface FiltrosDisponibles {
  codificacion?: string;
  estado?: EstadoDisponibles;
  busqueda?: string;
  page?: number;
  limit?: number;
  orderBy?: 'codigoOperacion' | 'peso' | 'id';
  orderDirection?: 'ASC' | 'DESC';
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Fila de `GET /promedio_mineral/codificaciones_lote`. */
export interface CodificacionLote {
  id: string;
  codigo: string;
  nombre: string;
  ultimoCorrelativo: string;
  activo: boolean;
}

export interface LeyPromedio {
  idMineral: string;
  mineral: string;
  leyPromedio: number;
  leyUnidad: string;
  pesoBaseKilogramos: number;
}

export interface PromedioMineral {
  id: string;
  uuid?: string;
  correlativo?: string;
  codigo: string;
  /** Codificación del lote del promedio (independiente de la de sus valorizaciones). */
  idCodificacionLote?: string;
  correlativoLote?: string;
  /** Ej. `MC-0006`. */
  codigoLote?: string;
  codificacionLote?: { id: string; codigo: string; nombre: string };
  descripcion: string | null;
  fecha: string;
  cantidadValorizaciones: number;
  numeroSacosTotal: number | null;
  pesoTotalKilogramos: number;
  leyes: LeyPromedio[];
  /** Humedad promedio (%) ponderada por peso; null si ninguna valorización la tiene. */
  humedadPromedioPorcentaje?: number | null;
  /** TOTAL DE EFECTIVO INVERTIDO (Bs): suma del valor neto de venta de las
   *  valorizaciones; se guarda al crear o al reemplazar la composición. */
  totalEfectivoInvertido?: number;
  observaciones: string | null;
  activo: boolean;
  usuarioUltimaModificacion?: string;
  fechaUltimaModificacion?: string;
  /** Solo en el detalle. */
  detalles?: PromedioDetalle[];
}

export interface PromedioDetalle {
  id: string;
  idValorizacion: string;
  numeroSacos: number | null;
  pesoKilogramos: number;
  /** Monto (Bs) con el que la valorización entró al promedio. */
  valorNetoVentaBolivianos?: number;
  /** Humedad (%) con la que la valorización entró al promedio. */
  humedadPorcentaje?: number | null;
  valorizacion?: {
    id: string;
    codificacionValorizacion?: { codigo: string } | null;
    recepcionMineral?: {
      codigoOperacion: string;
      persona?: {
        nombres: string;
        apellidoPaterno: string;
        apellidoMaterno?: string | null;
      };
      codificacion?: { codigo: string };
    };
  };
}

export type PromediosPaginados = Paginado<PromedioMineral>;

export interface FiltrosPromedio {
  busqueda?: string;
  page?: number;
  limit?: number;
  orderBy?: 'id' | 'codigo' | 'fecha' | 'pesoTotalKilogramos';
  orderDirection?: 'ASC' | 'DESC';
}

export interface GuardarPromedioRequest {
  /** Obligatorio al crear; al editar, si cambia toma el siguiente correlativo de la nueva. */
  idCodificacionLote?: string;
  descripcion?: string;
  fecha?: string;
  observaciones?: string;
  idsValorizacion?: string[];
}
