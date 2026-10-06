// src/app/pages/contabilidad/models/traspaso.models.ts
// Traspaso interno caja de flujo <-> libreta bancaria: en una sola
// transacción genera un movimiento en movimiento_caja y otro en
// libreta_banco, enlazados entre sí. El back devuelve los montos como
// string ("1000.00").
import {
  DestinoGasto,
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { MovimientoCaja } from './movimiento-caja.models';
import { MovimientoBanco } from './libreta-banco.models';

/** DEPOSITO = sale de caja y entra al banco. RETIRO = sale del banco y entra a caja. */
export type TipoTraspaso = 'DEPOSITO' | 'RETIRO';

export interface CajaEnTraspaso {
  id: number;
  nombre: string;
}

export interface EntidadFinancieraEnTraspaso {
  nombre: string;
  sigla?: string | null;
}

export interface CuentaBancariaEnTraspaso {
  id: number;
  numeroCuenta: string;
  alias?: string | null;
  entidadFinanciera?: EntidadFinancieraEnTraspaso | null;
}

/** Datos del autorizador congelados al registrar el traspaso (jsonb): si
 *  después se edita a la persona, el traspaso sigue mostrando el nombre de
 *  ese día. Los traspasos anteriores a la migración 069 traen null. */
export interface PersonaAutorizoEnTraspaso {
  id: string;
  nombres: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
}

export interface Traspaso {
  id: string;
  tipo: TipoTraspaso;
  fecha: string;
  idCaja: number;
  caja?: CajaEnTraspaso | null;
  /** Derivada de la cuenta bancaria elegida (BS o USD). */
  moneda: MonedaCuenta;
  /** Bs por 1 USD; null en BS y en los traspasos en USD anteriores a la 084.
   *  Solo referencial: caja y banco se mueven en la moneda de la cuenta. */
  tipoCambio?: string | number | null;
  idCuentaBancaria: number;
  cuentaBancaria?: CuentaBancariaEnTraspaso | null;
  nroComprobante?: string | null;
  /** DEPOSITO exige un destino con `esEgreso: true`; RETIRO con `esEgreso: false`.
   *  Se refleja en el movimiento de caja generado (la libreta bancaria no
   *  tiene esta columna, igual que en recibos). */
  idDestinoGasto?: number | null;
  destinoGasto?: DestinoGasto | null;
  concepto: string;
  monto: string;
  /** Quién autorizó el traspaso; null en los registrados antes de la 069. */
  personaAutorizo?: PersonaAutorizoEnTraspaso | null;
  activo: boolean;
  movimientosCaja: MovimientoCaja[];
  movimientosBanco: MovimientoBanco[];
  usuarioRegistro?: string | null;
  fechaRegistro?: string | null;
}

/** POST /contabilidad/traspaso — sin `id` crea, con `id` edita. En edición
 *  no se puede cambiar `tipo` ni `idCuentaBancaria`. Sin `idCaja`: el back
 *  usa siempre la Caja id=1 ("CAJA PRINCIPAL"); mandarlo tira 400. */
export interface GuardarTraspasoRequest {
  id?: string | number;
  /** "YYYY-MM-DD" */
  fecha: string;
  idCuentaBancaria: number;
  tipo: TipoTraspaso;
  nroComprobante?: string;
  /** Opcional. En edición, si se omite se limpia el que tenía antes —
   *  hay que reenviarlo si se quiere conservar. */
  idDestinoGasto?: number;
  concepto: string;
  /** > 0, hasta 2 decimales. */
  monto: number;
  /** Bs por 1 USD (> 0, hasta 4 decimales). Obligatorio si la cuenta
   *  bancaria es en USD, también al editar; en BS no se envía. */
  tipoCambio?: number;
  /** Debe salir de `GET /comercio_interno/persona_ci/autorizadas` (existe,
   *  activa y autorizada). En edición, si llega el mismo id el back conserva
   *  los datos originales; con otro id guarda los del nuevo autorizador. */
  idPersonaAutorizo: string;
}

export type OrdenTraspaso = 'fecha' | 'id' | 'monto';

/** GET /contabilidad/traspaso — paginado; sin page/limit el back usa
 *  page=1, limit=10. `busqueda` busca en concepto, N° de comprobante y
 *  nombres de quien autorizó. */
export interface FiltroTraspasoRequest {
  page?: number;
  limit?: number;
  idCaja?: number;
  idCuentaBancaria?: number;
  tipo?: TipoTraspaso;
  gestion?: number;
  busqueda?: string;
  orderBy?: OrdenTraspaso;
  orderDirection?: 'ASC' | 'DESC';
}

export interface TraspasosPaginados {
  data: Traspaso[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** GET /contabilidad/traspaso/reporte/excel — "Libro de traspasos". Todos
 *  opcionales; no acepta idCaja ni gestion (la gestión va como rango de fechas). */
export interface FiltroLibroTraspasos {
  idCuentaBancaria?: number;
  tipo?: TipoTraspaso;
  moneda?: MonedaCuenta;
  /** ACTIVO = vigentes, INACTIVO = desactivados; sin valor salen todos. */
  estado?: 'ACTIVO' | 'INACTIVO';
  fechaDesde?: string;
  fechaHasta?: string;
  /** Busca en el concepto o el N° de comprobante. */
  busqueda?: string;
}
