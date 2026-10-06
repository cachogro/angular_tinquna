// src/app/pages/ui-components/models/registro-mineral.models.ts
import { ActorProductivoMinero } from 'src/app/pages/configurations/models/persona.models';
import { formatNumeroConMiles } from 'src/app/shared/utils/numero.util';

export interface MineralResumen {
  id: number | string;
  descripcion: string;
  simbolo?: string;
  unidadCotizacion?: string;
  detalleMineral?: string;
  factorConversion?: number;
  tipo?: string;
}

export interface CodificacionCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  /** Minerales que integran esta codificación (ej. BZL -> Zinc, Plata) */
  minerales: MineralResumen[];
}

export interface EstadoOperacion {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

/** Catálogo fijo (dado que rara vez cambia). Si luego tienes un endpoint,
 *  reemplaza el uso de esta constante por una llamada al servicio. */
export const ESTADOS_OPERACION: EstadoOperacion[] = [
  { id: 1, nombre: 'EN RECEPCIÓN' },
  { id: 2, nombre: 'APROBADO' },
  { id: 3, nombre: 'RECHAZADO A TOL' },
  { id: 4, nombre: 'CANCELADO' },
  { id: 5, nombre: 'TRANZADO' },
  { id: 6, nombre: 'REMUESTREO' },
];

export const ESTADO_CANCELADO_ID = 4;
export const ESTADO_TRANZADO_ID = 5;
export const ESTADO_LIQUIDADO_ID = 7;

/** Estados con comprobante RM- para imprimir: se emite desde que el proveedor
 *  deja el mineral (EN RECEPCIÓN, APROBADO, RECHAZADO A TOL, TRANZADO y
 *  REMUESTREO); una recepción cancelada no lo tiene. */
const ESTADOS_CON_COMPROBANTE = new Set([1, 2, 3, 5, 6]);

export function recepcionImprimible(idEstado: number): boolean {
  return ESTADOS_CON_COMPROBANTE.has(idEstado);
}

export interface PersonaResumen {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroDocumento: string;
  celular?: string;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: ActorProductivoMinero | null;
}

export type LeyUnidad = '%' | 'g/TM';

export interface DetalleMineralRegistro {
  id?: string;
  idRecepcionMineral?: string;
  idMineral: string;
  mineral?: MineralResumen;
  ley: number | string;
  leyUnidad: LeyUnidad;
}

/** Recibo de anticipo vinculado a la recepción (subset que devuelve el back). */
export interface ReciboAnticipoResumen {
  id: string;
  serie?: string;
  numero?: number;
  estado: 'BORRADOR' | 'PROCESADO' | 'ANULADO';
  montoTotal?: string;
}

/** Laboratorio tal como viene anidado en la recepción. */
export interface LaboratorioResumen {
  id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
}

export interface RegistroMineral {
  activo: boolean;
  usuarioUltimaModificacion?: string | null;
  fechaUltimaModificacion: string | null;
  id: string;
  correlativo: string;
  codigoOperacion: string;
  idCodificacion: string;
  codificacion?: CodificacionCatalogo;
  /** Proveedor: persona registrada, actor productivo o externo (solo
   *  `nombresApellidos`). A lo sumo uno de los dos ids; a qué kardex va el
   *  dinero se decide al procesar el recibo. */
  idPersona?: string | null;
  persona?: PersonaResumen | null;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: ActorProductivoMinero | null;
  /** Nombre del proveedor tal como se registró (null en recepciones viejas). */
  nombresApellidos?: string | null;
  numeroSacos: number | null;
  balanzaL: string; // el backend lo devuelve como string numérico
  balanzaT: string;
  anticipo: string;
  /** Recibos de anticipo vinculados: el back devuelve solo el vigente
   *  (BORRADOR o PROCESADO). Vacío + anticipo > 0 = falta generar el recibo. */
  recibos?: ReciboAnticipoResumen[];
  humedad?: string | number | null;
  idPersonalInterno?: string | null;
  personalInterno?: PersonaResumen | null;
  /** Texto libre (hasta 100); vacío en recepciones anteriores */
  lugarAcopio?: string | null;
  /** Laboratorio al que va la muestra (opcional). La valorización lo copia
   *  al crearse; cambiarlo después allá no modifica el de la recepción. */
  idLaboratorio?: string | null;
  laboratorio?: LaboratorioResumen | null;
  /** @deprecated el backend ya no gestiona este campo */
  totalValorBruto?: string;
  fechaRecepcion: string; // ISO 8601 con offset, ej. '2026-07-22T14:35:00-04:00'
  observaciones?: string | null;
  idEstado: number;
  estado?: EstadoOperacion;
  /** Una fila por cada mineral que integra la codificación, con su ley individual */
  detalles: DetalleMineralRegistro[];
}

/** Datos del proveedor que trae una recepción (también anidada en la valorización). */
interface ProveedorRecepcion {
  persona?: {
    nombres: string;
    apellidoPaterno?: string | null;
    apellidoMaterno?: string | null;
    numeroDocumento?: string | null;
    actorProductivoMinero?: { nombre: string } | null;
  } | null;
  idActorProductivoMinero?: string | null;
  actorProductivoMinero?: { nombre: string } | null;
  nombresApellidos?: string | null;
}

/** Nombre del proveedor de una recepción: persona, actor productivo o externo. */
export function nombreProveedorRecepcion(
  r: ProveedorRecepcion | null | undefined,
): string {
  const p = r?.persona;
  if (p) {
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }
  return r?.actorProductivoMinero?.nombre || r?.nombresApellidos || '—';
}

/** Segunda línea bajo el nombre: el documento de la persona, o qué tipo de
 *  proveedor es cuando no hay persona registrada. */
export function detalleProveedorRecepcion(
  r: ProveedorRecepcion | null | undefined,
): string {
  if (r?.persona) return r.persona.numeroDocumento || '—';
  if (r?.idActorProductivoMinero) return 'Actor productivo';
  return r?.nombresApellidos ? 'Externo' : '—';
}

/** Leyes de la recepción en una línea, ej. "Ag 12.5% · Pb 40%". Vacío si la
 *  recepción no trae detalle de minerales. */
export function leyesTextoRecepcion(
  r: Pick<RegistroMineral, 'detalles'> | null | undefined,
): string {
  return (r?.detalles ?? [])
    .map(
      (d) =>
        `${d.mineral?.simbolo ?? 'Mineral ' + d.idMineral} ${formatNumeroConMiles(d.ley)}${d.leyUnidad ?? '%'}`,
    )
    .join(' · ');
}

/** Actor productivo del proveedor: el de la persona, o el propio actor cuando
 *  es él quien deja el mineral. */
export function actorProveedorRecepcion(
  r: ProveedorRecepcion | null | undefined,
): string {
  return (
    r?.persona?.actorProductivoMinero?.nombre ||
    r?.actorProductivoMinero?.nombre ||
    '—'
  );
}

export interface DetalleMineralRequest {
  idMineral: number;
  ley: number;
  leyUnidad: LeyUnidad;
}

/** id presente = actualizar; sin id = crear.
 *  Ya no se envía totalValorBruto: el backend dejó de gestionarlo. */
export interface GuardarRegistroMineralRequest {
  id?: string;
  idCodificacion: string;
  /** Se envía UNO de los tres: persona, actor productivo o nombre del externo. */
  idPersona?: string;
  idActorProductivoMinero?: string;
  nombresApellidos?: string;
  numeroSacos: number | null;
  balanzaL: number;
  balanzaT: number;
  anticipo: number;
  humedad: number;
  /** Id de la persona (tipo muestrero) asignada a la recepción. Opcional. */
  idPersonalInterno?: string;
  /** Descripción del lugar de acopio (catálogo parametrica.lugar_acopio) */
  lugarAcopio: string;
  /** Opcional. Al actualizar: sin enviarlo se conserva el que tenía; null lo quita. */
  idLaboratorio?: string | null;
  fechaRecepcion: string; // ISO 8601 con offset, ej. '2026-07-22T14:35:00-04:00'
  observaciones: string;
  // detalles: DetalleMineralRequest[];
}

export type OrdenDireccion = 'ASC' | 'DESC';

export interface FiltrosRegistroMineral {
  page: number;
  limit: number;
  busqueda?: string; // nombre de proveedor
  codigoOperacion?: string; // código o número de operación/correlativo
  numeroDocumento?: string; // carnet
  idCodificacion?: string | number; // codificación de mineral (ej. ICC), ver Codificacion.codigo
  idEstado?: number;
  fechaDesde?: string; // 'YYYY-MM-DD'. No combinar con anio/mes/semana.
  fechaHasta?: string; // 'YYYY-MM-DD'. No combinar con anio/mes/semana.
  /** Alternativa a fechaDesde/fechaHasta para fraccionar exportaciones grandes por mes o semana ISO. */
  anio?: number;
  mes?: number; // 1-12, junto con anio
  semana?: number; // 1-53 (ISO), junto con anio
  /** Campo por el que se ordena. Por defecto 'id' */
  orderBy?: 'id' | 'codigoOperacion' | 'fechaRecepcion' | 'numeroDocumento' | 'estado';
  /** Por defecto 'DESC' (más nuevos primero) */
  orderDirection?: OrdenDireccion;
}

export interface RegistrosMineralPaginados {
  data: RegistroMineral[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
