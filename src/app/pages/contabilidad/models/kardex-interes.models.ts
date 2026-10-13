// src/app/pages/contabilidad/models/kardex-interes.models.ts
// Intereses por mora de un kardex (actor, asociado o personal). Se llevan
// APARTE del kardex: una cuota por mes = saldo del kardex al día de corte x
// tasa / 100. Mientras están PENDIENTES no forman parte del saldo y son
// negociables (bajar la tasa las recalcula, condonar las perdona); al
// CARGARLAS pasan al kardex como una línea DEBE y se cobran con recibo.

import { EstadoKardex, TipoKardex } from './kardex.models';

export type EstadoKardexInteres = 'VIGENTE' | 'FINALIZADO';
export type EstadoKardexInteresCuota = 'PENDIENTE' | 'CARGADO' | 'CONDONADO';
export type TipoKardexInteresEvento =
  | 'APLICACION'
  | 'CAMBIO_TASA'
  | 'CONDONACION'
  | 'CARGO_KARDEX'
  | 'REVERSION_CARGO'
  | 'FINALIZACION';

/** Viene en cada kardex del listado (`kardex.interes`); null si nunca tuvo. */
export interface ResumenInteresKardex {
  /** Plan que sigue generando cuotas; null si ya no hay ninguno vigente. */
  idKardexInteres: string | null;
  estado: EstadoKardexInteres;
  /** % mensual del plan vigente o, si no hay, del último. */
  tasaMensual: number;
  fechaInicio: string;
  /** "YYYY-MM-DD": día en que se genera la próxima cuota. */
  proximoCorte: string | null;
  cuotasPendientes: number;
  /** Devengado y todavía negociable: NO está en el saldo del kardex. */
  pendiente: number;
  /** Ya cargado al kardex (dentro de su saldo). */
  cargado: number;
  condonado: number;
  /** saldoActual + pendiente: lo que se le cobraría hoy. */
  totalConIntereses: number;
}

export interface KardexInteresCuota {
  id: string;
  idKardexInteres: string;
  numero: number;
  /** "YYYY-MM-DD" */
  fechaDesde: string;
  fechaCorte: string;
  /** Saldo del kardex al día de corte. */
  saldoBase: string;
  tasa: string;
  monto: string;
  estado: EstadoKardexInteresCuota;
  /** Línea DEBE del kardex con la que se cargó (solo CARGADO). */
  idMovimientoKardex?: string | null;
}

export interface KardexInteresEvento {
  id: string;
  tipo: TipoKardexInteresEvento;
  fecha: string;
  tasaAnterior?: string | null;
  tasaNueva?: string | null;
  /** CAMBIO_TASA: total pendiente antes del recálculo. */
  montoAnterior?: string | null;
  /** Lo cargado, lo condonado o el nuevo total pendiente. */
  monto?: string | null;
  cuotas?: number | null;
  observacion?: string | null;
  idMovimientoKardex?: string | null;
  usuarioRegistro?: string | null;
  fechaRegistro?: string | null;
}

export interface KardexInteres {
  id: string;
  idKardex: string;
  tasaMensual: string;
  fechaInicio: string;
  estado: EstadoKardexInteres;
  fechaFin?: string | null;
  observaciones?: string | null;
  cuotas: KardexInteresCuota[];
  eventos: KardexInteresEvento[];
  usuarioRegistro?: string | null;
  fechaRegistro?: string | null;
}

/** Respuesta de GET /contabilidad/kardex/:id/interes y de toda operación. */
export interface DetalleInteresKardex {
  kardex: {
    id: string;
    codigo: string;
    tipo: TipoKardex;
    estado: EstadoKardex;
    saldoActual: string;
  };
  resumen: ResumenInteresKardex | null;
  vigente: KardexInteres | null;
  /** Todos los planes del kardex, el más reciente primero. */
  planes: KardexInteres[];
}

/** POST /contabilidad/kardex/:id/interes */
export interface AplicarInteresRequest {
  tasaMensual: number;
  /** "YYYY-MM-DD"; por defecto hoy. */
  fechaInicio?: string;
  observaciones?: string;
}

/** PATCH /contabilidad/kardex-interes/:id/tasa */
export interface CambiarTasaInteresRequest {
  tasaMensual: number;
  observacion: string;
}

/** PATCH /contabilidad/kardex-interes/:id/condonar */
export interface CondonarInteresRequest {
  observacion: string;
  /** true (defecto): además deja de generar intereses. */
  finalizar?: boolean;
}

/** POST /contabilidad/kardex-interes/:id/cargar */
export interface CargarInteresRequest {
  /** "YYYY-MM-DD"; por defecto hoy. */
  fecha?: string;
  /** true: además deja de generar intereses (defecto false). */
  finalizar?: boolean;
  observacion?: string;
}
