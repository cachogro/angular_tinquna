const ZONA_BOLIVIA = 'America/La_Paz';

const formatoIsoBolivia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_BOLIVIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Día calendario en Bolivia ("YYYY-MM-DD") de una fecha que manda el back.
 *  Las columnas `timestamptz` llegan en UTC ("2026-09-26T03:59:59.999Z" es
 *  el 25/09 23:59 en Bolivia), así que no se puede cortar el string: hay
 *  que convertir el instante a la zona de Bolivia. Las fechas legadas sin
 *  hora ("2026-07-15") ya son el día calendario y se devuelven tal cual. */
export function diaCalendarioBolivia(fecha: string | null | undefined): string {
  if (!fecha) return '';
  if (fecha.length <= 10) return fecha;
  const instante = new Date(fecha);
  return isNaN(instante.getTime()) ? fecha.slice(0, 10) : formatoIsoBolivia.format(instante);
}

/** "dd/mm/aaaa" del día calendario en Bolivia. */
export function formatearFechaBolivia(fecha: string | null | undefined): string {
  const dia = diaCalendarioBolivia(fecha);
  if (!dia) return '';
  const [year, month, day] = dia.split('-');
  return `${day}/${month}/${year}`;
}

/** Date local (00:00) con el día calendario en Bolivia, para el datepicker. */
export function fechaBoliviaAInputDate(fecha: string | null | undefined): Date | null {
  const [a, m, d] = diaCalendarioBolivia(fecha).split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

/** 'HH:mm - dd-MM-yyyy' de una fecha ISO con offset propio (ej. la de
 *  recepción, '2026-07-24T04:38:00-04:00'). Toma los componentes tal cual
 *  vienen en el string, sin pasar por Date, para mostrar siempre la hora
 *  registrada y no la del huso horario del navegador. */
export function horaFechaDeIso(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
  if (!match) return fecha;
  const [, anio, mes, dia, hora, minuto] = match;
  return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
}

/** Igual que horaFechaDeIso pero sin hora: 'dd-MM-yyyy'. */
export function fechaDeIso(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!match) return fecha;
  const [, anio, mes, dia] = match;
  return `${dia}-${mes}-${anio}`;
}

/** Vigente = el instante actual cae dentro de [inicial, final]. `activo` es
 *  la baja lógica, no la vigencia: una cotización vencida sigue activa. */
export function estaVigente(
  registro: { fechaVigenciaInicial?: string | null; fechaVigenciaFinal?: string | null; activo?: boolean },
  ahora: Date = new Date(),
): boolean {
  if (registro.activo === false) return false;
  const inicial = aInstante(registro.fechaVigenciaInicial, 'T00:00:00.000-04:00');
  const final = aInstante(registro.fechaVigenciaFinal, 'T23:59:59.999-04:00');
  if (inicial && ahora < inicial) return false;
  if (final && ahora > final) return false;
  return true;
}

/** Las fechas legadas sin hora se completan como inicio/fin de día en Bolivia. */
function aInstante(fecha: string | null | undefined, horaSiSoloDia: string): Date | null {
  if (!fecha) return null;
  const instante = new Date(fecha.length <= 10 ? `${fecha}${horaSiSoloDia}` : fecha);
  return isNaN(instante.getTime()) ? null : instante;
}
