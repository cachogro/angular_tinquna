// src/app/pages/contabilidad/models/reporte-plan-cuentas.models.ts
import { MonedaCuenta } from '../../configurations/parametricas/models/parametricas.models';

/** Filtros de GET /contabilidad/reportes/plan-cuentas[/:id]. Todos los
 *  opcionales salen del query string si no tienen valor. */
export interface FiltroReportePlanCuentas {
  moneda: MonedaCuenta;
  idCaja?: number;
  /** YYYY-MM-DD */
  fechaDesde?: string;
  /** YYYY-MM-DD */
  fechaHasta?: string;
}

export interface TotalesReporte {
  totalIngreso: number;
  totalEgreso: number;
  neto: number;
}

export interface FilaPlanCuentas extends TotalesReporte {
  /** null = "SIN PLAN DE CUENTAS" (no tiene detalle por id). */
  idPlanCuentas: number | null;
  nombre: string;
  esEgreso: boolean | null;
  cantidadMovimientos: number;
}

export interface ResumenCuentasPlan {
  totales: TotalesReporte;
  planCuentas: FilaPlanCuentas[];
}

export interface MovimientoReporteDestino {
  id: string;
  fecha: string;
  caja: string | null;
  concepto: string;
  entregaFondosA: string | null;
  facturaRecibo: string | null;
  nroComprobante: string | null;
  formaPago: string | null;
  ingreso: number;
  egreso: number;
}

export interface DetallePlanCuentas {
  planCuentas: { id: number; nombre: string; esEgreso: boolean };
  totales: TotalesReporte & { cantidadMovimientos: number };
  movimientos: MovimientoReporteDestino[];
}
