// src/app/pages/contabilidad/components/pagos-adicionales-fields/pagos-adicionales-fields.component.ts
// Pago mixto: filas de "otros medios de pago" que se suman a la forma de
// pago principal del formulario (por ejemplo, principal EFECTIVO y una fila
// QR por la otra mitad). La forma de pago principal cubre el resto:
// total − suma de estas filas. Lo usan el recibo y la sección de datos de
// pago (boleta de pago, pago de valorización).
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, forkJoin } from 'rxjs';
import {
  FormaPago,
  MonedaCuenta,
  SIMBOLO_MONEDA,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { MayusculasDirective } from '../../../../shared/directives/mayusculas.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { MedioPago, MedioPagoRequest } from '../../models/medio-pago.models';
import { ChequeHintComponent } from '../cheque-hint/cheque-hint.component';

export type FilaPagoAdicional = FormGroup<{
  idFormaPago: FormControl<number | null>;
  monto: FormControl<number | string | null>;
  idCuentaBancaria: FormControl<number | null>;
  nroComprobante: FormControl<string | null>;
  /** Lo mantiene el componente: true si la forma de pago de la fila es bancaria. */
  usaBanco: FormControl<boolean>;
}>;

export type FormPagosAdicionales = FormArray<FilaPagoAdicional>;

export function crearFormPagosAdicionales(): FormPagosAdicionales {
  return new FormArray<FilaPagoAdicional>([]);
}

/** Fila nueva; con `medio`, precargada (borrador que ya era un pago mixto). */
export function crearFilaPagoAdicional(medio?: MedioPago): FilaPagoAdicional {
  return new FormGroup({
    idFormaPago: new FormControl<number | null>(medio?.idFormaPago ?? null, [
      Validators.required,
    ]),
    monto: new FormControl<number | string | null>(
      medio ? Number(medio.monto) : null,
      [Validators.required, montoDosDecimales, Validators.min(0.01)],
    ),
    idCuentaBancaria: new FormControl<number | null>(medio?.idCuentaBancaria ?? null),
    nroComprobante: new FormControl<string | null>(medio?.nroComprobante ?? null, [
      Validators.maxLength(30),
    ]),
    usaBanco: new FormControl<boolean>(false, { nonNullable: true }),
  });
}

function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sumaPagosAdicionales(pagos: FormPagosAdicionales): number {
  return redondear(
    pagos.controls.reduce((s, fila) => {
      const m = Number(fila.controls.monto.value);
      return s + (Number.isFinite(m) && m > 0 ? m : 0);
    }, 0),
  );
}

/** Mensaje si los otros medios no dejan nada para la forma de pago principal. */
export function errorPagosMixtos(
  pagos: FormPagosAdicionales,
  total: number,
): string | null {
  if (!pagos.length) return null;
  return redondear(total - sumaPagosAdicionales(pagos)) > 0
    ? null
    : 'Pago mixto: los otros medios de pago deben sumar menos que el total (el resto va con la forma de pago principal)';
}

/** Lista `pagos` del request: el medio principal por el resto y después las
 *  filas. `undefined` si no hay filas (pago por un solo medio: no se envía). */
export function leerPagosMixtos(
  principal: { idFormaPago: number; idCuentaBancaria?: number; nroComprobante?: string },
  pagos: FormPagosAdicionales,
  total: number,
): MedioPagoRequest[] | undefined {
  if (!pagos.length) return undefined;
  const medios: MedioPagoRequest[] = [
    { ...principal, monto: redondear(total - sumaPagosAdicionales(pagos)) },
  ];
  for (const fila of pagos.controls) {
    const v = fila.getRawValue();
    const medio: MedioPagoRequest = {
      idFormaPago: v.idFormaPago!,
      monto: redondear(Number(v.monto)),
    };
    if (v.usaBanco) {
      medio.idCuentaBancaria = v.idCuentaBancaria!;
      medio.nroComprobante = (v.nroComprobante ?? '').trim();
    }
    medios.push(medio);
  }
  return medios;
}

interface CuentaOpcion {
  idCuenta: number;
  etiqueta: string;
  moneda: MonedaCuenta;
  manejaCheques: boolean;
}

@Component({
  selector: 'app-pagos-adicionales-fields',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MayusculasDirective,
    MontoInputDirective,
    ChequeHintComponent,
  ],
  templateUrl: './pagos-adicionales-fields.component.html',
  styleUrl: './pagos-adicionales-fields.component.scss',
})
export class PagosAdicionalesFieldsComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) pagos!: FormPagosAdicionales;
  /** Total que se paga entre todos los medios (principal + estas filas). */
  @Input() total = 0;
  /** true = sale dinero (un cheque consume talonario). */
  @Input() esEgreso = true;
  /** Las cuentas bancarias se filtran por la moneda del pago. */
  @Input() moneda: MonedaCuenta = 'BS';

  private readonly parametricasService = inject(ParametricasService);
  private sub?: Subscription;
  private cargado = false;

  readonly formasPago = signal<FormaPago[]>([]);
  private readonly cuentas = signal<CuentaOpcion[]>([]);

  /** Formas de pago que no pasan por banco. */
  private readonly CODIGOS_SIN_BANCO = new Set(['EFECTIVO']);

  get filas(): FilaPagoAdicional[] {
    return this.pagos.controls;
  }

  get simbolo(): string {
    return SIMBOLO_MONEDA[this.moneda];
  }

  /** Lo que queda para la forma de pago principal. */
  get restoPrincipal(): number {
    return redondear(this.total - sumaPagosAdicionales(this.pagos));
  }

  get excede(): boolean {
    return this.filas.length > 0 && this.restoPrincipal <= 0;
  }

  ngOnInit(): void {
    this.sub = this.pagos.valueChanges.subscribe(() => this.sincronizar());
    forkJoin({
      formasPago: this.parametricasService.obtenerFormasPago(),
      entidades: this.parametricasService.obtenerEntidadesFinancieras(),
    }).subscribe({
      next: ({ formasPago, entidades }) => {
        // Solo medios que mueven plata (afectaFondo = false son movimientos
        // internos: descuento, tranzado).
        this.formasPago.set(
          formasPago.filter((f) => f.activo !== false && f.afectaFondo !== false),
        );
        const opciones: CuentaOpcion[] = [];
        for (const e of entidades ?? []) {
          if (e.activo === false) continue;
          for (const c of e.cuentas ?? []) {
            if (c.activo === false) continue;
            opciones.push({
              idCuenta: c.id,
              etiqueta: `${e.sigla || e.nombre} · ${c.numeroCuenta} (${SIMBOLO_MONEDA[c.moneda] ?? c.moneda})`,
              moneda: c.moneda,
              manejaCheques: !!c.manejaCheques,
            });
          }
        }
        opciones.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
        this.cuentas.set(opciones);
        this.cargado = true;
        this.sincronizar();
      },
    });
  }

  ngOnChanges(): void {
    // Al cambiar la moneda, las cuentas de la otra moneda dejan de valer.
    this.sincronizar();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  agregar(): void {
    this.pagos.push(crearFilaPagoAdicional());
  }

  quitar(i: number): void {
    this.pagos.removeAt(i);
  }

  private formaDe(fila: FilaPagoAdicional): FormaPago | undefined {
    return this.formasPago().find((f) => f.id === fila.controls.idFormaPago.value);
  }

  /** Pago que sale de la cuenta con cheque: consume un cheque del talonario. */
  pagoConCheque(fila: FilaPagoAdicional): boolean {
    return this.esEgreso && (this.formaDe(fila)?.codigo ?? '').toUpperCase() === 'CHEQUE';
  }

  /** Cuentas en la moneda del pago; con cheque, solo las que tienen chequera. */
  cuentasDe(fila: FilaPagoAdicional): CuentaOpcion[] {
    const soloChequera = this.pagoConCheque(fila);
    return this.cuentas().filter(
      (c) => c.moneda === this.moneda && (!soloChequera || c.manejaCheques),
    );
  }

  /** Prende/apaga cuenta bancaria + N° de comprobante de cada fila según su
   *  forma de pago, y descarta la cuenta que ya no se ofrece. */
  private sincronizar(): void {
    // Sin catálogos no se sabe qué forma es bancaria: no tocar lo precargado.
    if (!this.cargado || !this.pagos) return;
    for (const fila of this.filas) {
      const { idCuentaBancaria, nroComprobante, usaBanco } = fila.controls;
      const fp = this.formaDe(fila);
      const banco = !!fp && !this.CODIGOS_SIN_BANCO.has((fp.codigo ?? '').toUpperCase());
      usaBanco.setValue(banco, { emitEvent: false });
      if (banco) {
        idCuentaBancaria.setValidators([Validators.required]);
        nroComprobante.setValidators([Validators.required, Validators.maxLength(30)]);
        if (
          idCuentaBancaria.value != null &&
          !this.cuentasDe(fila).some((c) => c.idCuenta === idCuentaBancaria.value)
        ) {
          idCuentaBancaria.setValue(null, { emitEvent: false });
          nroComprobante.setValue(null, { emitEvent: false });
        }
      } else {
        idCuentaBancaria.clearValidators();
        nroComprobante.setValidators([Validators.maxLength(30)]);
        idCuentaBancaria.setValue(null, { emitEvent: false });
        nroComprobante.setValue(null, { emitEvent: false });
      }
      idCuentaBancaria.updateValueAndValidity({ emitEvent: false });
      nroComprobante.updateValueAndValidity({ emitEvent: false });
    }
  }
}
