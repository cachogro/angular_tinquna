import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { merge } from 'rxjs';
import { FechaInputDirective } from '../../directives/fecha-input.directive';

type AtajoId = 'hoy' | 'semana' | 'mes' | 'mesAnterior' | 'gestion';

const ATAJOS: { id: AtajoId; nombre: string }[] = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'semana', nombre: 'Esta semana' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mesAnterior', nombre: 'Mes anterior' },
  { id: 'gestion', nombre: 'Gestión actual' },
];

/**
 * Filtro de rango de fechas del sistema: un solo campo "desde – hasta"
 * (se puede tipear dd/mm/aaaa o elegir en el calendario con Cancelar /
 * Aceptar) más botones de atajo para los períodos más usados.
 *
 * Trabaja directo sobre los FormControl del componente padre, así que sus
 * suscripciones a valueChanges siguen funcionando igual. Un atajo cambia
 * las dos fechas pero emite un solo valueChanges (el de `hasta`).
 */
@Component({
  selector: 'app-rango-fechas',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    FechaInputDirective,
  ],
  templateUrl: './rango-fechas.component.html',
  styleUrl: './rango-fechas.component.scss',
})
export class RangoFechasComponent implements OnInit {
  readonly desde = input.required<FormControl<Date | null>>();
  readonly hasta = input.required<FormControl<Date | null>>();
  readonly label = input('Rango de fechas');
  readonly min = input<Date | null>(null);
  readonly max = input<Date | null>(null);
  /** false oculta los botones de atajo (queda solo el campo). */
  readonly atajos = input(true);

  readonly listaAtajos = ATAJOS;
  readonly atajoActivo = signal<AtajoId | null>(null);

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.actualizarAtajoActivo();
    merge(this.desde().valueChanges, this.hasta().valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarAtajoActivo());
  }

  aplicarAtajo(id: AtajoId): void {
    const [inicio, fin] = this.rangoDe(id);
    this.desde().setValue(inicio, { emitEvent: false });
    this.hasta().setValue(fin);
    this.actualizarAtajoActivo();
  }

  private actualizarAtajoActivo(): void {
    const desde = this.desde().value;
    const hasta = this.hasta().value;
    const activo = ATAJOS.find(({ id }) => {
      const [inicio, fin] = this.rangoDe(id);
      return this.mismoDia(desde, inicio) && this.mismoDia(hasta, fin);
    });
    this.atajoActivo.set(activo?.id ?? null);
  }

  /** Rango [inicio, fin] del atajo, recortado a min/max si los hay. */
  private rangoDe(id: AtajoId): [Date, Date] {
    const ahora = new Date();
    const a = ahora.getFullYear();
    const m = ahora.getMonth();
    const d = ahora.getDate();
    let inicio = new Date(a, m, d);
    let fin = new Date(a, m, d);
    switch (id) {
      case 'semana': {
        const desdeLunes = (ahora.getDay() + 6) % 7;
        inicio = new Date(a, m, d - desdeLunes);
        fin = new Date(a, m, d - desdeLunes + 6);
        break;
      }
      case 'mes':
        inicio = new Date(a, m, 1);
        fin = new Date(a, m + 1, 0);
        break;
      case 'mesAnterior':
        inicio = new Date(a, m - 1, 1);
        fin = new Date(a, m, 0);
        break;
      case 'gestion':
        inicio = new Date(a, 0, 1);
        fin = new Date(a, 11, 31);
        break;
    }
    return [this.recortar(inicio), this.recortar(fin)];
  }

  private recortar(fecha: Date): Date {
    const min = this.soloDia(this.min());
    const max = this.soloDia(this.max());
    if (min && fecha < min) return min;
    if (max && fecha > max) return max;
    return fecha;
  }

  private soloDia(fecha: Date | null): Date | null {
    return fecha
      ? new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
      : null;
  }

  private mismoDia(a: Date | null, b: Date): boolean {
    return (
      !!a &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
