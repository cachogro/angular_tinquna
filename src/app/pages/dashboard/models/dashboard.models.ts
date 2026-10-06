// Respuesta de GET /dashboard/resumen (un solo llamado con todo el inicio).

export interface RangoDashboard {
  desde: string;
  hasta: string;
}

export interface MineralRecibido {
  lotes: number;
  sacos: number;
  kgNeto: number;
  anticiposBs: number;
  proveedores: number;
}

export interface Valorizado {
  cantidad: number;
  /** "Total Liquidación" (VBV − aportes). */
  totalLiquidacionBs: number;
  liquidoPagableBs: number;
  kgNetoSeco: number;
}

export interface MontoCantidad {
  cantidad: number;
  montoBs: number;
}

export interface SaldoCuenta {
  id: number | string;
  nombre: string;
  numeroCuenta?: string;
  moneda: 'BS' | 'USD';
  saldo: number;
}

export interface Liquidez {
  cajaBs: number;
  cajaUsd: number;
  bancosBs: number;
  bancosUsd: number;
  cajas: SaldoCuenta[];
  bancos: SaldoCuenta[];
}

export interface TotalesKardex {
  porCobrarBs: number;
  deudores: number;
  porPagarBs: number;
  acreedores: number;
}

export interface PendienteConAntiguedad {
  cantidad: number;
  diasMax: number | null;
}

export interface LotesEnProceso {
  sinValorizar: PendienteConAntiguedad & { kg: number };
  borradores: PendienteConAntiguedad;
  preValorizados: PendienteConAntiguedad;
  cicloPromedioDias: number | null;
}

export interface TopProveedor {
  idPersona: string;
  nombre: string;
  lotes: number;
  kg: number;
  anticiposBs: number;
  valorizadoBs: number;
}

export interface TopCliente {
  idCliente: string;
  nombre: string;
  lotes: number;
  montoVentaBs: number;
  invertidoBs: number;
  ventasAbiertas: number;
}

export interface IngresoMensual {
  /** "YYYY-MM", 12 meses hasta el mes del período. */
  meses: string[];
  series: { codigo: string; kg: number[] }[];
}

export type TipoKardexDashboard = 'ACTOR' | 'ASOCIADO' | 'PERSONAL' | 'CLIENTE';

export interface Deudor {
  idKardex: string;
  /** Código del kardex, ej. "KA-001". */
  codigoKardex: string;
  tipo: TipoKardexDashboard;
  nombre: string;
  idPersona: string | null;
  idActorProductivoMinero: string | null;
  idCliente: string | null;
  saldoBs: number;
  ultimaActividad: string | null;
  diasSinActividad: number | null;
  activo: boolean;
}

export interface Cobranzas {
  ventasPorCobrar: {
    cantidad: number;
    totalBs: number;
    lista: {
      idVentaLote: string;
      codigoLote: string | null;
      cliente: string;
      fechaLiquidacion: string | null;
      porCobrarBs: number;
    }[];
  };
  ventasAbiertas: { cantidad: number; invertidoBs: number };
  anticiposSinValorizar: MontoCantidad;
  prestamosPersonal: { cantidad: number; saldoBs: number };
  bienesDacion: { cantidad: number; valorBs: number };
  fondosRendir: { cantidad: number; vencidos: number; porRendirBs: number };
}

export interface CotizacionVigente {
  idMineral: string;
  mineral: string;
  simbolo: string;
  unidad: string;
  cotizacionUsd: number | null;
  vigenteHasta: string | null;
}

export interface AlertaDashboard {
  nivel: 'alta' | 'media' | 'info';
  modulo: 'comercio' | 'contabilidad' | 'configuracion';
  titulo: string;
  detalle: string;
  cantidad: number;
  ruta: string;
}

export interface ResumenDashboard {
  periodo: RangoDashboard;
  periodoAnterior: RangoDashboard;
  indicadores: {
    mineralRecibido: MineralRecibido & { anterior: MineralRecibido };
    valorizado: Valorizado & { anterior: Valorizado };
    pagadoValorizaciones: MontoCantidad & { anterior: MontoCantidad };
    cobradoVentas: MontoCantidad;
    liquidez: Liquidez;
    kardex: TotalesKardex;
  };
  enProceso: LotesEnProceso;
  topProveedores: TopProveedor[];
  topClientes: TopCliente[];
  ingresoMensual: IngresoMensual;
  deudores: { total: number; inactivos: number; totalBs: number; lista: Deudor[] };
  cobranzas: Cobranzas;
  cotizaciones: CotizacionVigente[];
  alertas: AlertaDashboard[];
}

// ---------------------------------------------------------------------------
// Respuesta de GET /dashboard/flujo-dinero (dinero que entró y salió).
// ---------------------------------------------------------------------------

export interface IngresoEgreso {
  ingreso: number;
  egreso: number;
}

/** Efectivo = caja de flujo; bancos = todas las cuentas de esa moneda. */
export interface FlujoDinero {
  efectivoBs: IngresoEgreso;
  efectivoUsd: IngresoEgreso;
  bancosBs: IngresoEgreso;
  bancosUsd: IngresoEgreso;
  /** Todo llevado a Bs (los $us, con el tipo de cambio de su movimiento). */
  ingresoBs: number;
  egresoBs: number;
  netoBs: number;
  /** $us sin tipo de cambio: NO están en los totales en Bs. */
  usdSinTipoCambio: IngresoEgreso;
  movimientos: number;
}

export interface FlujoPorDestino {
  idDestinoGasto: number | null;
  nombre: string;
  /** Categoría del destino, o 'SIN_DESTINO'. */
  categoria: string;
  ingresoBs: number;
  egresoBs: number;
  movimientos: number;
}

export interface FlujoPorCategoria {
  categoria: string;
  ingresoBs: number;
  egresoBs: number;
  movimientos: number;
}

/** Utilidad de lotes liquidados + otros ingresos − gastos operativos − sueldos. */
export interface GananciaEstimada {
  lotesLiquidados: number;
  ventaLotesBs: number;
  invertidoLotesBs: number;
  utilidadLotesBs: number;
  otrosIngresosBs: number;
  gastosOperativosBs: number;
  sueldosBs: number;
  gananciaEstimadaBs: number;
  /** Movimientos sin destino de gasto: no se pudieron clasificar. */
  sinDestino: { ingresoBs: number; egresoBs: number };
}

export interface ResumenFlujoDinero {
  periodo: RangoDashboard;
  /** Fecha de hoy según el servidor (Bolivia). */
  hoy: string;
  totales: FlujoDinero;
  /** Siempre el día de hoy, esté o no dentro del período. */
  hoyFlujo: FlujoDinero;
  /** Un renglón por día con movimientos, del más reciente al más antiguo. */
  dias: Array<FlujoDinero & { fecha: string }>;
  categorias: FlujoPorCategoria[];
  mayoresEgresos: FlujoPorDestino[];
  mayoresIngresos: FlujoPorDestino[];
  /** Traspasos caja <-> banco del período: no cuentan como ingreso ni egreso. */
  traspasosExcluidos: number;
  ganancia: GananciaEstimada;
}
