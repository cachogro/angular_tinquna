// src/app/pages/contabilidad/models/recibo.models.ts
// Recibos de caja: INGRESO (serie R) / EGRESO (serie C). `numero` es
// correlativo GLOBAL por serie (nunca reinicia); el código legible es
// "R-0020" / "C-0003" (serie + numero con 4 dígitos).
//
// La porción de cada detalle aplicada a kardex (PERSONAL + ACTOR) siempre
// postea HABER en ese kardex (salda deuda) y ADEMÁS genera un INGRESO por
// esa misma suma en la caja de flujo (valor recuperado por la empresa); la
// porción EFECTIVO no toca ningún kardex, pero genera un EGRESO en la caja
// de flujo por ese monto (dinero que realmente sale). Un mismo recibo puede
// generar los dos movimientos de caja a la vez (`movimientosCaja`, 0 a 2
// elementos) — independiente de si el recibo en sí es INGRESO o EGRESO.
import {
  DestinoGasto,
  FormaPago,
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { MovimientoCaja } from './movimiento-caja.models';

export type TipoRecibo = 'INGRESO' | 'EGRESO';
export type SerieRecibo = 'R' | 'C';
export type DestinoDetalleRecibo = 'PERSONAL' | 'ACTOR' | 'CLIENTE' | 'EFECTIVO';

/** Ciclo de vida del recibo:
 *  - BORRADOR: solo cabecera (POST sin `detalles`). No toca kardex ni caja.
 *  - PROCESADO: terminal. Se pobló kardex + caja de flujo. Se llega vía
 *    `PATCH /:id/procesar` desde un BORRADOR, o directo con un POST que ya
 *    incluye `detalles` (one-shot: crea y procesa en la misma transacción).
 *  - ANULADO: terminal. Solo se puede anular un BORRADOR (nada que revertir). */
export type EstadoRecibo = 'BORRADOR' | 'PROCESADO' | 'ANULADO';

/** Persona tal como viene anidada en el recibo (subset). */
export interface PersonaEnRecibo {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}

/** Actor tal como viene anidado en el recibo (subset). */
export interface ActorEnRecibo {
  id: string;
  nombre: string;
}

/** Cliente tal como viene anidado en el recibo (subset). */
export interface ClienteEnRecibo {
  id: string;
  nombre: string;
}

/** Persona autorizante tal como viene anidada en el recibo (subset). */
export interface PersonaAutorizoEnRecibo {
  id: string;
  nombres: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string | null;
  autorizado?: boolean;
}

/** Cuenta bancaria tal como viene anidada en el recibo (subset). Solo aplica
 *  cuando la forma de pago es bancaria (QR, transferencia, cheque, depósito). */
export interface CuentaBancariaEnRecibo {
  id: number;
  numeroCuenta: string;
  moneda?: string;
  alias?: string | null;
  entidadFinanciera?: { id: number; nombre: string; sigla: string } | null;
}

export interface DetalleReciboRequest {
  destino: DestinoDetalleRecibo;
  idPersona?: string;
  idActorProductivoMinero?: string;
  idCliente?: string;
  monto: number;
  /** Categoría contable de ESTA porción (catálogo destino-gasto). */
  idDestinoGasto?: number;
  /** Código de lote que queda en la línea del kardex (ej. cobro de venta de lote). */
  lote?: string;
}

export interface DetalleRecibo {
  id: string;
  destino: DestinoDetalleRecibo;
  idPersona?: string | null;
  persona?: PersonaEnRecibo | null;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: ActorEnRecibo | null;
  idCliente?: string | null;
  cliente?: ClienteEnRecibo | null;
  monto: string;
  idDestinoGasto?: number | null;
  destinoGasto?: DestinoGasto | null;
  /** Línea de kardex generada por esta porción; null si destino=EFECTIVO. */
  idMovimientoKardex?: string | null;
}

export interface Recibo {
  id: string;
  tipo: TipoRecibo;
  serie: SerieRecibo;
  estado: EstadoRecibo;
  /** Correlativo global por serie (nunca reinicia). Código legible: `${serie}-${numero con 4 dígitos}`. */
  numero: number;
  fecha: string;
  /** Monto total del recibo (lo que se imprime), en la moneda del recibo;
   *  string tipo "1500.00". */
  montoTotal: string;
  /** Moneda del recibo (por defecto BS). Se fija al crear el borrador. */
  moneda?: MonedaCuenta;
  /** Bs por 1 USD ("6.9600"); null en BS. */
  tipoCambio?: string | null;
  concepto: string;
  idFormaPago?: number | null;
  formaPago?: FormaPago | null;
  /** Cuenta bancaria usada (solo formas de pago bancarias). */
  idCuentaBancaria?: number | null;
  cuentaBancaria?: CuentaBancariaEnRecibo | null;
  /** N° de comprobante / transacción del pago bancario. */
  nroComprobante?: string | null;
  /** Quién autorizó el recibo — obligatoria, debe salir de
   *  `GET /comercio_interno/persona_ci/autorizadas`. Fija desde que se crea
   *  el recibo (no se corrige al procesar un BORRADOR). */
  idPersonaAutorizo: string;
  personaAutorizo?: PersonaAutorizoEnRecibo | null;
  /** Timestamp completo de creación del recibo (distinto de `fecha`, que es
   *  la fecha contable). */
  fechaHoraGeneracion?: string;
  /** null hasta la primera vez que se imprime el recibo. */
  fechaPrimeraImpresion?: string | null;
  /** Contraparte física del recibo ("Recibí de" / "Entregué a"): exactamente
   *  una de persona registrada, actor productivo, cliente, o texto libre. */
  idPersona?: string | null;
  persona?: PersonaEnRecibo | null;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: ActorEnRecibo | null;
  idCliente?: string | null;
  cliente?: ClienteEnRecibo | null;
  /** Texto libre de la contraparte (dos personas, o alguien no registrado). */
  nombresApellidos?: string | null;
  detalles: DetalleRecibo[];
  /** Movimientos generados en la caja de flujo (0 a 2: INGRESO por lo aplicado a kardex, EGRESO por la porción en efectivo). */
  movimientosCaja: MovimientoCaja[];
  activo?: boolean;
  usuarioRegistro?: string | null;
  fechaRegistro?: string | null;
}

/** Contraparte del recibo: exactamente UNA de las cuatro. `idPersona`,
 *  `idActorProductivoMinero` e `idCliente` son mutuamente excluyentes; al
 *  menos una de las cuatro es obligatoria. */
export interface ContraparteReciboRequest {
  idPersona?: string;
  idActorProductivoMinero?: string;
  idCliente?: string;
  nombresApellidos?: string;
}

/** POST /contabilidad/recibo.
 *  - Sin `detalles`: crea el recibo en estado BORRADOR (solo cabecera).
 *  - Con `detalles`: one-shot — crea y procesa en la misma transacción
 *    (kardex + caja de flujo), queda PROCESADO directamente. */
export interface GenerarReciboRequest extends ContraparteReciboRequest {
  tipo: TipoRecibo;
  fecha: string;
  /** Monto total del recibo (lo que se imprime). Con `detalles`, debe ser
   *  igual a `sum(detalles[].monto)`. */
  montoTotal: number;
  /** Por defecto BS. En USD, `montoTotal` y `detalles[].monto` van en
   *  dólares; el kardex recibe el equivalente en Bs (monto × tipoCambio).
   *  Un anticipo de recepción (`idRecepcionMineral`) solo puede ser BS. */
  moneda?: MonedaCuenta;
  /** Bs por 1 USD, > 0 y hasta 4 decimales. Obligatorio solo en USD; en BS
   *  no se envía. */
  tipoCambio?: number;
  concepto: string;
  /** Obligatoria — debe salir de `GET /comercio_interno/persona_ci/autorizadas`. */
  idPersonaAutorizo: string;
  idFormaPago?: number;
  /** Vincula el recibo con el anticipo de una recepción de mineral. El back exige
   *  tipo EGRESO, monto == anticipo y que no haya otro recibo vigente (409). */
  idRecepcionMineral?: string;
  /** Vincula el recibo con el pago del saldo de una valorización VALORIZADA.
   *  El back exige EGRESO en Bs., monto == totalValorLiquidoVentaBolivianos
   *  y que no haya otro recibo vigente (409). */
  idValorizacionMineral?: string;
  /** Cobro de una venta de lote: INGRESO a nombre del cliente comprador;
   *  si ya está liquidada no puede superar lo que falta cobrar. */
  idVentaLote?: string;
  /** Obligatorio cuando la forma de pago es bancaria (QR, transferencia,
   *  cheque, depósito). */
  idCuentaBancaria?: number;
  /** N° de comprobante / transacción; obligatorio con forma de pago bancaria. */
  nroComprobante?: string;
  /** Si viene, el recibo se procesa en el acto (no pasa por BORRADOR).
   *  El destino del gasto va por línea, en `detalles[].idDestinoGasto`. */
  detalles?: DetalleReciboRequest[];
}

/** PATCH /contabilidad/recibo/:id/procesar — procesa un BORRADOR.
 *  La moneda y el tipo de cambio quedan fijos desde el borrador (no se
 *  envían); si se cambia la cuenta bancaria, debe ser de la misma moneda.
 *  `detalles` es obligatorio; el resto de campos son opcionales y sobrescriben
 *  lo que tuviera el borrador. NO permite corregir fecha, montoTotal, concepto
 *  ni la contraparte (quedan fijos desde que se creó el BORRADOR). */
export interface ProcesarReciboRequest {
  /** El destino del gasto va por línea, en `detalles[].idDestinoGasto`. */
  detalles: DetalleReciboRequest[];
  idFormaPago?: number;
  idCuentaBancaria?: number;
  nroComprobante?: string;
}

export type OrdenRecibo = 'id' | 'fecha' | 'monto' | 'numero';

/** GET /contabilidad/recibo — todos los parámetros son opcionales, salvo
 *  page/limit que tienen default (page=1, limit=10). */
export interface FiltrosRecibo {
  page?: number;
  limit?: number;
  tipo?: TipoRecibo;
  estado?: EstadoRecibo;
  idPersona?: string;
  idCliente?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  orderBy?: OrdenRecibo;
  orderDirection?: 'ASC' | 'DESC';
}

/** GET /contabilidad/recibo/reporte/excel — "Libro de recibos". Mismos
 *  filtros que la bandeja, todos opcionales; el back rechaza page, limit,
 *  orderBy y cualquier otro parámetro. */
export type FiltroLibroRecibos = Pick<
  FiltrosRecibo,
  'tipo' | 'estado' | 'idPersona' | 'fechaDesde' | 'fechaHasta' | 'busqueda'
>;

export interface RecibosPaginados {
  data: Recibo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
