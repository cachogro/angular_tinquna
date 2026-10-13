// src/app/pages/contabilidad/components/cheque-hint/cheque-hint.component.ts
// Aviso de chequera para un formulario de pago: cuando se paga con CHEQUE
// desde una cuenta que maneja chequera, propone el próximo N° de cheque en
// el campo de N° de comprobante y muestra cuántos quedan. Si la cuenta no
// maneja chequera no muestra nada (el N° sigue siendo libre).
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SiguienteCheque } from '../../models/cheque.models';
import { ChequeService } from '../../services/cheque.service';

/** Con esta cantidad o menos el aviso pasa a advertencia. */
const POCOS_CHEQUES = 5;

@Component({
  selector: 'app-cheque-hint',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (info(); as i) {
      @if (i.siguienteNumero === null) {
        <p class="cheque-hint cheque-hint--error">
          <mat-icon>error_outline</mat-icon>
          Esta cuenta no tiene cheques disponibles. Registra un talonario en
          Cuentas y Bancos antes de pagar con cheque.
        </p>
      } @else {
        <p class="cheque-hint" [class.cheque-hint--aviso]="i.disponibles <= pocos">
          <mat-icon>{{ i.disponibles <= pocos ? 'warning_amber' : 'receipt_long' }}</mat-icon>
          <span>
            Siguiente cheque: <strong>N° {{ i.siguienteNumero }}</strong> ·
            {{ i.disponibles === 1 ? 'queda 1 cheque' : 'quedan ' + i.disponibles + ' cheques' }}
          </span>
          @if (numeroActual() !== i.siguienteNumero) {
            <button type="button" class="cheque-hint__usar" (click)="usarSiguiente()">
              Usar N° {{ i.siguienteNumero }}
            </button>
          }
        </p>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .cheque-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin: -8px 0 12px;
        font-size: 13px;
        color: rgb(var(--tk-ink, 0 0 0) / 0.65);
      }
      .cheque-hint mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .cheque-hint--aviso {
        color: #a86600;
      }
      .cheque-hint--error {
        color: var(--tk-rojo, #d32f2f);
      }
      .cheque-hint__usar {
        border: 0;
        background: none;
        padding: 0;
        font: inherit;
        font-weight: 600;
        text-decoration: underline;
        color: inherit;
        cursor: pointer;
      }
    `,
  ],
})
export class ChequeHintComponent implements OnChanges {
  /** Cuenta bancaria elegida en el formulario. */
  @Input() idCuentaBancaria: number | null | undefined;
  /** true cuando el pago es con CHEQUE y sale de la cuenta (egreso). */
  @Input() activo = false;
  /** Control del N° de comprobante / N° de transacción del formulario. */
  @Input() control: AbstractControl | null = null;

  private readonly chequeService = inject(ChequeService);

  readonly pocos = POCOS_CHEQUES;
  /** null = no aplica (no es cheque, sin cuenta, o la cuenta no maneja chequera). */
  readonly info = signal<SiguienteCheque | null>(null);
  /** Para descartar respuestas viejas si se cambia rápido de cuenta. */
  private consulta = 0;

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['idCuentaBancaria'] || cambios['activo']) this.consultar();
  }

  numeroActual(): number | null {
    const texto = String(this.control?.value ?? '').trim();
    return /^\d+$/.test(texto) ? Number(texto) : null;
  }

  usarSiguiente(): void {
    const siguiente = this.info()?.siguienteNumero;
    if (siguiente == null || !this.control) return;
    this.control.setValue(String(siguiente));
    this.control.markAsDirty();
  }

  private consultar(): void {
    const turno = ++this.consulta;
    if (!this.activo || !this.idCuentaBancaria) {
      this.info.set(null);
      return;
    }
    this.chequeService.siguiente(this.idCuentaBancaria).subscribe({
      next: (siguiente) => {
        if (turno !== this.consulta) return;
        this.info.set(siguiente.manejaCheques ? siguiente : null);
        // Propone el número solo si el campo está vacío: no pisa lo escrito.
        if (
          siguiente.manejaCheques &&
          siguiente.siguienteNumero !== null &&
          this.control &&
          !String(this.control.value ?? '').trim()
        ) {
          this.usarSiguiente();
        }
      },
      // Sin aviso si falla: el back igual valida el N° al guardar.
      error: () => {
        if (turno === this.consulta) this.info.set(null);
      },
    });
  }
}
