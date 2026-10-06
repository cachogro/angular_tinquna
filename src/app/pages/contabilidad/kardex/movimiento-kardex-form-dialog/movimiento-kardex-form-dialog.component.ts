// src/app/pages/contabilidad/kardex/movimiento-kardex-form-dialog/movimiento-kardex-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
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
import {
  catchError,
  combineLatest,
  forkJoin,
  map,
  Observable,
  of,
  startWith,
} from 'rxjs';
import { PersonaCI } from '../../../configurations/models/persona.models';
import {
  CuentaFinanciera,
  DestinoGasto,
  EntidadFinanciera,
  FormaPago,
  KardexSubcuenta,
  MonedaCuenta,
  SIMBOLO_MONEDA,
} from '../../../configurations/parametricas/models/parametricas.models';
import { PersonaService } from '../../../configurations/services/persona.service';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import {
  GuardarMovimientoKardexRequest,
  MovimientoKardex,
  PersonaEnMovimientoKardex,
  TipoMovimientoKardexLinea,
} from '../../models/movimiento-kardex.models';
import { MovimientoKardexService } from '../../services/movimiento-kardex.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';

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

/** El autocomplete de destino de gasto guarda el objeto elegido, o el texto
 *  suelto mientras se escribe (se ignora al guardar si no coincide). */
type DestinoGastoControlValue = DestinoGasto | string | null;

