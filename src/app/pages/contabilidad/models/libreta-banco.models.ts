// src/app/pages/contabilidad/models/libreta-banco.models.ts
// Libreta de bancos: el mayor de cada cuenta bancaria de la empresa.
// El back devuelve los montos como string ("3300.00").

export type TipoMovimientoBanco = 'DEBE' | 'HABER';
export type EstadoPeriodoBanco = 'ABIERTO' | 'CERRADO';
export type TipoPeriodoBanco = 'MENSUAL' | 'GESTION';

export interface PeriodoBanco {
  id: string;
  idCuentaBancaria: number;
  tipo: TipoPeriodoBanco;
  gestion: number;
  /** 1-12 en MENSUAL; null en GESTION (fila de cierre anual). */
  mes: number | null;
  estado: EstadoPeriodoBanco;
  saldoInicial: string;
  totalDebe: string;
  totalHaber: string;
  /** Se fija al cerrar. */
  saldoFinal: string | null;
  fechaCierre: string | null;
  cerradoPor: string | null;
}

/** Persona CI vinculada a un movimiento (subset que devuelve el back). */
export interface PersonaMovimientoRef {
  id: string | number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  numeroDocumento?: string | null;
}

export interface MovimientoBanco {
  id: string;
  idCuentaBancaria: number;
  idPeriodoBanco: string;
  periodoBanco?: PeriodoBanco;
  folio: number;
  fecha: string;
  nroTransaccion?: string | null;
  /** Texto libre (no valida contra catálogo en el back); el front reutiliza
   *  el mismo listado de "Forma de pago" que ya usa Recibos (QR,
   *  TRANSFERENCIA, CHEQUE, DEPOSITO, EFECTIVO). */
  tipoTransaccion: string;
  /** "FACTURA Y/O RECIBO": texto libre (máx. 30); en los movimientos que
   *  nacen de un recibo trae su código (ej. "R-0009"). */
  facturaRecibo?: string | null;
  /** Beneficiario / contraparte. Si hay persona vinculada, el back lo deriva de ella. */
  nombresApellidos?: string | null;
  /** Persona CI vinculada (null = texto libre). */
  idPersona?: string | null;
  persona?: PersonaMovimientoRef | null;
  /** Actor productivo o cliente vinculado (excluyentes con persona). */
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: { id: string; nombre: string } | null;
  idCliente?: string | null;
  cliente?: { id: string; nombre: string } | null;
  /** Usuario (login) que registró el movimiento. */
  usuarioRegistro?: string | null;
  /** Presente cuando el movimiento nace de un traspaso caja↔banco. */
  idTraspaso?: string | null;
  concepto: string;
  /** "DEBE" = egreso/salida. */
  debe: string;
  /** "HABER" = ingreso/entrada. */
  haber: string;
  /** Saldo corriente tras el movimiento. */
  saldo: string;
  /** Bs por 1 USD, solo en cuentas en USD. Referencial (debe/haber/saldo van
   *  en la moneda de la cuenta); null en Bs y en movimientos anteriores a la
   *  086 o generados por un recibo / línea de kardex. */
  tipoCambio?: string | number | null;
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion?: string | null;
}

/** GET /contabilidad/libreta-banco/detalle/:id — movimiento completo para
 *  el visor. La bandeja trae solo lo que muestra la tabla. */
export interface MovimientoBancoDetalle extends MovimientoBanco {
  facturaRecibo?: string | null;
  idDestinoGasto?: number | null;
  destinoGasto?: { id: number; nombre: string } | null;
  cuentaBancaria?: {
    id: number;
    numeroCuenta: string;
    moneda: string;
    alias?: string | null;
    entidadFinanciera?: { nombre: string; sigla?: string | null } | null;
  } | null;
  idRecibo?: string | null;
  recibo?: {
    id: string;
    serie: string;
    numero: number;
    tipo: 'INGRESO' | 'EGRESO';
    estado: string;
  } | null;
  traspaso?: { id: string; tipo: 'DEPOSITO' | 'RETIRO'; concepto: string } | null;
  idMovimientoKardex?: string | null;
  movimientoKardex?: {
    id: string;
    numeroLinea: number;
    kardex?: {
      id: string;
      numero: number;
      tipo: string;
      gestion: number;
      persona?: PersonaMovimientoRef | null;
      actorProductivoMinero?: { id: number; nombre: string } | null;
      cliente?: { id: number | string; nombre: string } | null;
    } | null;
  } | null;
  usuarioRegistro?: string | null;
  fechaRegistro?: string | null;
}

export interface CuentaLibreta {
  id: number;
  numeroCuenta: string;
  moneda: string;
  saldoInicial: string;
  fechaSaldoInicial: string | null;
}

/** Respuesta de GET /contabilidad/libreta-banco */
export interface LibretaBancoResponse {
  cuenta: CuentaLibreta;
  periodos: PeriodoBanco[];
  movimientos: MovimientoBanco[];
}

/** POST /contabilidad/libreta-banco — sin `id` crea, con `id` edita. */
export interface GuardarMovimientoBancoRequest {
  id?: string | number;
  idCuentaBancaria: number;
  /** "YYYY-MM-DD" — define el mes/gestión del movimiento. */
  fecha: string;
  nroTransaccion?: string;
  /** N° de factura o recibo (texto libre, máx. 30). */
  facturaRecibo?: string;
  /** Texto libre, mismo catálogo de "Forma de pago" que Recibos. */
  tipoTransaccion: string;
  /** Contraparte: UNA de persona CI, actor productivo o cliente; sin
   *  ninguna = texto libre en `nombresApellidos`. */
  idPersona?: string | number | null;
  idActorProductivoMinero?: string | null;
  idCliente?: string | null;
  /** Texto del beneficiario. Con `idPersona` y sin esto, el back lo deriva de la persona. */
  nombresApellidos?: string;
  concepto: string;
  tipo: TipoMovimientoBanco;
  /** > 0, hasta 2 decimales. En la moneda de la cuenta. */
  monto: number;
  /** Bs por 1 USD (> 0, hasta 4 decimales). Obligatorio si la cuenta es en
   *  USD, también al editar; en Bs no se envía. */
  tipoCambio?: number;
}

/** Body de cerrar/reabrir mes. Para gestión se omite `mes`. */
export interface PeriodoBancoAccionRequest {
  idCuentaBancaria: number;
  gestion: number;
  mes?: number;
}
