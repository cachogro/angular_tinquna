import { Directive } from '@angular/core';

/**
 * Inputs de monto del sistema (mismo criterio que `restringirEntradaNumerica`
 * de los formularios de contabilidad, pero reutilizable): usar
 * `<input matInput appMonto formControlName="monto" />`.
 *
 * - Teclado numérico en móviles (inputmode decimal) y alineado a la
 *   derecha (.input-monto); sin autocompletado del navegador.
 * - Solo deja teclear dígitos y UN punto decimal (nada de "e", "-", "+" ni
 *   comas); al pegar, descarta lo que no sea un número válido.
 * - Las reglas (obligatorio, máx. 2 decimales, > 0) siguen siendo los
 *   validadores del control: `montoDosDecimales` + `Validators.min(...)`.
 */
@Directive({
  selector: 'input[appMonto]',
  standalone: true,
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    placeholder: '0.00',
    class: 'input-monto',
    '(keydown)': 'alTeclear($event)',
    '(paste)': 'alPegar($event)',
  },
})
export class MontoInputDirective {
  private static readonly TECLAS_CONTROL = new Set([
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ]);

  alTeclear(event: KeyboardEvent): void {
    const el = event.target as HTMLInputElement;
    if (event.ctrlKey || event.metaKey) return;
    if (MontoInputDirective.TECLAS_CONTROL.has(event.key)) return;
    if (event.key === '.') {
      // Un solo punto (salvo que se esté reemplazando la selección que lo tiene).
      const seleccion = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
      if (el.value.includes('.') && !seleccion.includes('.')) event.preventDefault();
      return;
    }
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  alPegar(event: ClipboardEvent): void {
    const texto = (event.clipboardData?.getData('text') ?? '').trim().replace(',', '.');
    if (!/^\d*\.?\d*$/.test(texto)) event.preventDefault();
  }
}
