import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Obligatorio de verdad para textos: además de `Validators.required`, no
 * acepta solo espacios ("   "). Error: `soloEspacios`.
 */
export function sinSoloEspacios(c: AbstractControl): ValidationErrors | null {
  const v = c.value;
  return typeof v === 'string' && v.length > 0 && !v.trim()
    ? { soloEspacios: true }
    : null;
}
