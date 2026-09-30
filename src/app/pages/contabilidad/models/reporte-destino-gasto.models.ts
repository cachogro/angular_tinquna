// src/app/pages/contabilidad/models/reporte-destino-gasto.models.ts
import { MonedaCuenta } from '../../configurations/parametricas/models/parametricas.models';

/** Filtros de GET /contabilidad/reportes/destino-gasto[/:id]. Todos los
 *  opcionales salen del query string si no tienen valor. */
export interface FiltroReporteDestinoGasto {
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

export interface FilaDestinoGasto extends TotalesReporte {
  /** null = "SIN DESTINO" (no tiene detalle por id). */
  idDestinoGasto: number | null;
  nombre: string;
  esEgreso: boolean | null;
  cantidadMovimientos: number;
}

export interface ResumenDestinosGasto {
  totales: TotalesReporte;
  destinos: FilaDestinoGasto[];
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

export interface DetalleDestinoGasto {
  destino: { id: number; nombre: string; esEgreso: boolean };
  totales: TotalesReporte & { cantidadMovimientos: number };
  movimientos: MovimientoReporteDestino[];
}
