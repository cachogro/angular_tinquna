export interface Mineral {
  id: number;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  calculoRegalia?: string | null;
  tipo?: string;
  /** Estáticas por mineral (no varían por cotización); no todos los
   *  minerales tienen alícuota configurada. */
  alicuotaExterna?: number;
  alicuotaInterna?: number;
  activo?: boolean;
}

/** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
export interface GuardarMineralRequest {
  id?: number;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  tipo?: string;
  alicuotaExterna?: number;
  alicuotaInterna?: number;
}

export interface Codificacion {
  id: string;
  codigo: string;
  nombre: string;
  minerales: Mineral[];
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

/** Mineral tal como va anidado en el request de codificación: además del id
 *  se manda descripción y símbolo para que el backend los persista junto a
 *  la codificación (antes solo se guardaba el id, y el símbolo se perdía). */
export interface CodificacionMineralRequest {
  id: number;
  descripcion: string;
  simbolo?: string;
}

export interface CrearCodificacionRequest {
  codigo: string;
  nombre: string;
  minerales: CodificacionMineralRequest[];
}

export interface ActualizarCodificacionRequest {
  id: string;
  codigo: string;
  nombre: string;
  minerales: CodificacionMineralRequest[];
}

// ==========================================================
// COTIZACIONES
// ==========================================================

/**
 * Versión resumida del mineral tal como viene anidado en la
 * respuesta de cotización. El backend devuelve el `id` como
 * string en este anidado (aunque en /allMinerales viene number),
 * por eso se tipa como number | string para no romper en runtime.
 */
