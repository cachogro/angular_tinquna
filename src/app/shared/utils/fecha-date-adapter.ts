import { Injectable, Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatDateFormats,
  NativeDateAdapter,
} from '@angular/material/core';

/** Formato de fecha de los inputs de datepicker: dd/mm/aaaa. */
const FORMATO_DD_MM_AAAA = 'DD/MM/AAAA';

/**
 * NativeDateAdapter que muestra y lee las fechas de los inputs como
 * dd/mm/aaaa (ej. 05/09/2026) en vez del 5/9/2026 que da el locale es-BO.
 * Las etiquetas del calendario (mes/año) siguen usando el locale.
 */
@Injectable()
export class FechaDdMmAaaaAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: object | string): string {
    if (displayFormat !== FORMATO_DD_MM_AAAA) {
      return super.format(date, displayFormat as object);
    }
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${date.getFullYear()}`;
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const texto = value.trim();
      if (!texto) return null;
      // Solo se acepta dd/mm/aaaa (también con "-" o "."). Cualquier otro
      // texto, incluido uno a medio escribir como "05/09/20", es inválido:
      // el parse del navegador lo leería como mm/dd y daría otra fecha.
      const m = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
      if (!m) return this.invalid();
      const fecha = new Date(+m[3], +m[2] - 1, +m[1]);
      // Descarta fechas desbordadas como 31/02/2026.
      return fecha.getDate() === +m[1] && fecha.getMonth() === +m[2] - 1
        ? fecha
        : this.invalid();
    }
    return super.parse(value, parseFormat);
  }
}

const FORMATOS_FECHA: MatDateFormats = {
  parse: { dateInput: FORMATO_DD_MM_AAAA },
  display: {
    dateInput: FORMATO_DD_MM_AAAA,
    monthLabel: { month: 'short' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

/** Reemplaza `provideNativeDateAdapter()` + MAT_DATE_LOCALE es-BO: fechas
 *  dd/mm/aaaa. Se registra una sola vez en app.config para todo el sistema. */
export function provideFechaDdMmAaaa(): Provider[] {
  return [
    { provide: DateAdapter, useClass: FechaDdMmAaaaAdapter },
    { provide: MAT_DATE_FORMATS, useValue: FORMATOS_FECHA },
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ];
}
