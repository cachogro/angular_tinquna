// src/app/pages/contabilidad/boletas-pago/boleta-form-dialog/boleta-form-dialog.component.ts
// Emitir y pagar la boleta de pago de una persona del personal interno.
// La boleta muestra el salario completo; el recibo de EGRESO sale solo por
// el neto (líquido pagable − descuentos de préstamos). Si todo va a la
// deuda, no se genera recibo. Los descuentos de ley se ingresan como montos
// (el sistema no los calcula) y valen 0 por defecto.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
import { startWith } from 'rxjs';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { PersonaCI } from '../../../configurations/models/persona.models';
import { PersonaService } from '../../../configurations/services/persona.service';
import {
  EmitirBoletaRequest,
  PrepararBoletaResponse,
  PrestamoParaBoleta,
} from '../../models/boleta-pago.models';
import { BoletaPagoService } from '../../services/boleta-pago.service';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';
import {
  cargarPersonalInterno,
  formatFechaIso,
  nombrePersona,
  num,
} from '../../components/personal-interno.util';

export interface BoletaFormDialogData {
  idPersona?: string | null;
}

const importe = () =>
  new FormControl<number | null>(0, [montoDosDecimales, Validators.min(0)]);

@Component({
  selector: 'app-boleta-form-dialog',
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
    MatDatepickerModule,
    MatProgressSpinnerModule,
    FechaInputDirective,
    MontoInputDirective,
    DatosPagoFieldsComponent,
  ],
  templateUrl: './boleta-form-dialog.component.html',
  styleUrl: './boleta-form-dialog.component.scss',
})
export class BoletaFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BoletaFormDialogComponent>);
  private readonly data = inject<BoletaFormDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly boletaService = inject(BoletaPagoService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);
  readonly preparando = signal(false);
  readonly personal = signal<PersonaCI[]>([]);
  readonly prep = signal<PrepararBoletaResponse | null>(null);

  readonly form = new FormGroup({
    idPersona: new FormControl<string | null>(null, [Validators.required]),
    fechaDesde: new FormControl<Date | null>(null, [Validators.required]),
    fechaHasta: new FormControl<Date | null>(new Date(), [Validators.required]),
    fechaPago: new FormControl<Date | null>(new Date(), [Validators.required]),
    diasTrabajados: new FormControl<number | null>(null, [Validators.min(0), Validators.max(31)]),
    // Ingresos
    salarioBase: new FormControl<number | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    bonoAntiguedad: importe(),
    otrosIngresos: importe(),
    // Descuentos de ley (opcionales, montos ingresados a mano)
    aporteLaboral: importe(),
    rcIva: importe(),
    otrosDescuentosLey: importe(),
    // Un control por préstamo vigente, en el orden de prep().prestamos
    descuentos: new FormArray<FormControl<number | null>>([]),
    concepto: new FormControl('', [Validators.maxLength(255)]),
    observaciones: new FormControl('', [Validators.maxLength(255)]),
  });
  readonly pago = crearFormDatosPago();

  get f() {
    return this.form.controls;
  }

  private readonly valores = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Mismas cuentas que BoletaPagoService.emitir en el back. */
  readonly resumen = computed(() => {
    const v = this.valores();
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const totalGanado = r2(num(v.salarioBase) + num(v.bonoAntiguedad) + num(v.otrosIngresos));
    const totalDescuentosLey = r2(num(v.aporteLaboral) + num(v.rcIva) + num(v.otrosDescuentosLey));
    const liquidoPagable = r2(totalGanado - totalDescuentosLey);
    const totalDescuentoPrestamos = r2(
      (v.descuentos ?? []).reduce((s: number, d) => s + num(d), 0),
    );
    const montoPagado = r2(liquidoPagable - totalDescuentoPrestamos);
    return { totalGanado, totalDescuentosLey, liquidoPagable, totalDescuentoPrestamos, montoPagado };
  });

  /** Mensaje de por qué no se puede emitir (null si está bien). */
  readonly errorResumen = computed(() => {
    const r = this.resumen();
    if (r.liquidoPagable < 0) return 'Los descuentos de ley superan el total ganado.';
    if (r.totalDescuentoPrestamos > r.liquidoPagable)
      return 'Los descuentos de préstamos superan el líquido pagable.';
    const prep = this.prep();
    if (prep && !prep.kardex && r.totalDescuentoPrestamos > 0)
      return 'La persona no tiene kardex PERSONAL abierto: no se pueden descontar préstamos.';
    return null;
  });

  nombre = nombrePersona;
  num = num;

  /** true mientras el concepto sea el autogenerado (no tocado a mano). */
  private conceptoAutomatico = true;

  ngOnInit(): void {
    this.f.observaciones.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.observaciones.setValue(up, { emitEvent: false });
    });
    // Concepto: se autogenera desde el periodo hasta que el usuario lo edite
    // (si lo vacía, vuelve a autogenerarse).
    this.f.concepto.valueChanges.subscribe((v) => {
      this.conceptoAutomatico = !(v ?? '').trim();
      if (this.conceptoAutomatico) this.actualizarConcepto();
    });
    this.f.fechaDesde.valueChanges.subscribe(() => this.actualizarConcepto());
    this.f.fechaHasta.valueChanges.subscribe(() => this.actualizarConcepto());

    // Periodo sugerido: del mismo día del mes anterior a hoy.
    const hoy = new Date();
    this.f.fechaDesde.setValue(new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate()));

    this.f.idPersona.valueChanges.subscribe((id) => this.preparar(id));

    cargarPersonalInterno(this.personaService).subscribe({
      next: (lista) => {
        this.personal.set(lista);
        if (this.data?.idPersona) this.f.idPersona.setValue(this.data.idPersona);
      },
      error: () => this.personal.set([]),
    });
  }

  /** "Pago de sueldos y salarios - 28 Febrero a 28 Marzo 2026" (el año va
   *  una sola vez al final; si el periodo cruza de año, en ambas fechas). */
  private actualizarConcepto(): void {
    if (!this.conceptoAutomatico) return;
    const desde = this.f.fechaDesde.value;
    const hasta = this.f.fechaHasta.value;
    if (!desde || !hasta) return;
    const MESES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const txt = (d: Date, conAnio: boolean) =>
      `${d.getDate()} ${MESES[d.getMonth()]}${conAnio ? ` ${d.getFullYear()}` : ''}`;
    const mismoAnio = desde.getFullYear() === hasta.getFullYear();
    const concepto = `Pago de sueldos y salarios - ${txt(desde, !mismoAnio)} a ${txt(hasta, true)}`;
    this.f.concepto.setValue(concepto, { emitEvent: false });
  }

  /** Trae salario, kardex y préstamos vigentes de la persona elegida. */
  private preparar(idPersona: string | null): void {
    this.prep.set(null);
    this.f.descuentos.clear();
    if (!idPersona) return;
    this.preparando.set(true);
    this.boletaService.preparar(idPersona).subscribe({
      next: (res) => {
        this.prep.set(res);
        this.f.salarioBase.setValue(res.persona.salarioMensual ?? null);
        for (const p of res.prestamos) {
          this.f.descuentos.push(
            new FormControl<number | null>(p.descuentoSugerido, [
              montoDosDecimales,
              Validators.min(0),
              Validators.max(p.saldo),
            ]),
          );
        }
        this.preparando.set(false);
        if (res.persona.salarioMensual == null) {
          this.snackBar.open(
            'La persona no tiene salario mensual registrado: cárgalo en su ficha o escríbelo acá.',
            'Cerrar',
            { duration: 6000 },
          );
        }
      },
      error: (err) => {
        this.preparando.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo preparar la boleta', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  /** Días trabajados: solo dígitos. */
  soloDigitos(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.key.length > 1) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  controlDescuento(i: number): FormControl<number | null> {
    return this.f.descuentos.at(i);
  }

  /** Descuento sugerido = cuota pactada (o saldo si es menor). */
  usarSugerido(i: number, p: PrestamoParaBoleta): void {
    this.controlDescuento(i).setValue(p.descuentoSugerido);
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    const neto = this.resumen().montoPagado;
    // Si todo el sueldo va a la deuda no hay recibo: la forma de pago sobra.
    const fp = this.pago.controls.idFormaPago;
    if (neto <= 0) fp.clearValidators();
    else fp.setValidators([Validators.required]);
    fp.updateValueAndValidity({ emitEvent: false });

    if (this.form.invalid || this.pago.invalid) {
      this.form.markAllAsTouched();
      this.pago.markAllAsTouched();
      return;
    }
    const error = this.errorResumen();
    if (error) {
      this.snackBar.open(error, 'Cerrar', { duration: 5000 });
      return;
    }
    const v = this.form.getRawValue();
    if (v.fechaDesde! > v.fechaHasta!) {
      this.snackBar.open('La fecha desde no puede ser posterior a la fecha hasta.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }
    const prestamos = this.prep()?.prestamos ?? [];

    const request: EmitirBoletaRequest = {
      ...leerDatosPago(this.pago),
      idPersona: v.idPersona!,
      fechaDesde: formatFechaIso(v.fechaDesde!),
      fechaHasta: formatFechaIso(v.fechaHasta!),
      fechaPago: formatFechaIso(v.fechaPago!),
      salarioBase: Number(v.salarioBase),
      bonoAntiguedad: num(v.bonoAntiguedad),
      otrosIngresos: num(v.otrosIngresos),
      aporteLaboral: num(v.aporteLaboral),
      rcIva: num(v.rcIva),
      otrosDescuentosLey: num(v.otrosDescuentosLey),
      // Siempre explícito: lo que se ve en pantalla es lo que se descuenta.
      descuentos: prestamos
        .map((p, i) => ({ idPrestamo: p.id, monto: num(v.descuentos[i]) }))
        .filter((d) => d.monto > 0),
    };
    if (v.diasTrabajados != null && `${v.diasTrabajados}` !== '')
      request.diasTrabajados = Number(v.diasTrabajados);
    const concepto = (v.concepto ?? '').trim();
    if (concepto) request.concepto = concepto;
    const obs = (v.observaciones ?? '').trim();
    if (obs) request.observaciones = obs;

    this.guardando.set(true);
    this.boletaService.emitir(request).subscribe({
      next: (boleta) => {
        this.guardando.set(false);
        this.snackBar.open(
          boleta.idRecibo
            ? `Boleta N° ${boleta.numero} emitida y pagada`
            : `Boleta N° ${boleta.numero} emitida (todo el sueldo fue a la deuda: sin recibo)`,
          'Cerrar',
          { duration: 4000 },
        );
        this.dialogRef.close(boleta);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo emitir la boleta', 'Cerrar', {
          duration: 6000,
        });
      },
    });
  }
}