export interface MineralEnCotizacion {
  id: number | string;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  tipo?: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface Cotizacion {
  id: number;
  idMineral: number;
  cotizacionMineralDolares: number;
  fechaVigenciaInicial: string;
  fechaVigenciaFinal: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
  mineral?: MineralEnCotizacion;
}

/** El back asigna fechaVigenciaInicial automáticamente, por eso no va aquí */
export interface CrearCotizacionRequest {
  idMineral: number;
  cotizacionMineralDolares: number;
  fechaVigenciaFinal: string;
}

/** No se permite cambiar idMineral ni fechaVigenciaInicial.
 *  Todos los campos salvo `id` son opcionales: lo que se omite, no se modifica. */
export interface ActualizarCotizacionRequest {
  id: number;
  cotizacionMineralDolares?: number;
  fechaVigenciaFinal?: string;
}

export interface FiltrosCotizacion {
  page: number;
  limit: number;
  busqueda?: string;
  idMineral?: number;
  /** true = solo la cotización vigente de cada mineral */
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'mineral' | 'fechaVigenciaInicial' | 'fechaVigenciaFinal';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
  vigente?: boolean;
  activo?: boolean;
}

export interface CotizacionesPaginadas {
  data: Cotizacion[];
  total: number;
  page: number;
  limit: number;
}

// ==========================================================
// ESCALA DE PRECIO (tabla de precios por tramo de ley, usada para
// valorizar "cargas" en vez de la cotización oficial de mercado)
// ==========================================================

export interface EscalaPrecio {
  id: number;
  idMineral: number;
  ley: number;
  precioPunto: number;
  precioTm: number;
  fechaVigenciaInicial: string;
  fechaVigenciaFinal: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  mineral?: MineralEnCotizacion;
}

export interface FilaEscalaPrecioRequest {
  ley: number;
  precioPunto: number;
  precioTm: number;
}

/** Crea de una sola vez todos los tramos de ley de un mineral para un
 *  mismo período de vigencia (ej. la tabla completa de Zinc de agosto). */
export interface CrearEscalaPrecioRequest {
  idMineral: number;
  fechaVigenciaInicial: string;
  fechaVigenciaFinal: string;
  filas: FilaEscalaPrecioRequest[];
}

export interface FilaActualizarEscalaPrecio {
  id: number;
  precioPunto?: number;
  precioTm?: number;
}

/** Corrige uno o varios tramos ya creados (por su id); lo que se omite no se modifica. */
export interface ActualizarEscalaPrecioRequest {
  filas: FilaActualizarEscalaPrecio[];
}

export interface Ingenio {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

// ==========================================================
// ACTOR PRODUCTIVO MINERO (antes "Ingenio")
// ==========================================================

export interface TipoActorProductivoMinero {
  id: number | string;
  descripcion: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

/** Una sección de mina de un actor productivo minero. El `id` es un
 *  correlativo que maneja el frontend (no lo genera la base de datos):
 *  se usa solo para poder editar/quitar filas antes de guardar. */
export interface SeccionMina {
  id: number;
  descripcion: string;
}

export interface ActorProductivoMinero {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  idTipoActorProductivoMinero: number | string;
  tipoActorProductivoMinero?: TipoActorProductivoMinero;
  idMunicipio?: number | null;
  municipio?: Municipio;
  /** Fecha de inicio de operaciones, formato "YYYY-MM-DD" */
  fechaInicioOperaciones?: string | null;
  nim?: string;
  codigo?: string;
  seccionesMina?: SeccionMina[];
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

export interface GuardarActorProductivoMineroRequest {
  id?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  idTipoActorProductivoMinero: number | string;
  /** idMunicipio, fechaInicioOperaciones, nim, codigo y seccionesMina son
   *  opcionales: se omiten si no aplican. seccionesMina se reemplaza completo
   *  en cada request. */
  idMunicipio?: number;
  /** Formato "YYYY-MM-DD" */
  fechaInicioOperaciones?: string;
  nim?: string;
  codigo?: string;
  seccionesMina?: SeccionMina[];
}

// ==========================================================
// MUNICIPIO
// ==========================================================

export interface Municipio {
  id: number;
  codigo: string;
  municipio: string;
  provincia: string;
  departamento: string;
  activo?: boolean;
}

export interface FiltrosActorProductivoMinero {
  page: number;
  limit: number;
  /** Solo se busca por nombre */
  busqueda?: string;
  activo?: boolean;
  idTipoActorProductivoMinero?: number | string;
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'nombre' | 'direccion' | 'telefono' | 'tipoActorProductivoMinero';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
}

export interface ActoresProductivosMinerosPaginados {
  data: ActorProductivoMinero[];
  total: number;
  page: number;
  limit: number;
}

export interface Laboratorio {
  id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activo: boolean;
  fechaRegistro?: string;
  fechaUltimaModificacion?: string;
  usuarioUltimaModificacion?: string;
}

export interface GuardarLaboratorioRequest {
  id?: string | number;
  nombre: string;
  direccion?: string;
  telefono?: string;
}

// ==========================================================
// ENTIDAD FINANCIERA (banco / entidad + sus cuentas)
// ==========================================================

export type MonedaCuenta = 'BOB' | 'USD';

export interface CuentaFinanciera {
  id: number;
  idEntidadFinanciera?: number;
  numeroCuenta: string;
  moneda: MonedaCuenta;
  alias?: string | null;
  /** Saldo de apertura de la cuenta para la libreta de bancos (string tipo "0.00"). */
  saldoInicial?: string | null;
  /** "YYYY-MM-DD" — fecha del saldo inicial; null mientras no se configuró. */
  fechaSaldoInicial?: string | null;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface EntidadFinanciera {
  id: number;
  /** Se guarda en MAYÚSCULAS. Único (case-insensitive). */
  nombre: string;
  /** Se guarda en MAYÚSCULAS. */
  sigla: string;
  cuentas: CuentaFinanciera[];
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

/** Cuenta tal como va anidada en el request de entidad financiera:
 *  con `id` se modifica, sin `id` se agrega. `activo` no se manda aquí
 *  (para dar de baja una cuenta se usa su endpoint cambiar_estado). */
export interface GuardarCuentaFinancieraRequest {
  id?: number;
  numeroCuenta: string;
  moneda: MonedaCuenta;
  alias?: string;
  /** Solo se manda cuando se configura/edita el saldo de apertura. */
  saldoInicial?: number;
  /** "YYYY-MM-DD" */
  fechaSaldoInicial?: string;
}

/** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza.
 *  Las cuentas se hacen upsert incremental: las que no vienen no se tocan. */
export interface GuardarEntidadFinancieraRequest {
  id?: number;
  nombre: string;
  sigla: string;
  cuentas?: GuardarCuentaFinancieraRequest[];
}


// Bases de cálculo del aporte: VBV = Valor Bruto de Venta, VNV = Valor Neto de Venta
export type TipoBaseAporte = 'VBV' | 'VNV';

// Detalle de cada aporte
export interface DetalleAporte {
  alicuota: number;
  tipoBaseAporte: TipoBaseAporte;
}

/** Catálogo fijo, codificado en el front (el back no expone servicio para esto) */
export interface TipoEntidadAporte {
  id: number;
  descripcion: string;
}

// Entidad de aporte completa
export interface EntidadAporte {
  id: number;               // En la respuesta es number, no string
  descripcion: string;
  activo: boolean;
  usuarioUltimaModificacion: string | null;
  fechaUltimaModificacion: string | null; // ISO date string o null
  detalleAporte: DetalleAporte[] | null;  // Puede ser null
  idTipoEntidadAporte: number | string;
  tipoEntidadAporte?: TipoEntidadAporte;
}

/** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza */
export interface GuardarEntidadAporteRequest {
  id?: number;
  descripcion: string;
  detalleAporte: DetalleAporte[];
  idTipoEntidadAporte: number;
}

// ==========================================================
// TIPO DE CÁLCULO VALORIZACIÓN (Gastos de Tratamiento y Penalidades)
//
// Un solo recurso en el back, particionado por `idTipoCalculo`: 1 = Gastos
// de Tratamiento (maquila, refinación, etc.), 2 = Penalidades (elementos
// traza como As, Sb, Bi...), 3 = Otros (AL, ROLLBACK — mismo mecanismo de
// `calculos` que gastos/penalidades, pero sin `extras` propio). Fijo, no
// cambia.
// ==========================================================

export const ID_TIPO_CALCULO_GASTO_TRATAMIENTO = 1;
export const ID_TIPO_CALCULO_PENALIDAD = 2;
export const ID_TIPO_CALCULO_OTROS = 3;

/** `extras` de un Gasto de Tratamiento (ej. Maquila, Gastos de refinación Ag). */
export interface ExtrasGastoTratamiento {
  /** Cargo base por unidad (ej. 85 USD/TMS de maquila). */
  base: number;
  /** Unidad del cargo, tal como se muestra al liquidador (ej. "USD/TMS", "USD/oz"). */
  unidad: string;
  /** Factor que ajusta el cargo base cuando el valor real difiere del acordado. 0 si no aplica. */
  escalador: number;
}

/** `extras` de una Penalidad (ej. As, Sb, Bi, Sn, Fe, SIO2). */
export interface ExtrasPenalidad {
  /** Incremento de ley al que se aplica `cargo` una vez superado `leyLibre` (ej. 0.001). */
  cada: number;
  /** Cargo monetario por cada `cada` de ley excedida sobre `leyLibre`. */
  cargo: number;
  /** Límite de ley libre de penalidad: por debajo no se cobra nada. */
  leyLibre: number;
  /** Unidad de `leyLibre` (ej. "%", "g/TM"). */
  unidadLey: string;
  /** Unidad de `cargo` (ej. "USD/TMS"). */
  unidadCargo: string;
}

/** `extras` de "Otros" (AL, ROLLBACK): vacío, confirmado por el usuario
 *  2026-08-21 — a diferencia de gastos/penalidades, estos no traen
 *  configuración propia en el catálogo, son solo un id + descripción para
 *  poder guardar su resultado en `calculos`. */
export type ExtrasOtros = Record<string, never>;

export interface TipoCalculoValorizacion<
  TExtras = ExtrasGastoTratamiento | ExtrasPenalidad | ExtrasOtros,
> {
  id: number;
  descripcion: string;
  idTipoCalculo: number;
  extras: TExtras;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

/** POST crea, PATCH actualiza — a diferencia del resto de catálogos, este
 *  recurso usa verbos HTTP distintos en vez de "un solo POST"; y el PATCH
 *  pide el body completo (hay que reenviar descripcion e idTipoCalculo). */
export interface GuardarTipoCalculoValorizacionRequest<
  TExtras = ExtrasGastoTratamiento | ExtrasPenalidad,
> {
  id?: number;
  descripcion: string;
  idTipoCalculo: number;
  extras: TExtras;
}

export interface TipoCalculoValorizacionAgrupado {
  gastos: TipoCalculoValorizacion<ExtrasGastoTratamiento>[];
  penalidades: TipoCalculoValorizacion<ExtrasPenalidad>[];
  otros: TipoCalculoValorizacion<ExtrasOtros>[];
}

// ==========================================================
// CATÁLOGOS DEL KARDEX DE ANTICIPOS (contabilidad.movimiento_kardex)
// ==========================================================

/** parametrica.forma_pago */
export interface FormaPago {
  id: number;
  codigo: string;
  nombre: string;
  /** false = movimiento interno (descuento, tranzado): no mueve caja ni banco. */
  afectaFondo?: boolean;
  activo?: boolean;
}

/** parametrica.tipo_movimiento_kardex */
export interface TipoMovimientoKardex {
  id: number;
  codigo: string;
  nombre: string;
  /** D (debe) | H (haber) — informativo, no fuerza el `tipo` de la línea. */
  signo: 'D' | 'H';
  activo?: boolean;
}

/** parametrica.kardex_subcuenta — catálogo extensible (PRINCIPAL, COMPRESORA...). */
export interface KardexSubcuenta {
  id: number;
  nombre: string;
  origen?: 'SEED' | 'USUARIO';
  activo?: boolean;
}

/** parametrica.destino_gasto — categoría contable del recibo.
 *  `esEgreso: true` → se ofrece en recibos de EGRESO; `false` → en INGRESO. */
export interface DestinoGasto {
  id: number;
  nombre: string;
  esEgreso: boolean;
  activo?: boolean;
}

// ==========================================================
// CAJA (fondo de efectivo — opera en Bs. y $us. a la vez, cada moneda con
// su propio saldo inicial; la usa la Caja de Flujo en Contabilidad).
// ==========================================================

export interface Caja {
  id: number;
  /** Se guarda en MAYÚSCULAS. Único (case-insensitive). */
  nombre: string;
  /** String tipo "0.00": saldo con el que arranca la caja en bolivianos. */
  saldoInicialBob: string;
  /** "YYYY-MM-DD"; null mientras no se aperturó la caja en BOB. */
  fechaSaldoInicialBob: string | null;
  saldoInicialUsd: string;
  fechaSaldoInicialUsd: string | null;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

/** Un solo POST para crear y actualizar: sin `id` crea, con `id` actualiza. */
export interface GuardarCajaRequest {
  id?: number;
  nombre: string;
  saldoInicialBob?: number;
  fechaSaldoInicialBob?: string;
  saldoInicialUsd?: number;
  fechaSaldoInicialUsd?: string;
}