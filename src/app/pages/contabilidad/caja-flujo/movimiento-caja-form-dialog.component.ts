// src/app/pages/contabilidad/caja-flujo/movimiento-caja-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
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
  MonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import { PersonaService } from '../../configurations/services/persona.service';
import {
  GuardarMovimientoCajaRequest,
  MovimientoCaja,
  TipoMovimientoCaja,
} from '../models/movimiento-caja.models';
import { PersonaMovimientoRef } from '../models/libreta-banco.models';
import { MovimientoCajaService } from '../services/movimiento-caja.service';

export interface MovimientoCajaFormDialogData {
  idCaja: number;
  moneda: MonedaCuenta;
  movimiento?: MovimientoCaja | null;
  /** "YYYY-MM-DD" a proponer cuando se crea desde un mes filtrado. */
  fechaSugerida?: string;
}

type Beneficiario = PersonaCI | PersonaMovimientoRef | string | null;

@Component({
  selector: 'app-movimiento-caja-form-dialog',
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
  templateUrl: './movimiento-caja-form-dialog.component.html',
  styleUrl: './movimiento-caja-form-dialog.component.scss',
})
export class MovimientoCajaFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<MovimientoCajaFormDialogComponent>,
  );
  readonly data = inject<MovimientoCajaFormDialogData>(MAT_DIALOG_DATA);
  private readonly movimientoCajaService = inject(MovimientoCajaService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly formasPago = signal<FormaPago[]>([]);
  readonly personas = signal<PersonaCI[]>([]);

  get esEdicion(): boolean {
    return !!this.data.movimiento;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    tipo: new FormControl<TipoMovimientoCaja | null>(null, [
      Validators.required,
    ]),
    monto: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    destinoGasto: new FormControl('', [Validators.maxLength(255)]),
    nroComprobante: new FormControl('', [Validators.maxLength(30)]),
    idFormaPago: new FormControl<number | null>(null),
    beneficiario: new FormControl<Beneficiario>(null, [
      Validators.maxLength(255),
    ]),
  });

  get f() {
    return this.form.controls;
  }

  /** Lista de personas filtrada según lo tecleado en el autocomplete. */
  readonly personasFiltradas$: Observable<PersonaCI[]> = combineLatest([
    this.form.controls.beneficiario.valueChanges.pipe(startWith('')),
    toObservable(this.personas),
  ]).pipe(map(([valor, lista]) => this.filtrarPersonas(valor, lista)));

  /** true cuando el valor actual del control es una persona elegida (objeto con id). */
  readonly personaVinculada = toSignal(
    this.form.controls.beneficiario.valueChanges.pipe(
      startWith(this.form.controls.beneficiario.value),
      map((v) => !!v && typeof v === 'object' && 'id' in v),
    ),
    { initialValue: false },
  );

  ngOnInit(): void {
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });
    this.f.destinoGasto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.destinoGasto.setValue(up, { emitEvent: false });
    });
    this.f.beneficiario.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.beneficiario.setValue(up, { emitEvent: false });
    });

    forkJoin({
      formasPago: this.parametricasService.obtenerFormasPago(),
      personas: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      }),
    }).subscribe({
      next: ({ formasPago, personas }) => {
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
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
      const ingreso = Number(m.ingreso);
      this.form.patchValue({
        fecha: this.parseFecha(m.fecha),
        tipo: ingreso > 0 ? 'INGRESO' : 'EGRESO',
        monto: ingreso > 0 ? ingreso : Number(m.egreso),
        concepto: m.concepto,
        destinoGasto: m.destinoGasto ?? '',
        nroComprobante: m.nroComprobante ?? '',
        idFormaPago: m.idFormaPago ?? null,
        beneficiario: m.persona ?? m.nombresApellidos ?? '',
      });
    } else if (this.data.fechaSugerida) {
      this.form.controls.fecha.setValue(this.parseFecha(this.data.fechaSugerida));
    }
  }

  // ---------- Autocomplete beneficiario ----------

  nombreCompleto(p: PersonaCI | PersonaMovimientoRef): string {
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  displayBeneficiario = (valor: Beneficiario): string => {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    const doc = (valor as PersonaCI).numeroDocumento;
    return doc
      ? `${this.nombreCompleto(valor)} — ${doc}`
      : this.nombreCompleto(valor);
  };

  private filtrarPersonas(
    valor: Beneficiario,
    lista: PersonaCI[],
  ): PersonaCI[] {
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
          (p.numeroDocumento ?? '').toLowerCase().includes(texto),
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

    const request: GuardarMovimientoCajaRequest = {
      ...(this.data.movimiento ? { id: this.data.movimiento.id } : {}),
      idCaja: this.data.idCaja,
      moneda: this.data.moneda,
      fecha: this.formatFecha(v.fecha!),
      concepto: v.concepto!.trim(),
      tipo: v.tipo!,
      monto: Number(v.monto),
    };

    const nroComprobante = (v.nroComprobante ?? '').trim();
    if (nroComprobante) request.nroComprobante = nroComprobante;
    const destinoGasto = (v.destinoGasto ?? '').trim();
    if (destinoGasto) request.destinoGasto = destinoGasto;
    if (v.idFormaPago) request.idFormaPago = v.idFormaPago;

    const b = v.beneficiario;
    if (b && typeof b === 'object' && 'id' in b) {
      // Persona elegida de la lista: se manda su id y su nombre compuesto.
      request.idPersona = String(b.id);
      request.nombresApellidos = this.nombreCompleto(b);
    } else {
      const texto = (typeof b === 'string' ? b : '').trim();
      if (texto) request.nombresApellidos = texto;
    }

    this.movimientoCajaService.guardarMovimiento(request).subscribe({
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
