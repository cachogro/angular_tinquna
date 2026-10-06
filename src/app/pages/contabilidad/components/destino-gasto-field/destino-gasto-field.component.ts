// src/app/pages/contabilidad/components/destino-gasto-field/destino-gasto-field.component.ts
// Campo "Destino del gasto" reutilizable, con el mismo formato que el de
// procesar recibo: se escribe y va mostrando los destinos que se parecen.
// El formulario dueño solo guarda el id (`control`); el texto que se teclea
// vive acá adentro.
import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import {
  FormControl,
  ReactiveFormsModule,
  ValidatorFn,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';
import { DestinoGasto } from '../../../configurations/parametricas/models/parametricas.models';

/** Objeto elegido del autocomplete, o el texto que se está escribiendo. */
type DestinoGastoTexto = DestinoGasto | string | null;

@Component({
  selector: 'app-destino-gasto-field',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
  ],
  templateUrl: './destino-gasto-field.component.html',
  styleUrl: './destino-gasto-field.component.scss',
})
export class DestinoGastoFieldComponent implements OnInit, OnDestroy {
  /** Control del formulario dueño: guarda el id del destino (o null). */
  @Input({ required: true }) control!: FormControl<number | null>;
  @Input() label = 'Destino del gasto (opcional)';
  @Input() hint = '';

  /** Destinos elegibles, ya filtrados por el formulario dueño. */
  @Input() set opciones(lista: DestinoGasto[] | null | undefined) {
    this.lista.set(lista ?? []);
    if (this.control) this.sincronizarDesdeControl();
  }

  private readonly lista = signal<DestinoGasto[]>([]);
  private readonly escrito = signal<DestinoGastoTexto>(null);
  private sub?: Subscription;

  /** Lo que se ve en el input: el destino elegido o el texto tecleado. */
  readonly texto = new FormControl<DestinoGastoTexto>(null);

  readonly filtradas = computed(() => {
    const v = this.escrito();
    const buscado = (typeof v === 'string' ? v : '').trim().toLowerCase();
    const lista = this.lista();
    return buscado
      ? lista.filter((d) => d.nombre.toLowerCase().includes(buscado))
      : lista;
  });

  /** Texto escrito que no se eligió de la lista → el formulario no guarda. */
  private readonly noSeleccionado: ValidatorFn = () =>
    this.hayTextoSuelto ? { noSeleccionado: true } : null;

  /** El error se muestra también cuando el formulario dueño marca todo como
   *  tocado al intentar guardar. */
  readonly errores: ErrorStateMatcher = {
    isErrorState: () =>
      this.control.invalid && (this.control.touched || this.texto.touched),
  };

  display = (v: DestinoGastoTexto): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.nombre;
  };

  get hayTextoSuelto(): boolean {
    const v = this.texto.value;
    return typeof v === 'string' && !!v.trim();
  }

  ngOnInit(): void {
    this.control.addValidators(this.noSeleccionado);
    this.sincronizarDesdeControl();

    this.sub = this.texto.valueChanges.subscribe((v) => {
      // Texto libre en mayúsculas, como el resto de los formularios.
      if (typeof v === 'string' && v !== v.toUpperCase()) {
        v = v.toUpperCase();
        this.texto.setValue(v, { emitEvent: false });
      }
      this.escrito.set(v);
      const id = v && typeof v === 'object' ? v.id : null;
      if (this.control.value !== id) {
        this.control.setValue(id);
        this.control.markAsDirty();
      } else {
        this.control.updateValueAndValidity();
      }
    });
    // Cambios hechos por el formulario dueño (precarga al editar, limpiar,
    // habilitar/deshabilitar).
    this.sub.add(
      this.control.valueChanges.subscribe(() => this.sincronizarDesdeControl()),
    );
    this.sub.add(
      this.control.statusChanges.subscribe(() => this.sincronizarEstado()),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.control.removeValidators(this.noSeleccionado);
    this.control.updateValueAndValidity({ emitEvent: false });
  }

  marcarTocado(): void {
    this.control.markAsTouched();
  }

  /** Refleja en el input el id que tiene el control. */
  private sincronizarDesdeControl(): void {
    this.sincronizarEstado();
    const id = this.control.value;
    const actual = this.texto.value;
    if (id == null) {
      // Mientras se escribe el control vale null: no se pisa lo tecleado.
      if (actual && typeof actual === 'object') this.mostrar(null);
      return;
    }
    if (actual && typeof actual === 'object' && actual.id === id) return;
    const destino = this.lista().find((d) => d.id === id);
    if (destino) this.mostrar(destino);
  }

  private mostrar(v: DestinoGastoTexto): void {
    this.texto.setValue(v, { emitEvent: false });
    this.escrito.set(v);
  }

  private sincronizarEstado(): void {
    if (this.control.disabled === this.texto.disabled) return;
    if (this.control.disabled) this.texto.disable({ emitEvent: false });
    else this.texto.enable({ emitEvent: false });
  }
}
