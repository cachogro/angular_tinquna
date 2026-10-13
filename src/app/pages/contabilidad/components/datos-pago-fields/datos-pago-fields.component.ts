// src/app/pages/contabilidad/components/datos-pago-fields/datos-pago-fields.component.ts
// Sección "Datos de pago" reutilizable (préstamos al personal, abonos y
// boletas de pago): forma de pago, cuenta bancaria + N° de comprobante
// cuando el medio es bancario, plan de cuentas y quién autorizó. Mismo
// criterio que el formulario de fondo a rendir: sin cuenta bancaria, el
// movimiento sale/entra en efectivo por la caja de flujo.
import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription, forkJoin, startWith } from 'rxjs';
import { PersonaCI } from '../../../configurations/models/persona.models';
import {
  PlanCuentas,
  FormaPago,
  MonedaCuentaBancaria,
  etiquetaMonedaCuenta,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { PersonaService } from '../../../configurations/services/persona.service';
import { DatosPagoRequest } from '../../models/prestamo-personal.models';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import { ChequeHintComponent } from '../cheque-hint/cheque-hint.component';
import {
  FormPagosAdicionales,
  PagosAdicionalesFieldsComponent,
  crearFormPagosAdicionales,
  errorPagosMixtos,
  leerPagosMixtos,
} from '../pagos-adicionales-fields/pagos-adicionales-fields.component';

/** Objeto elegido del autocomplete, o el texto que se está escribiendo. */
export type PlanCuentasControlValue = PlanCuentas | string | null;

/** Texto escrito que no se eligió de la lista → error (igual que en recibos). */
function destinoDeLaLista(c: AbstractControl): ValidationErrors | null {
  const v = c.value;
  return typeof v === 'string' && v.trim() ? { noSeleccionado: true } : null;
}

export type FormDatosPago = FormGroup<{
  idFormaPago: FormControl<number | null>;
  idCuentaBancaria: FormControl<number | null>;
  nroComprobante: FormControl<string | null>;
  /** Autocomplete: el destino elegido de la lista, o el texto tecleado. */
  planCuentas: FormControl<PlanCuentasControlValue>;
  idPersonaAutorizo: FormControl<string | null>;
  /** Lo mantiene el componente: true si la forma de pago elegida es bancaria. */
  usaBanco: FormControl<boolean>;
  /** Pago mixto: otros medios además de la forma de pago de arriba (que
   *  cubre el resto). Solo se ofrece si el componente recibe `montoTotal`. */
  pagosAdicionales: FormPagosAdicionales;
}>;

export function crearFormDatosPago(): FormDatosPago {
  return new FormGroup({
    idFormaPago: new FormControl<number | null>(null, [Validators.required]),
    idCuentaBancaria: new FormControl<number | null>(null),
    nroComprobante: new FormControl<string | null>('', [Validators.maxLength(30)]),
    planCuentas: new FormControl<PlanCuentasControlValue>(null, [destinoDeLaLista]),
    idPersonaAutorizo: new FormControl<string | null>(null, [Validators.required]),
    usaBanco: new FormControl<boolean>(false, { nonNullable: true }),
    pagosAdicionales: crearFormPagosAdicionales(),
  });
}

/** Mensaje si el pago mixto no cuadra con `montoTotal` (lo que se paga);
 *  null si está bien o si no hay otros medios. */
export function errorDatosPago(fg: FormDatosPago, montoTotal: number): string | null {
  return errorPagosMixtos(fg.controls.pagosAdicionales, montoTotal);
}

/** Arma la parte de datos de pago del request. Con banco manda cuenta y
 *  comprobante; sin banco, nada de eso (va por caja). Con `montoTotal` y
 *  otros medios cargados agrega `pagos` (pago mixto). */
export function leerDatosPago(fg: FormDatosPago, montoTotal?: number): DatosPagoRequest {
  const v = fg.getRawValue();
  const datos: DatosPagoRequest = { idPersonaAutorizo: v.idPersonaAutorizo! };
  if (v.idFormaPago != null) datos.idFormaPago = v.idFormaPago;
  if (v.usaBanco) {
    datos.idCuentaBancaria = v.idCuentaBancaria!;
    datos.nroComprobante = (v.nroComprobante ?? '').trim();
  }
  if (v.planCuentas && typeof v.planCuentas === 'object') {
    datos.idPlanCuentas = v.planCuentas.id;
  }
  if (montoTotal != null && v.idFormaPago != null) {
    const pagos = leerPagosMixtos(
      {
        idFormaPago: v.idFormaPago,
        idCuentaBancaria: datos.idCuentaBancaria,
        nroComprobante: datos.nroComprobante,
      },
      fg.controls.pagosAdicionales,
      montoTotal,
    );
    if (pagos) datos.pagos = pagos;
  }
  return datos;
}

interface CuentaOpcion {
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuentaBancaria;
  nombreEntidad: string;
  manejaCheques: boolean;
}

@Component({
  selector: 'app-datos-pago-fields',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MayusculasDirective,
    ChequeHintComponent,
    PagosAdicionalesFieldsComponent,
  ],
  templateUrl: './datos-pago-fields.component.html',
  styleUrl: './datos-pago-fields.component.scss',
})
export class DatosPagoFieldsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) form!: FormDatosPago;
  /** true = egreso (otorgar, boleta); false = ingreso (abono). Filtra los
   *  cuentas del plan de cuentas por su `esEgreso`. */
  @Input() esEgreso = true;
  /** Destino que se preselecciona al cargar el catálogo, si el campo está
   *  vacío (p. ej. 45 = "SUELDOS Y SALARIOS PERSONAL" en la boleta). */
  @Input() idDestinoPorDefecto?: number | null;
  /** Lo que se paga. Si se indica, se ofrece el pago mixto: repartirlo entre
   *  la forma de pago elegida y otros medios (efectivo + QR, etc.). */
  @Input() montoTotal: number | null = null;

  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private sub?: Subscription;

  readonly formasPago = signal<FormaPago[]>([]);
  readonly cuentas = signal<CuentaOpcion[]>([]);
  readonly cuentasPlan = signal<PlanCuentas[]>([]);
  readonly personasAutorizadas = signal<PersonaCI[]>([]);

  /** Lo que se va tecleando en el autocomplete del destino. Se crea en
   *  ngOnInit porque el form llega por @Input. */
  private textoDestino = signal<PlanCuentasControlValue>(null);
  readonly destinosFiltrados = computed(() => {
    const v = this.textoDestino();
    const texto = (typeof v === 'string' ? v : v ? v.nombre : '').trim().toLowerCase();
    const lista = this.cuentasPlan();
    return texto ? lista.filter((d) => d.nombre.toLowerCase().includes(texto)) : lista;
  });

  displayPlanCuentas = (v: PlanCuentasControlValue): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.nombre;
  };

  /** Formas de pago que no pasan por banco. */
  private readonly CODIGOS_SIN_BANCO = new Set(['EFECTIVO']);

  ngOnInit(): void {
    this.sub = this.form.controls.idFormaPago.valueChanges.subscribe(() =>
      this.sincronizarBanco(),
    );
    this.sub.add(
      this.form.controls.planCuentas.valueChanges
        .pipe(startWith(this.form.controls.planCuentas.value))
        .subscribe((v) => {
          // Texto libre en mayúsculas, como el resto de los formularios.
          if (typeof v === 'string' && v !== v.toUpperCase()) {
            this.form.controls.planCuentas.setValue(v.toUpperCase(), { emitEvent: false });
            v = v.toUpperCase();
          }
          this.textoDestino.set(v);
        }),
    );

    forkJoin({
      formasPago: this.parametricasService.obtenerFormasPago(),
      destinos: this.parametricasService.obtenerCuentasPlan(),
      entidades: this.parametricasService.obtenerEntidadesFinancieras(),
      autorizadas: this.personaService.listarPersonasAutorizadas(),
    }).subscribe({
      next: ({ formasPago, destinos, entidades, autorizadas }) => {
        // Solo medios que mueven plata (afectaFondo = false son movimientos
        // internos: descuento, tranzado).
        this.formasPago.set(
          formasPago.filter((f) => f.activo !== false && f.afectaFondo !== false),
        );
        this.cuentasPlan.set(
          destinos.filter(
            (d) => d.activo !== false && (d.esEgreso === undefined || d.esEgreso === this.esEgreso),
          ),
        );
        const porDefecto =
          this.idDestinoPorDefecto != null
            ? this.cuentasPlan().find((d) => d.id === this.idDestinoPorDefecto)
            : undefined;
        if (porDefecto && !this.form.controls.planCuentas.value) {
          this.form.controls.planCuentas.setValue(porDefecto);
        }
        const opciones: CuentaOpcion[] = [];
        for (const e of entidades) {
          for (const c of e.cuentas ?? []) {
            if (c.activo === false) continue;
            opciones.push({
              idCuenta: c.id,
              numeroCuenta: c.numeroCuenta,
              moneda: c.moneda,
              nombreEntidad: e.sigla || e.nombre,
              manejaCheques: !!c.manejaCheques,
            });
          }
        }
        opciones.sort((a, b) => a.nombreEntidad.localeCompare(b.nombreEntidad));
        this.cuentas.set(opciones);
        this.personasAutorizadas.set(
          (autorizadas ?? []).filter((p) => p.autorizado !== false && p.activo !== false),
        );
        this.sincronizarBanco();
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private sincronizarBanco(): void {
    const { idFormaPago, idCuentaBancaria, nroComprobante, usaBanco } = this.form.controls;
    const fp = this.formasPago().find((f) => f.id === idFormaPago.value);
    const banco = !!fp && !this.CODIGOS_SIN_BANCO.has((fp.codigo ?? '').toUpperCase());
    usaBanco.setValue(banco, { emitEvent: false });
    if (banco) {
      idCuentaBancaria.setValidators([Validators.required]);
      nroComprobante.setValidators([Validators.required, Validators.maxLength(30)]);
    } else {
      idCuentaBancaria.clearValidators();
      nroComprobante.setValidators([Validators.maxLength(30)]);
      idCuentaBancaria.setValue(null, { emitEvent: false });
      nroComprobante.setValue('', { emitEvent: false });
    }
    // Al pasar a CHEQUE la lista se reduce a las cuentas con chequera: si la
    // elegida ya no está, se limpia junto con el N° de comprobante.
    if (
      idCuentaBancaria.value != null &&
      !this.cuentasVisibles.some((c) => c.idCuenta === idCuentaBancaria.value)
    ) {
      idCuentaBancaria.setValue(null, { emitEvent: false });
      nroComprobante.setValue('', { emitEvent: false });
    }
    idCuentaBancaria.updateValueAndValidity({ emitEvent: false });
    nroComprobante.updateValueAndValidity({ emitEvent: false });
  }

  /** Pagando con cheque solo se ofrecen las cuentas que tienen chequera. */
  get cuentasVisibles(): CuentaOpcion[] {
    return this.pagoConCheque
      ? this.cuentas().filter((c) => c.manejaCheques)
      : this.cuentas();
  }

  /** Pago que sale de la cuenta con cheque: consume un cheque del talonario. */
  get pagoConCheque(): boolean {
    const fp = this.formasPago().find((f) => f.id === this.form.controls.idFormaPago.value);
    return this.esEgreso && (fp?.codigo ?? '').toUpperCase() === 'CHEQUE';
  }

  nombreCompleto(p: PersonaCI): string {
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  etiquetaCuenta(c: CuentaOpcion): string {
    return `${c.nombreEntidad} · ${c.numeroCuenta} (${etiquetaMonedaCuenta(c.moneda)})`;
  }
}
