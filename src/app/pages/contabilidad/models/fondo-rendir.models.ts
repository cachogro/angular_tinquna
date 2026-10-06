// src/app/pages/contabilidad/models/fondo-rendir.models.ts
// Fondo a rendir cuentas: adelanto de dinero a una persona o actor
// productivo, que luego se justifica con comprobantes (líneas de detalle).
// El back devuelve los montos como number (a diferencia de recibo/traspaso,
// que los devuelven como string).
import {
  DestinoGasto,
  FormaPago,
} from '../../configurations/parametricas/models/parametricas.models';

export type EstadoFondoRendir =
  | 'PENDIENTE'
  | 'RENDIDO_PARCIAL'
  | 'RENDIDO_TOTAL'
  /** Justificado > entregado: la empresa le debe reponer la diferencia. */
  | 'RENDIDO_EN_EXCESO'
  | 'CERRADO_CON_DEUDA';

export interface PersonaEnFondoRendir {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
}

export interface ActorEnFondoRendir {
  id: string;
  nombre: string;
}

export interface ReciboEnFondoRendir {
  id: string;
  serie: string;
  numero: number;
  estado: string;
  /** Quién aprobó la entrega: snapshot jsonb guardado en el recibo al
   *  entregar el fondo. Solo viene en el detalle (GET /:id). */
  personaAutorizo?: {
    id: string;
    nombres: string;
    apellidoPaterno?: string | null;
    apellidoMaterno?: string | null;
  } | null;
}

export interface CuentaBancariaEnFondoRendir {
  id: number;
  numeroCuenta: string;
  alias?: string | null;
}

/** COMPROBANTE: gasto con respaldo cargado a mano. SIN_COMPROBANTE: el fondo
 *  se dio por rendido sin comprobantes (cubre el saldo que faltaba).
 *  SALDO_FAVOR: excedente de un fondo anterior del mismo destinatario que
 *  entra como ya justificado. Las dos últimas las genera el back: no se
 *  editan, y la de SALDO_FAVOR tampoco se anula. */
export type TipoDetalleFondoRendir =
  | 'COMPROBANTE'
  | 'SIN_COMPROBANTE'
  | 'SALDO_FAVOR';

export interface DetalleFondoRendir {
  id: string;
  idFondoRendir: string | number;
  fecha: string;
  concepto: string;
  monto: number;
  nroComprobante?: string | null;
  facturaRecibo?: string | null;
  idDestinoGasto?: number | null;
  destinoGasto?: DestinoGasto | null;
  tipo?: TipoDetalleFondoRendir;
  /** Solo en SALDO_FAVOR: fondo del que viene el excedente. */
  idFondoOrigen?: string | null;
  activo: boolean;
}

export interface FondoRendirCuentas {
  id: string;
  idPersona?: string | null;
  persona?: PersonaEnFondoRendir | null;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: ActorEnFondoRendir | null;
  fecha: string;
  concepto: string;
  montoEntregado: number;
  idFormaPago?: number | null;
  formaPago?: FormaPago | null;
  idCuentaBancaria?: number | null;
  cuentaBancaria?: CuentaBancariaEnFondoRendir | null;
  nroComprobante?: string | null;
  /** Recibo generado al entregar el fondo. */
  idRecibo?: string | null;
  recibo?: ReciboEnFondoRendir | null;
  idDestinoGasto?: number | null;
  destinoGasto?: DestinoGasto | null;
  idPersonaAutorizo: string;
  personaAutorizo?: PersonaEnFondoRendir | null;
  /** "YYYY-MM-DD" — solo informativo. */
  fechaLimite?: string | null;
  estado: EstadoFondoRendir;
  /** Presente cuando se cerró con deuda: movimiento generado en el kardex
   *  del destinatario por el saldo pendiente. */
  idMovimientoKardexCierre?: string | null;
  /** Excedente ya devuelto al destinatario con un recibo de egreso. */
  montoRepuesto?: number | string;
  idReciboReposicion?: string | null;
  reciboReposicion?: ReciboEnFondoRendir | null;
  /** "YYYY-MM-DD" */
  fechaReposicion?: string | null;
  /** Excedente que no se devolvió y se aplicó como ya justificado en un
   *  fondo posterior (`idFondoCompensacion`). */
  montoCompensado?: number | string;
  idFondoCompensacion?: string | null;
  /** Solo en el detalle (GET /:id), con el fondo PENDIENTE o RENDIDO_PARCIAL:
   *  lo que el destinatario tiene a favor en otros fondos y se puede aplicar
   *  a este. */
  saldoFavorDisponible?: number;
  activo: boolean;
  /** Usuario (login) que entregó el fondo. */
  usuarioRegistro?: string | null;
  montoJustificado: number;
  /** > 0 solo si el destinatario todavía debe rendir cuentas. Excluyente
   *  con `montoPorReponer`. */
  saldoPendiente: number;
  /** > 0 solo si se justificó de más: lo que la empresa le debe reponer al
   *  destinatario. Excluyente con `saldoPendiente`. */
  montoPorReponer: number;
  /** Solo viene en el detalle (GET /:id), no en el listado. */
  detalles?: DetalleFondoRendir[];
}

