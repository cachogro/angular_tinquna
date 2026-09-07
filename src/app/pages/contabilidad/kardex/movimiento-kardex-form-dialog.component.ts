// src/app/pages/contabilidad/kardex/movimiento-kardex-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, forkJoin, map, Observable, startWith } from 'rxjs';
import { PersonaCI } from '../../configurations/models/persona.models';
import {
  FormaPago,
  KardexSubcuenta,
  TipoMovimientoKardex,
} from '../../configurations/parametricas/models/parametricas.models';
import { PersonaService } from '../../configurations/services/persona.service';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import {
  GuardarMovimientoKardexRequest,
  MovimientoKardex,
  PersonaEnMovimientoKardex,
  TipoMovimientoKardexLinea,
} from '../models/movimiento-kardex.models';
import { MovimientoKardexService } from '../services/movimiento-kardex.service';

export interface MovimientoKardexFormDialogData {
  idKardex: string;
  movimiento?: MovimientoKardex | null;
  /** "YYYY-MM-DD" a proponer al crear. */
  fechaSugerida?: string;
  /** Dueño del kardex (actor o persona), para el título y como cobrador
   *  sugerido por defecto al crear. */
  nombreDestinatario?: string;
  /** Si el kardex es de tipo PERSONAL, el id de esa persona: permite
   *  precargarla como cobrador ya vinculado (no solo el texto). */
  idPersonaPropietario?: string;
}

/** El control puede tener: una PersonaCI recién elegida del autocomplete, el
 *  cobrador anidado (subset) que ya venía en un movimiento al editar, texto
 *  suelto tecleado (se ignora al guardar), o nada. */
type Cobrador = PersonaCI | PersonaEnMovimientoKardex | string | null;

