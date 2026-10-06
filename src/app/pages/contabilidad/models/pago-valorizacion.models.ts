// src/app/pages/contabilidad/models/pago-valorizacion.models.ts
// Pago del líquido pagable de una valorización: transacción interna, SIN
// recibo (el respaldo es el PDF de la valorización firmado). Lo que se paga
// sale de la caja de flujo o de la libreta bancaria y no toca ningún kardex;
// lo que el proveedor deja a kardex, y los anticipos que la valorización ya
// le descontó, se anotan como HABER. Los montos vienen como string.
import {
  DestinoGasto,
  FormaPago,
} from '../../configurations/parametricas/models/parametricas.models';
import { TipoKardex } from './kardex.models';
import { DatosPagoRequest } from './prestamo-personal.models';

/** Dueño de un kardex abierto: persona (PERSONAL o ASOCIADO), actor o cliente. */
export type DestinoKardexPago = 'PERSONAL' | 'ACTOR' | 'CLIENTE';

export interface KardexDestinoRequest {
  destino: DestinoKardexPago;
  idPersona?: string;
  idActorProductivoMinero?: string;
  idCliente?: string;
}

/** Parte del líquido pagable que se deja a un kardex (HABER). */
export interface AbonoKardexRequest extends KardexDestinoRequest {
  /** > 0, hasta 2 decimales. */
  monto: number;
}

/** POST /contabilidad/pago-valorizacion */
export interface RegistrarPagoValorizacionRequest extends DatosPagoRequest {
  idValorizacionMineral: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** La suma no puede superar el líquido; el resto es lo que se paga. */
  abonos?: AbonoKardexRequest[];
  /** Obligatorio si la valorización tiene "otros anticipos". */
  kardexOtrosAnticipos?: KardexDestinoRequest;
}

/** Kardex tal como lo resume el back en el pago. */
export interface KardexEnPago {
  idKardex: string;
  codigo: string;
  tipo: TipoKardex;
  nombre: string;
  idPersona: string | null;
  idActorProductivoMinero: string | null;
  idCliente: string | null;
}

export type ConceptoPagoValorizacion = 'ABONO' | 'ANTICIPO' | 'OTROS_ANTICIPOS';
export type EstadoPagoValorizacion = 'REGISTRADO' | 'ANULADO';

export interface PagoValorizacionDetalle {
  id: string;
  concepto: ConceptoPagoValorizacion;
  idKardex: string;
  monto: string;
  kardex?: {
    id: string;
    codigo: string;
    tipo: TipoKardex;
    persona?: { nombres: string; apellidoPaterno?: string | null; apellidoMaterno?: string | null } | null;
    actorProductivoMinero?: { nombre: string } | null;
    cliente?: { nombre: string } | null;
  } | null;
}

export interface PagoValorizacion {
  id: string;
  idValorizacionMineral: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  montoLiquido: string;
  montoAbonoKardex: string;
  /** Lo que salió de caja o de la libreta. */
  montoPagado: string;
  idFormaPago?: number | null;
  formaPago?: FormaPago | null;
  idCuentaBancaria?: number | null;
  cuentaBancaria?: {
    id: number;
    numeroCuenta: string;
    entidadFinanciera?: { nombre: string; sigla?: string | null } | null;
  } | null;
  nroComprobante?: string | null;
  destinoGasto?: DestinoGasto | null;
  personaAutorizo?: {
    id: string;
    nombres: string;
    apellidoPaterno: string | null;
    apellidoMaterno: string | null;
  } | null;
  estado: EstadoPagoValorizacion;
  detalles?: PagoValorizacionDetalle[];
}

/** GET /contabilidad/pago-valorizacion/preparar/:idValorizacion */
export interface PrepararPagoValorizacion {
  idValorizacionMineral: string;
  codigoOperacion: string;
  valorizada: boolean;
  proveedor: {
    idPersona: string | null;
    idActorProductivoMinero: string | null;
    nombre: string;
  };
  /** Puede ser negativo si los anticipos superan lo que vale el mineral. */
  liquidoPagable: number;
  /** max(líquido, 0): de acá salen los abonos a kardex y lo que se paga. */
  montoAPagar: number;
  /** Anticipo de la recepción que la valorización descontó. */
  anticipo: number;
  otrosAnticipos: number;
  /** HABER automático que cancela el anticipo, por kardex. */
  anticipoEnKardex: (KardexEnPago & { monto: number })[];
  /** Parte del anticipo que no está cargada en ningún kardex. */
  anticipoSinKardex: number;
  pagoVigente: PagoValorizacion | null;
}