/** POST /contabilidad/fondo-rendir — entrega el fondo (siempre crea; no hay
 *  edición de la cabecera). `idPersona`/`idActorProductivoMinero` son
 *  mutuamente excluyentes, uno de los dos es obligatorio. */
export interface EntregarFondoRendirRequest {
  idPersona?: string;
  idActorProductivoMinero?: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  concepto: string;
  /** > 0 */
  monto: number;
  idFormaPago?: number;
  /** Junto con `nroComprobante`: se entrega por banco. Sin esto, sale de
   *  caja en efectivo. */
  idCuentaBancaria?: number;
  nroComprobante?: string;
  idDestinoGasto?: number;
  idPersonaAutorizo: string;
  /** "YYYY-MM-DD" — solo informativo. */
  fechaLimite?: string;
}

/** POST /contabilidad/fondo-rendir/detalle — sin `id` agrega una línea de
 *  justificación, con `id` la actualiza. Devuelve el fondo completo. */
export interface GuardarDetalleFondoRendirRequest {
  id?: string | number;
  idFondoRendir: string | number;
  /** "YYYY-MM-DD" */
  fecha: string;
  concepto: string;
  /** > 0. Puede superar `montoEntregado`: el excedente queda como
   *  `montoPorReponer` (estado RENDIDO_EN_EXCESO). */
  monto: number;
  nroComprobante?: string;
  facturaRecibo?: string;
  idDestinoGasto?: number;
}

/** POST /contabilidad/fondo-rendir/:id/reponer — devuelve al destinatario el
 *  excedente con un recibo de EGRESO (caja en efectivo o libreta bancaria).
 *  El monto no se envía: siempre es todo `montoPorReponer`. */
export interface ReponerFondoRendirRequest {
  /** "YYYY-MM-DD" */
  fecha: string;
  idFormaPago?: number;
  idCuentaBancaria?: number;
  nroComprobante?: string;
  /** Si se omite, el back usa el de la cabecera del fondo. */
  idDestinoGasto?: number;
  idPersonaAutorizo: string;
}

/** GET /contabilidad/fondo-rendir/saldo-favor — lo que la empresa aún le
 *  debe reponer al destinatario; al entregarle un fondo nuevo entra solo
 *  como ya justificado. */
export interface SaldoFavorFondoRendir {
  saldoFavor: number;
  fondos: {
    id: string;
    fecha: string;
    concepto: string;
    montoPorReponer: number;
  }[];
}

export interface FiltroFondoRendirRequest {
  idPersona?: string;
  idActorProductivoMinero?: string;
  estado?: EstadoFondoRendir;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}

/** GET /contabilidad/fondo-rendir/excel — `idPersona` e
 *  `idActorProductivoMinero` son excluyentes, uno es obligatorio. */
export interface ExcelFondoRendirRequest {
  idPersona?: string;
  idActorProductivoMinero?: string;
  gestion: number;
  /** 1–12. Sin mes → reporte anual. */
  mes?: number;
}

export interface FondosRendirPaginados {
  data: FondoRendirCuentas[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
