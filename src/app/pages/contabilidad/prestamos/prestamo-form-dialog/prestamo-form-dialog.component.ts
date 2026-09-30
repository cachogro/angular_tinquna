// src/app/pages/contabilidad/prestamos/prestamo-form-dialog/prestamo-form-dialog.component.ts
// Otorgar un préstamo a una persona del personal interno: genera un recibo
// de EGRESO (sale de caja o banco), un DEBE en su kardex PERSONAL y la línea
// OTORGAMIENTO del sub-libro del préstamo.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
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
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { sinSoloEspacios } from '../../../../shared/utils/texto.util';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { PersonaCI } from '../../../configurations/models/persona.models';
import { PersonaService } from '../../../configurations/services/persona.service';
import { OtorgarPrestamoRequest } from '../../models/prestamo-personal.models';
import { PrestamoPersonalService } from '../../services/prestamo-personal.service';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';
import {
  cargarPersonalInterno,
  formatFechaIso,
  nombrePersona,
} from '../../components/personal-interno.util';

/** La cuota no puede superar el monto prestado (error en el control cuota). */
function cuotaNoMayorQueMonto(g: AbstractControl): ValidationErrors | null {
  const monto = Number(g.get('monto')?.value);
  const cuota = g.get('cuotaMensual');
  if (!cuota) return null;
  const errores = { ...(cuota.errors ?? {}) };
  delete errores['cuotaMayorMonto'];
  if (Number.isFinite(monto) && monto > 0 && Number(cuota.value) > monto) {
    errores['cuotaMayorMonto'] = true;
  }
  cuota.setErrors(Object.keys(errores).length ? errores : null, { emitEvent: false });
  return null;
}

export interface PrestamoFormDialogData {
  /** Persona preseleccionada (p. ej. desde un filtro de la bandeja). */
  idPersona?: string | null;
}

@Component({
  selector: 'app-prestamo-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    FechaInputDirective,
    MontoInputDirective,
    DatosPagoFieldsComponent,
  ],
  templateUrl: './prestamo-form-dialog.component.html',
  styleUrl: './prestamo-form-dialog.component.scss',
})
export class PrestamoFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PrestamoFormDialogComponent>);
  private readonly data = inject<PrestamoFormDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly prestamoService = inject(PrestamoPersonalService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);
  readonly personal = signal<PersonaCI[]>([]);

  readonly hoy = new Date();

  readonly form = new FormGroup(
    {
      idPersona: new FormControl<string | null>(null, [Validators.required]),
      fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
      descripcion: new FormControl('', [
        Validators.required,
        sinSoloEspacios,
        Validators.maxLength(255),
      ]),
      monto: new FormControl<string | null>(null, [
        Validators.required,
        montoDosDecimales,
        Validators.min(0.01),
      ]),
      cuotaMensual: new FormControl<string | null>(null, [
        Validators.required,
        montoDosDecimales,
        Validators.min(0.01),
      ]),
      observaciones: new FormControl('', [Validators.maxLength(255)]),
    },
    { validators: cuotaNoMayorQueMonto },
  );

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Meses aproximados para saldar con la cuota pactada (solo informativo). */
  readonly cuotasEstimadas = computed(() => {
    const v = this.valores();
    const monto = Number(v.monto);
    const cuota = Number(v.cuotaMensual);
    return monto > 0 && cuota > 0 && cuota <= monto ? Math.ceil(monto / cuota) : null;
  });
  readonly pago = crearFormDatosPago();

  get f() {
    return this.form.controls;
  }

  nombre = nombrePersona;

  ngOnInit(): void {
    for (const c of [this.f.descripcion, this.f.observaciones]) {
      c.valueChanges.subscribe((v) => {
        if (typeof v !== 'string') return;
        const up = v.toUpperCase();
        if (up !== v) c.setValue(up, { emitEvent: false });
      });
    }
    if (this.data?.idPersona) this.f.idPersona.setValue(this.data.idPersona);
    cargarPersonalInterno(this.personaService).subscribe({
      next: (lista) => this.personal.set(lista),
      error: () => this.personal.set([]),
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid || this.pago.invalid) {
      this.form.markAllAsTouched();
      this.pago.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const request: OtorgarPrestamoRequest = {
      ...leerDatosPago(this.pago),
      idPersona: v.idPersona!,
      fecha: formatFechaIso(v.fecha!),
      descripcion: v.descripcion!.trim(),
      monto: Number(v.monto),
      cuotaMensual: Number(v.cuotaMensual),
    };
    const obs = (v.observaciones ?? '').trim();
    if (obs) request.observaciones = obs;

    this.guardando.set(true);
    this.prestamoService.otorgar(request).subscribe({
      next: (prestamo) => {
        this.guardando.set(false);
        this.snackBar.open(`Préstamo N° ${prestamo.numero} otorgado`, 'Cerrar', {
          duration: 3000,
        });
        this.dialogRef.close(prestamo);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo otorgar el préstamo', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }
}
