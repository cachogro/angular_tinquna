import { Directive, OnInit, inject } from '@angular/core';
import { MatDatepickerInput } from '@angular/material/datepicker';
import { MatInput } from '@angular/material/input';

/**
 * Inputs de fecha del sistema (dd/mm/aaaa): se aplica solo a todo input con
 * datepicker o de un rango de fechas (basta con importarla en el componente).
 *
 * - Permite tipear la fecha y pone la "/" sola: 05092026 → 05/09/2026.
 * - Limita a 10 caracteres y desactiva el autocompletado del navegador.
 * - En fechas simples alinea a la derecha (.input-fecha) y, si el input no
 *   trae placeholder, muestra "dd/mm/aaaa".
 */
@Directive({
  selector: 'input[matDatepicker], input[matStartDate], input[matEndDate]',
  standalone: true,
  host: {
    maxlength: '10',
    autocomplete: 'off',
    '[class.input-fecha]': 'esFechaSimple',
    '(beforeinput)': 'autoBarra($event)',
  },
})
export class FechaInputDirective implements OnInit {
  private readonly matInput = inject(MatInput, { optional: true, self: true });
  readonly esFechaSimple = !!inject(MatDatepickerInput, { optional: true, self: true });

  ngOnInit(): void {
    if (this.esFechaSimple && this.matInput && !this.matInput.placeholder) {
      this.matInput.placeholder = 'dd/mm/aaaa';
    }
  }

  autoBarra(ev: InputEvent): void {
    const el = ev.target as HTMLInputElement;
    if (
      ev.inputType === 'insertText' &&
      /^\d$/.test(ev.data ?? '') &&
      el.selectionStart === el.value.length &&
      /^(\d{2}|\d{2}\/\d{2})$/.test(el.value)
    ) {
      el.value += '/';
    }
  }
}
