// src/app/pages/contabilidad/caja-flujo/movimiento-caja-form-dialog/movimiento-caja-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  montoDosDecimales,
  tipoCambioCuatroDecimales,
} from '../../../../shared/utils/numero.util';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
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
import { catchError, combineLatest, forkJoin, map, Observable, of, startWith } from 'rxjs';
import { PersonaCI } from '../../../configurations/models/persona.models';
import {
  PlanCuentas,
  FormaPago,
  MonedaCuenta,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { PersonaService } from '../../../configurations/services/persona.service';
import {
  GuardarMovimientoCajaRequest,
  MovimientoCaja,
  OrigenMovimiento,
  TipoMovimientoCaja,
} from '../../models/movimiento-caja.models';
import { PersonaMovimientoRef } from '../../models/libreta-banco.models';
import { MovimientoCajaService } from '../../services/movimiento-caja.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import { PlanCuentasFieldComponent } from '../../components/plan-cuentas-field/plan-cuentas-field.component';

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
    FechaInputDirective,
    MontoInputDirective,
    MayusculasDirective,
    PlanCuentasFieldComponent,
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
  readonly cuentasPlan = signal<PlanCuentas[]>([]);

  get esEdicion(): boolean {
    return !!this.data.movimiento;
  }

  /** Documento que generó el movimiento: solo deja reclasificarlo. */
  get origen(): OrigenMovimiento | null {
    return this.data.movimiento?.origen ?? null;
  }

  get esUsd(): boolean {
    return this.data.moneda === 'USD';
  }

  get cargadoDesdeKardex(): boolean {
    return !!this.data.movimiento?.idMovimientoKardex && !this.origen;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    tipo: new FormControl<TipoMovimientoCaja | null>(null, [
      Validators.required,
    ]),
    monto: new FormControl<number | string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    // Bs por 1 USD del día: obligatorio solo en la caja en dólares.
    tipoCambio: new FormControl<number | string | null>(
      null,
      this.data.moneda === 'USD'
        ? [Validators.required, tipoCambioCuatroDecimales, Validators.min(0.0001)]
        : [],
    ),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    // Plan de cuentas (EGRESO) u origen del ingreso (INGRESO), del catálogo.
    idPlanCuentas: new FormControl<number | null>(null),
    nroComprobante: new FormControl('', [Validators.maxLength(100)]),
    // "FACTURA Y/O RECIBO": documento que respalda el movimiento.
    facturaRecibo: new FormControl('', [Validators.maxLength(100)]),
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
    // Al cambiar INGRESO/EGRESO cambia la lista: el destino que ya no
    // corresponde se limpia.
    this.f.tipo.valueChanges.subscribe(() => {
      const id = this.f.idPlanCuentas.value;
      if (id != null && !this.cuentasPlanFiltrados.some((d) => d.id === id)) {
        this.f.idPlanCuentas.setValue(null);
      }
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
      // Es opcional: si falla, el formulario igual carga sin destinos.
      cuentasPlan: this.parametricasService
        .obtenerCuentasPlan()
        .pipe(catchError(() => of([] as PlanCuentas[]))),
    }).subscribe({
      next: ({ formasPago, personas, cuentasPlan }) => {
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
        this.cuentasPlan.set(cuentasPlan.filter((d) => d.activo !== false));
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
        tipoCambio: m.tipoCambio != null ? Number(m.tipoCambio) : null,
        concepto: m.concepto,
        idPlanCuentas:
          m.idPlanCuentas ??
          (m.planCuentas && typeof m.planCuentas === 'object'
            ? m.planCuentas.id
            : null),
        nroComprobante: m.nroComprobante ?? '',
        facturaRecibo: m.facturaRecibo ?? '',
        idFormaPago: m.idFormaPago ?? null,
        beneficiario: m.persona ?? m.entregaFondosA ?? '',
      });
      if (this.origen) {
        // El back solo aplica concepto y plan de cuentas en estas filas.
        for (const control of [
          this.f.fecha,
          this.f.tipo,
          this.f.monto,
          this.f.tipoCambio,
          this.f.nroComprobante,
          this.f.facturaRecibo,
          this.f.idFormaPago,
          this.f.beneficiario,
        ]) {
          control.disable({ emitEvent: false });
        }
      } else if (this.cargadoDesdeKardex) {
        this.f.beneficiario.disable({ emitEvent: false });
      }
    } else if (this.data.fechaSugerida) {
      this.form.controls.fecha.setValue(this.parseFecha(this.data.fechaSugerida));
    }
  }

  /** EGRESO pide un destino de egreso; INGRESO, uno de ingreso — mismo
   *  criterio que recibos y traspasos. Sin tipo elegido se listan todos. */
  get cuentasPlanFiltrados(): PlanCuentas[] {
    const tipo = this.f.tipo.value;
    if (!tipo) return this.cuentasPlan();
    const quiero = tipo === 'EGRESO';
    return this.cuentasPlan().filter((d) => d.esEgreso === quiero);
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
    if (this.esUsd && v.tipoCambio != null && v.tipoCambio !== '') {
      request.tipoCambio = Number(v.tipoCambio);
    }

    const nroComprobante = (v.nroComprobante ?? '').trim();
    if (nroComprobante) request.nroComprobante = nroComprobante;
    // Siempre se envía (aunque vacío) para poder borrarla al editar.
    request.facturaRecibo = (v.facturaRecibo ?? '').trim();
    if (v.idPlanCuentas != null) request.idPlanCuentas = v.idPlanCuentas;
    if (v.idFormaPago) request.idFormaPago = v.idFormaPago;

    const b = v.beneficiario;
    if (b && typeof b === 'object' && 'id' in b) {
      // Persona elegida de la lista: se manda su id y su nombre compuesto.
      request.idPersona = String(b.id);
      request.entregaFondosA = this.nombreCompleto(b);
    } else {
      const texto = (typeof b === 'string' ? b : '').trim();
      if (texto) request.entregaFondosA = texto;
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