@Component({
  selector: 'app-movimiento-kardex-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ],
  templateUrl: './movimiento-kardex-form-dialog.component.html',
  styleUrl: './movimiento-kardex-form-dialog.component.scss',
})
export class MovimientoKardexFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<MovimientoKardexFormDialogComponent>,
  );
  readonly data = inject<MovimientoKardexFormDialogData>(
    MAT_DIALOG_DATA,
  );
  private readonly movimientoService = inject(MovimientoKardexService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly subcuentas = signal<KardexSubcuenta[]>([]);
  readonly formasPago = signal<FormaPago[]>([]);
  readonly tiposMovimiento = signal<TipoMovimientoKardex[]>([]);
  readonly personas = signal<PersonaCI[]>([]);

  get esEdicion(): boolean {
    return !!this.data.movimiento;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    tipo: new FormControl<TipoMovimientoKardexLinea | null>(null, [
      Validators.required,
    ]),
    monto: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    detalle: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    nroComprobante: new FormControl('', [Validators.maxLength(30)]),
    idSubcuenta: new FormControl<number | null>(null),
    idFormaPago: new FormControl<number | null>(null),
    idTipoMovimiento: new FormControl<number | null>(null),
    cobrador: new FormControl<Cobrador>(null),
  });

  get f() {
    return this.form.controls;
  }

  /** Lista filtrada del autocomplete de cobrador. */
  readonly cobradoresFiltrados$: Observable<PersonaCI[]> = combineLatest([
    this.form.controls.cobrador.valueChanges.pipe(startWith('')),
    toObservable(this.personas),
  ]).pipe(map(([valor, lista]) => this.filtrarPersonas(valor, lista)));

  ngOnInit(): void {
    this.f.detalle.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.detalle.setValue(up, { emitEvent: false });
    });

    forkJoin({
      subcuentas: this.parametricasService.obtenerKardexSubcuentas(),
      formasPago: this.parametricasService.obtenerFormasPago(),
      tiposMovimiento: this.parametricasService.obtenerTiposMovimientoKardex(),
      personas: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      }),
    }).subscribe({
      next: ({ subcuentas, formasPago, tiposMovimiento, personas }) => {
        this.subcuentas.set(subcuentas.filter((s) => s.activo !== false));
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
        this.tiposMovimiento.set(
          tiposMovimiento.filter((t) => t.activo !== false),
        );
        this.personas.set(personas.data ?? []);
        this.cargandoCatalogos.set(false);
        this.precargarSiEdicion();
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
        this.precargarSiEdicion();
      },
    });
  }

  private precargarSiEdicion(): void {
    const m = this.data.movimiento;
    if (m) {
      const debe = Number(m.debe);
      this.form.patchValue({
        fecha: this.parseFecha(m.fecha),
        tipo: debe > 0 ? 'DEBE' : 'HABER',
        monto: debe > 0 ? debe : Number(m.haber),
        detalle: m.detalle,
        nroComprobante: m.nroComprobante ?? '',
        idSubcuenta: m.subcuenta?.id ?? m.idSubcuenta ?? null,
        idFormaPago: m.formaPago?.id ?? m.idFormaPago ?? null,
        idTipoMovimiento: m.tipoMovimiento?.id ?? m.idTipoMovimiento ?? null,
        cobrador: m.cobrador ?? null,
      });
    } else {
      if (this.data.fechaSugerida) {
        this.form.controls.fecha.setValue(
          this.parseFecha(this.data.fechaSugerida),
        );
      }
      // Cobrador por defecto: el propietario del kardex. Si es una persona
      // registrada la vinculamos de verdad (queda con id); si es un actor
      // (o no se encontró la persona) solo sugerimos el texto, editable.
      const propia = this.data.idPersonaPropietario
        ? this.personas().find(
            (p) => String(p.id) === String(this.data.idPersonaPropietario),
          )
        : null;
      if (propia) {
        this.form.controls.cobrador.setValue(propia);
      } else if (this.data.nombreDestinatario) {
        this.form.controls.cobrador.setValue(this.data.nombreDestinatario);
      }
    }
  }

  // ---------- Autocomplete cobrador ----------

  nombreCompleto(
    p: PersonaCI | PersonaEnMovimientoKardex,
  ): string {
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  displayCobrador = (valor: Cobrador): string => {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    const doc = (valor as PersonaCI).numeroDocumento;
    return doc ? `${this.nombreCompleto(valor)} — ${doc}` : this.nombreCompleto(valor);
  };

  private filtrarPersonas(valor: Cobrador, lista: PersonaCI[]): PersonaCI[] {
    const texto = (
      typeof valor === 'string' ? valor : valor ? this.nombreCompleto(valor) : ''
    )
      .trim()
      .toLowerCase();
    if (!texto) return lista.slice(0, 50);
    return lista
      .filter(
        (p) =>
          this.nombreCompleto(p).toLowerCase().includes(texto) ||
          p.numeroDocumento.toLowerCase().includes(texto),
      )
      .slice(0, 50);
  }

  // ---------- Guardar ----------

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();

    const request: GuardarMovimientoKardexRequest = {
      ...(this.data.movimiento ? { id: this.data.movimiento.id } : {}),
      idKardex: this.data.idKardex,
      fecha: this.formatFecha(v.fecha!),
      detalle: v.detalle!.trim(),
      tipo: v.tipo!,
      monto: Number(v.monto),
    };

    const nroComprobante = (v.nroComprobante ?? '').trim();
    if (nroComprobante) request.nroComprobante = nroComprobante;
    if (v.idSubcuenta) request.idSubcuenta = v.idSubcuenta;
    if (v.idFormaPago) request.idFormaPago = v.idFormaPago;
    if (v.idTipoMovimiento) request.idTipoMovimiento = v.idTipoMovimiento;

    const cobrador = v.cobrador;
    if (cobrador && typeof cobrador === 'object' && 'id' in cobrador) {
      request.idCobrador = String(cobrador.id);
    }

    this.movimientoService.guardar(request).subscribe({
      next: (movimiento) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion ? 'Movimiento actualizado' : 'Movimiento registrado',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(movimiento ?? true);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo guardar el movimiento',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }
}
