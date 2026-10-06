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

/** POST /parametricas/codificacion — sin `id` crea, con `id` actualiza.
 *  `minerales` son solo los ids: el backend guarda descripción y símbolo. */
export interface CrearCodificacionRequest {
  codigo: string;
  nombre: string;
  minerales: number[];
}

export interface ActualizarCodificacionRequest {
  id: string;
  codigo: string;
  nombre: string;
  minerales: number[];
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

// ==========================================================
// CLIENTE (compradores del mineral)
// ==========================================================

/** Cómo se le cobra a un cliente comprador.
 *  COMERCIO_INTERNO: cuenta corriente — sus anticipos van pagando los lotes
 *  a medida que se liquidan. EXPORTACION: se cobra lote por lote. */
export type ModalidadVentaCliente = 'COMERCIO_INTERNO' | 'EXPORTACION';

export const MODALIDADES_VENTA_CLIENTE: ReadonlyArray<{
  valor: ModalidadVentaCliente;
  nombre: string;
}> = [
  { valor: 'COMERCIO_INTERNO', nombre: 'Comercio interno' },
  { valor: 'EXPORTACION', nombre: 'Exportación' },
];

/** Tipo de actor "TRADING": al elegirlo en el formulario del cliente se
 *  sugiere la modalidad EXPORTACION (queda editable). */
export const ID_TIPO_ACTOR_TRADING = '6';

export function esClienteExportacion(
  cliente: Pick<Cliente, 'modalidadVenta'>,
): boolean {
  return cliente.modalidadVenta === 'EXPORTACION';
}

export interface Cliente {
  id: string;
  nombre: string;
  modalidadVenta: ModalidadVentaCliente;
  direccion?: string | null;
  telefono?: string | null;
  idMunicipio?: number | null;
  municipio?: Municipio;
  /** Reutiliza el mismo catálogo que ActorProductivoMinero — es solo una
   *  etiqueta, opcional, no lo convierte en proveedor. */
  idTipoActorProductivoMinero?: number | string | null;
  tipoActorProductivoMinero?: TipoActorProductivoMinero;
  nit?: string | null;
  observaciones?: string | null;
  /** Fecha de inicio de operaciones del cliente con la empresa, "YYYY-MM-DD".
   *  Obligatoria en el back (columna NOT NULL); si no se manda, el back la
   *  completa con la fecha actual — pero para migrar el histórico del Excel
   *  hay que mandar la fecha real, por eso el front la exige siempre. */
  fechaInicioOperaciones: string;
  activo?: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
  fechaRegistro?: string;
}

/** POST /parametricas/cliente — sin `id` crea, con `id` actualiza. A diferencia
 *  de otras entidades de este módulo, el back NO hace upsert parcial: `nombre`
 *  y `direccion` son siempre obligatorios (incluso al editar) y el resto de
 *  campos se sobreescriben completos con lo que venga en el request (si no
 *  se manda uno, queda vacío) — por eso el diálogo siempre reenvía el
 *  formulario completo, no solo lo que cambió. */
export interface GuardarClienteRequest {
  id?: string;
  nombre: string;
  direccion: string;
  telefono?: string;
  idMunicipio?: number;
  idTipoActorProductivoMinero?: number | string;
  modalidadVenta: ModalidadVentaCliente;
  nit?: string;
  observaciones?: string;
  /** "YYYY-MM-DD". Obligatoria en el front aunque el back la trate como
   *  opcional (default: hoy) — necesaria para migrar el histórico del Excel. */
  fechaInicioOperaciones: string;
}

export interface FiltrosCliente {
  page: number;
  limit: number;
  busqueda?: string;
  activo?: boolean;
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'nombre';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: 'ASC' | 'DESC';
}

export interface ClientesPaginados {
  data: Cliente[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
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

/** Moneda en todo el sistema (cuentas, caja, recibo, kardex, traspasos):
 *  "BS" o "USD". Desde la migración 067 el back ya no acepta "BOB" (400). */
export type MonedaCuenta = 'BS' | 'USD';

/** Alias histórico: las cuentas bancarias ya usaban "BS"/"USD". */
export type MonedaCuentaBancaria = MonedaCuenta;

export const SIMBOLO_MONEDA: Record<MonedaCuenta, string> = {
  BS: 'Bs',
  USD: '$us',
};

/** Etiqueta de moneda para mostrar al usuario: "Bs" o "$us". */
export function etiquetaMonedaCuenta(moneda: MonedaCuenta): string {
  return SIMBOLO_MONEDA[moneda] ?? moneda;
}

export interface CuentaFinanciera {
  id: number;
  idEntidadFinanciera?: number;
  /** Máx. 40 caracteres; único dentro del banco (409 si se repite). */
  numeroCuenta: string;
  moneda: MonedaCuentaBancaria;
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
  moneda: MonedaCuentaBancaria;
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

export interface GuardarFormaPagoRequest {
  id?: number;
  /** Solo se toma al crear: el back no lo cambia en una actualización. */
  codigo: string;
  nombre: string;
  afectaFondo: boolean;
}

/** parametrica.lugar_acopio */
export interface LugarAcopio {
  id: number;
  descripcion: string;
  activo: boolean;
}

export interface GuardarLugarAcopioRequest {
  id?: number;
  descripcion: string;
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
/** Cómo cuenta un destino en la ganancia estimada del dashboard: no todo lo
 *  que sale es gasto ni todo lo que entra es ganancia. */
export type CategoriaDestinoGasto =
  | 'GASTO_OPERATIVO'
  | 'SUELDOS'
  | 'OTRO_INGRESO'
  | 'COMPRA_MINERAL'
  | 'VENTA_MINERAL'
  | 'INVERSION'
  | 'PRESTAMO_ANTICIPO'
  | 'FINANCIERO';

export interface CategoriaDestinoGastoOpcion {
  valor: CategoriaDestinoGasto;
  nombre: string;
  /** Qué hace en la ganancia estimada. */
  efecto: string;
  /** Se ofrece para destinos de egreso, de ingreso, o ambos. */
  paraEgreso: boolean;
  paraIngreso: boolean;
}

export const CATEGORIAS_DESTINO_GASTO: ReadonlyArray<CategoriaDestinoGastoOpcion> = [
  { valor: 'GASTO_OPERATIVO', nombre: 'Gasto operativo', efecto: 'Resta de la ganancia', paraEgreso: true, paraIngreso: false },
  { valor: 'SUELDOS', nombre: 'Sueldos', efecto: 'Resta de la ganancia', paraEgreso: true, paraIngreso: false },
  { valor: 'OTRO_INGRESO', nombre: 'Otro ingreso', efecto: 'Suma a la ganancia', paraEgreso: false, paraIngreso: true },
  { valor: 'COMPRA_MINERAL', nombre: 'Compra de mineral', efecto: 'No cuenta: ya está en lo invertido de cada lote', paraEgreso: true, paraIngreso: false },
  { valor: 'VENTA_MINERAL', nombre: 'Venta de mineral', efecto: 'No cuenta: ya está en la liquidación de cada lote', paraEgreso: false, paraIngreso: true },
  { valor: 'INVERSION', nombre: 'Inversión (activos)', efecto: 'No cuenta: terrenos, vehículos, equipos', paraEgreso: true, paraIngreso: true },
  { valor: 'PRESTAMO_ANTICIPO', nombre: 'Préstamo o anticipo', efecto: 'No cuenta: dinero que debe volver', paraEgreso: true, paraIngreso: true },
  { valor: 'FINANCIERO', nombre: 'Financiero', efecto: 'No cuenta: bancos, deudas, cambios de cheque', paraEgreso: true, paraIngreso: true },
];

export function nombreCategoriaDestinoGasto(categoria: string | null | undefined): string {
  return (
    CATEGORIAS_DESTINO_GASTO.find((c) => c.valor === categoria)?.nombre ??
    'Sin destino'
  );
}

export interface DestinoGasto {
  id: number;
  /** Único (sin distinguir mayúsculas); repetido -> 409. */
  nombre: string;
  esEgreso: boolean;
  categoria: CategoriaDestinoGasto;
  activo?: boolean;
  usuarioRegistro?: string | null;
  usuarioUltimaModificacion?: string | null;
  fechaRegistro?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface GuardarDestinoGastoRequest {
  id?: number;
  nombre: string;
  esEgreso: boolean;
  categoria: CategoriaDestinoGasto;
}

// ==========================================================
// CODIFICACIÓN DE LOTE (Comercio interno — promedios)
// ==========================================================

export interface CodificacionLoteParam {
  /** bigint: llega como string. */
  id: string;
  /** Único (sin distinguir mayúsculas); el back lo guarda en MAYÚSCULAS. */
  codigo: string;
  nombre: string;
  /** bigint: llega como string. Arranca en "0"; editar no lo toca. */
  ultimoCorrelativo: string;
  activo: boolean;
  usuarioRegistro?: string | null;
  usuarioUltimaModificacion?: string | null;
  fechaRegistro?: string | null;
  fechaUltimaModificacion?: string | null;
}

export interface GuardarCodificacionLoteRequest {
  id?: string | number;
  codigo: string;
  nombre: string;
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
  saldoInicialBs: string;
  /** "YYYY-MM-DD"; null mientras no se aperturó la caja en BS. */
  fechaSaldoInicialBs: string | null;
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
  saldoInicialBs?: number;
  fechaSaldoInicialBs?: string;
  saldoInicialUsd?: number;
  fechaSaldoInicialUsd?: string;
}