@Component({
  selector: 'app-movimiento-kardex-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    MontoInputDirective,
    MayusculasDirective,
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
  readonly destinosGasto = signal<DestinoGasto[]>([]);
  readonly personas = signal<PersonaCI[]>([]);
  readonly entidadesFinancieras = signal<EntidadFinanciera[]>([]);

  /** Códigos de forma de pago que NO usan cuenta bancaria (efectivo). El resto
   *  (transacción, QR, cheque, depósito…) exige cuenta + n° de comprobante. */
  private readonly CODIGOS_SIN_BANCO = new Set(['EFECTIVO']);

  get esEdicion(): boolean {
    return !!this.data.movimiento;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    tipo: new FormControl<TipoMovimientoKardexLinea | null>(null, [
      Validators.required,
    ]),
    monto: new FormControl<number | string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    // Moneda de la línea: en USD la caja o el banco reciben dólares y el
    // kardex el equivalente en Bs (monto × tipo de cambio).
    moneda: new FormControl<MonedaCuenta>('BS', { nonNullable: true }),
    // Bs por 1 USD; validadores dinámicos (obligatorio solo en USD).
    tipoCambio: new FormControl<number | string | null>(null),
    detalle: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    nroComprobante: new FormControl('', [Validators.maxLength(30)]),
    facturaRecibo: new FormControl('', [Validators.maxLength(50)]),
    idSubcuenta: new FormControl<number | null>(null),
    idFormaPago: new FormControl<number | null>(null),
    // Solo con forma de pago bancaria; validadores dinámicos.
    idCuentaBancaria: new FormControl<number | null>(null),
    destinoGasto: new FormControl<DestinoGastoControlValue>(null),
    cobrador: new FormControl<Cobrador>(null),
  });

  get f() {
    return this.form.controls;
  }

  /** Destinos de gasto según el signo de la línea: DEBE (anticipo, sale plata)
   *  → `esEgreso === true`; HABER (pago/descuento, se recupera) → `false`.
   *  Vacío hasta elegir DEBE/HABER. */
  get destinosGastoFiltrados(): DestinoGasto[] {
    if (this.f.tipo.value === 'DEBE') {
      return this.destinosGasto().filter((d) => d.esEgreso);
    }
    if (this.f.tipo.value === 'HABER') {
      return this.destinosGasto().filter((d) => !d.esEgreso);
    }
    return [];
  }

  displayDestinoGasto = (v: DestinoGastoControlValue): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.nombre;
  };

  /** Opciones del autocomplete de destino de gasto según lo tecleado. */
  destinosGastoOpciones(): DestinoGasto[] {
    const v = this.f.destinoGasto.value;
    const texto = (typeof v === 'string' ? v : v ? v.nombre : '')
      .trim()
      .toLowerCase();
    const lista = this.destinosGastoFiltrados;
    return texto
      ? lista.filter((d) => d.nombre.toLowerCase().includes(texto))
      : lista;
  }

  private formaPagoSeleccionada(): FormaPago | undefined {
    const id = this.f.idFormaPago.value;
    return id == null ? undefined : this.formasPago().find((fp) => fp.id === id);
  }

  /** true cuando la forma de pago elegida exige cuenta bancaria + comprobante. */
  get requiereCuentaBancaria(): boolean {
    const fp = this.formaPagoSeleccionada();
    return (
      !!fp &&
      fp.afectaFondo !== false &&
      !this.CODIGOS_SIN_BANCO.has((fp.codigo ?? '').toUpperCase())
    );
  }

  /** Cuentas activas del banco en la moneda de la línea (el back rechaza
   *  una cuenta de otra moneda). */
  cuentasDe(e: EntidadFinanciera): CuentaFinanciera[] {
    const moneda = this.moneda;
    return (e.cuentas ?? []).filter(
      (c) => c.activo !== false && c.moneda === moneda,
    );
  }

  /** Bancos con al menos una cuenta en la moneda de la línea. */
  entidadesConCuentas(): EntidadFinanciera[] {
    return this.entidadesFinancieras().filter(
      (e) => this.cuentasDe(e).length > 0,
    );
  }

  // ---------- Moneda y tipo de cambio ----------

  get moneda(): MonedaCuenta {
    return this.f.moneda.value;
  }

  get esUsd(): boolean {
    return this.moneda === 'USD';
  }

  /** "Bs" o "$us", para la etiqueta del monto. */
  get simbolo(): string {
    return SIMBOLO_MONEDA[this.moneda];
  }

  private sincronizarTipoCambio(): void {
    const tc = this.f.tipoCambio;
    if (this.esUsd) {
      tc.setValidators([
        Validators.required,
        tipoCambioCuatroDecimales,
        Validators.min(0.0001),
      ]);
    } else {
      tc.clearValidators();
      tc.setValue(null, { emitEvent: false });
    }
    tc.updateValueAndValidity({ emitEvent: false });
  }

  tipoCambio(): number {
    const v = Number(this.f.tipoCambio.value);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  /** Lo que registra el kardex (siempre Bs): monto × T.C. en USD. */
  equivalenteBs(): number {
    const monto = Number(this.f.monto.value);
    if (!Number.isFinite(monto) || monto <= 0) return 0;
    return Math.round(monto * this.tipoCambio() * 100) / 100;
  }

  restringirEntradaNumerica(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (event.ctrlKey || event.metaKey || event.key.length > 1) return;
    if (event.key === '.') {
      if (target.value.includes('.')) event.preventDefault();
      return;
    }
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  etiquetaCuenta(c: CuentaFinanciera): string {
    return `${c.numeroCuenta} · ${SIMBOLO_MONEDA[c.moneda]}${c.alias ? ` · ${c.alias}` : ''}`;
  }

  private sincronizarCamposBanco(): void {
    const { idCuentaBancaria, nroComprobante } = this.f;
    if (this.requiereCuentaBancaria) {
      idCuentaBancaria.setValidators([Validators.required]);
      nroComprobante.setValidators([
        Validators.required,
        Validators.maxLength(30),
      ]);
    } else {
      idCuentaBancaria.clearValidators();
      nroComprobante.setValidators([Validators.maxLength(30)]);
      idCuentaBancaria.setValue(null, { emitEvent: false });
    }
    idCuentaBancaria.updateValueAndValidity({ emitEvent: false });
    nroComprobante.updateValueAndValidity({ emitEvent: false });
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
    this.f.nroComprobante.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.nroComprobante.setValue(up, { emitEvent: false });
    });
    this.f.facturaRecibo.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.facturaRecibo.setValue(up, { emitEvent: false });
    });

    // Al cambiar DEBE/HABER cambia la lista de destino del gasto: se limpia el
    // elegido si ya no aplica.
    this.f.tipo.valueChanges.subscribe(() => {
      const sel = this.f.destinoGasto.value;
      if (
        sel &&
        typeof sel === 'object' &&
        !this.destinosGastoFiltrados.some((d) => d.id === sel.id)
      ) {
        this.f.destinoGasto.setValue(null);
      }
    });
    // Al cambiar la forma de pago se prende/apaga cuenta bancaria + comprobante.
    this.f.idFormaPago.valueChanges.subscribe(() =>
      this.sincronizarCamposBanco(),
    );
    // Al cambiar la moneda: T.C. obligatorio solo en USD y la cuenta elegida
    // se limpia (la lista se filtra por moneda).
    this.f.moneda.valueChanges.subscribe(() => {
      this.f.idCuentaBancaria.setValue(null, { emitEvent: false });
      this.sincronizarTipoCambio();
    });

    // Cada catálogo con su propio catchError: si uno falla, los demás igual
    // llenan sus listas (mismos GET que usa el diálogo de recibo).
    forkJoin({
      subcuentas: this.parametricasService
        .obtenerKardexSubcuentas()
        .pipe(catchError(() => of([] as KardexSubcuenta[]))),
      formasPago: this.parametricasService
        .obtenerFormasPago()
        .pipe(catchError(() => of([] as FormaPago[]))),
      destinosGasto: this.parametricasService
        .obtenerDestinosGasto()
        .pipe(catchError(() => of([] as DestinoGasto[]))),
      personas: this.personaService
        .listarPersonas({ page: 1, limit: 1000, activo: true })
        .pipe(catchError(() => of({ data: [] as PersonaCI[] }))),
      entidadesFinancieras: this.parametricasService
        .obtenerEntidadesFinancieras()
        .pipe(catchError(() => of([] as EntidadFinanciera[]))),
    }).subscribe({
      next: ({
        subcuentas,
        formasPago,
        destinosGasto,
        personas,
        entidadesFinancieras,
      }) => {
        this.subcuentas.set(subcuentas.filter((s) => s.activo !== false));
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
        this.destinosGasto.set(
          destinosGasto.filter((d) => d.activo !== false),
        );
        this.personas.set(personas.data ?? []);
        this.entidadesFinancieras.set(
          (entidadesFinancieras ?? []).filter((e) => e.activo !== false),
        );
        this.cargandoCatalogos.set(false);
        this.precargarSiEdicion();
        this.sincronizarCamposBanco();
        this.sincronizarTipoCambio();
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
      const esUsd = m.moneda === 'USD';
      const debe = Number(m.debe);
      // En USD el monto editable es el original en dólares; debe/haber
      // vienen convertidos a Bs.
      const monto = esUsd
        ? Number(m.debeUsd) > 0
          ? Number(m.debeUsd)
          : Number(m.haberUsd)
        : debe > 0
          ? debe
          : Number(m.haber);
      const destinoGasto =
        m.destinoGasto ??
        this.destinosGasto().find((d) => d.id === m.idDestinoGasto) ??
        null;
      this.form.patchValue({
        fecha: this.parseFecha(m.fecha),
        tipo: debe > 0 ? 'DEBE' : 'HABER',
        monto,
        moneda: m.moneda ?? 'BS',
        tipoCambio: m.tipoCambio != null ? Number(m.tipoCambio) : null,
        detalle: m.detalle,
        nroComprobante: m.nroComprobante ?? '',
        facturaRecibo: m.facturaRecibo ?? '',
        idSubcuenta: m.subcuenta?.id ?? m.idSubcuenta ?? null,
        idFormaPago: m.formaPago?.id ?? m.idFormaPago ?? null,
        idCuentaBancaria: m.cuentaBancaria?.id ?? m.idCuentaBancaria ?? null,
        destinoGasto,
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
      moneda: v.moneda,
    };
    if (v.moneda === 'USD') request.tipoCambio = Number(v.tipoCambio);

    const nroComprobante = (v.nroComprobante ?? '').trim();
    if (nroComprobante) request.nroComprobante = nroComprobante;
    const facturaRecibo = (v.facturaRecibo ?? '').trim();
    if (facturaRecibo) request.facturaRecibo = facturaRecibo;
    if (v.idSubcuenta) request.idSubcuenta = v.idSubcuenta;
    if (v.idFormaPago) request.idFormaPago = v.idFormaPago;
    if (this.requiereCuentaBancaria && v.idCuentaBancaria) {
      request.idCuentaBancaria = v.idCuentaBancaria;
    }
    if (v.destinoGasto && typeof v.destinoGasto === 'object') {
      request.idDestinoGasto = v.destinoGasto.id;
    }

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
