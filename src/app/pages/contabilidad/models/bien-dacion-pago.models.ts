// src/app/pages/contabilidad/models/bien-dacion-pago.models.ts
// Bienes recibidos en dación de pago (vehículos, maquinaria, etc.) de un
// actor productivo o de una persona a cuenta de su deuda de anticipos.
// Ciclo: EN_POSESION → VENDIDO | DEVUELTO (sin vuelta atrás, sin edición).
// El back exige que el destinatario tenga kardex ABIERTO para registrar y
// para vender (la venta amortiza su deuda con un recibo de INGRESO).
import { DatosPagoRequest } from './prestamo-personal.models';

export type EstadoBienDacion = 'EN_POSESION' | 'VENDIDO' | 'DEVUELTO';

export interface BienDacionPago {
  id: string;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: { id: string; nombre: string } | null;
  idPersona?: string | null;
  persona?: {
    id: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno?: string | null;
  } | null;
  /** "YYYY-MM-DD" */
  fechaRecepcion: string;
  descripcion: string;
  /** Avalúo aproximado (Bs). Puede venir como string decimal. */
  valorReferencial?: number | string | null;
  estado: EstadoBienDacion;
  fechaVenta?: string | null;
  montoVenta?: number | string | null;
  fechaDevolucion?: string | null;
  observaciones?: string | null;
  activo?: boolean;
  /** Recibo de INGRESO generado al vender (amortiza la deuda en el kardex y
   *  entra a caja/banco). null en los vendidos antes de este cambio. */
  idRecibo?: string | null;
  recibo?: { id: string; serie: string; numero: number; estado: string } | null;
  idMovimientoKardex?: string | null;
}

/** POST /contabilidad/bien-dacion-pago — idPersona e idActorProductivoMinero
 *  son excluyentes (uno de los dos, obligatorio). */
export interface RegistrarBienDacionRequest {
  idPersona?: string;
  idActorProductivoMinero?: string;
  fechaRecepcion: string;
  descripcion: string;
  valorReferencial?: number;
  observaciones?: string;
}

/** POST /:id/vender — observaciones opcional (si no va, se conserva). Lleva
 *  los datos del recibo de INGRESO que se genera: el monto amortiza la deuda
 *  del dueño (HABER en su kardex) y entra a la caja de flujo, o a la libreta
 *  si se cobró por banco. */
export interface VenderBienDacionRequest extends DatosPagoRequest {
  fechaVenta: string;
  montoVenta: number;
  observaciones?: string;
}

/** POST /:id/devolver — observaciones obligatorio: es el motivo. */
export interface DevolverBienDacionRequest {
  fechaDevolucion: string;
  observaciones: string;
}

export interface FiltrosBienDacion {
  idPersona?: string;
  idActorProductivoMinero?: string;
  estado?: EstadoBienDacion;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}

export interface BienDacionPaginado {
  data: BienDacionPago[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
