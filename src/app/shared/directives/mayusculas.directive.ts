import { Directive, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Textos libres del sistema (concepto, observaciones, descripción, N° de
 * comprobante...): todo lo que se escribe o pega queda en MAYÚSCULAS. Usar
 * `<input matInput appMayusculas formControlName="concepto" />`.
 *
 * - Convierte mientras se escribe, sin mover el cursor de lugar.
 * - Deja el control del formulario con el mismo valor que se ve.
 * - Sin autocompletado del navegador (sugiere textos viejos en minúsculas).
 */
@Directive({
  selector: 'input[appMayusculas], textarea[appMayusculas]',
  standalone: true,
  host: {
    autocomplete: 'off',
    '(input)': 'alEscribir($event)',
  },
})
export class MayusculasDirective {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  alEscribir(event: Event): void {
    if ((event as InputEvent).isComposing) return;
    const el = event.target as HTMLInputElement | HTMLTextAreaElement;
    const mayusculas = el.value.toUpperCase();
    if (mayusculas === el.value) return;
    const { selectionStart, selectionEnd } = el;
    el.value = mayusculas;
    el.setSelectionRange(selectionStart, selectionEnd);
    this.ngControl?.control?.setValue(mayusculas, {
      emitEvent: false,
      emitModelToViewChange: false,
    });
  }
}
