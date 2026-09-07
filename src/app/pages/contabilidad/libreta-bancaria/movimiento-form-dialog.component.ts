// src/app/pages/contabilidad/libreta-bancaria/movimiento-form-dialog.component.ts
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
import { combineLatest, map, Observable, startWith } from 'rxjs';
import { PersonaCI } from '../../configurations/models/persona.models';
import { PersonaService } from '../../configurations/services/persona.service';
import {
  GuardarMovimientoBancoRequest,
  MovimientoBanco,
  PersonaMovimientoRef,
  TipoMovimientoBanco,
} from '../models/libreta-banco.models';
import { LibretaBancoService } from '../services/libreta-banco.service';

export interface MovimientoFormDialogData {
  idCuentaBancaria: number;
  movimiento?: MovimientoBanco | null;
  /** "YYYY-MM-DD" a proponer cuando se crea desde un mes filtrado. */
  fechaSugerida?: string;
}

type Beneficiario = PersonaCI | PersonaMovimientoRef | string | null;

@Component({
  selector: 'app-movimiento-form-dialog',
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
  template: `
    <h2 mat-dialog-title>
      {{ esEdicion ? 'Editar movimiento' : 'Nuevo movimiento' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="mov-form">
        <div class="mov-form__row">
          <mat-form-field appearance="outline">
            <mat-label>Fecha</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="fecha" readonly
              (click)="picker.open()" />
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            @if (f.fecha.hasError('required') && f.fecha.touched) {
            <mat-error>Obligatorio</mat-error>
            }
            <mat-hint>Define el mes y la gestión</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="tipo">
              <mat-option value="DEBE">DEBE — Egreso / salida</mat-option>
              <mat-option value="HABER">HABER — Ingreso / entrada</mat-option>
            </mat-select>
            @if (f.tipo.hasError('required') && f.tipo.touched) {
            <mat-error>Obligatorio</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Monto (Bs)</mat-label>
            <input
              matInput
              type="number"
              step="0.01"
              min="0.01"
              formControlName="monto"
            />
            @if (f.monto.hasError('required') && f.monto.touched) {
            <mat-error>Obligatorio</mat-error>
            }
            @if (f.monto.hasError('min') && f.monto.touched) {
            <mat-error>Debe ser mayor a 0</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="mov-form__full">
          <mat-label>Concepto</mat-label>
          <input matInput formControlName="concepto" maxlength="255" />
          @if (f.concepto.hasError('required') && f.concepto.touched) {
          <mat-error>Obligatorio</mat-error>
          }
        </mat-form-field>

        <div class="mov-form__row2">
          <mat-form-field appearance="outline">
            <mat-label>N° de transacción (opcional)</mat-label>
            <input matInput formControlName="nroTransaccion" maxlength="30" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nombres y apellidos (opcional)</mat-label>
            <input matInput formControlName="beneficiario" maxlength="255"
              [matAutocomplete]="autoBenef" #benefTrigger="matAutocompleteTrigger"
              (focus)="benefTrigger.openPanel()"
              placeholder="Buscar persona registrada o escribir libremente" />
            <mat-autocomplete #autoBenef="matAutocomplete" [displayWith]="displayBeneficiario">
              @for (p of personasFiltradas$ | async; track p.id) {
              <mat-option [value]="p">
                <span>{{ nombreCompleto(p) }}</span>
                <small class="benef-doc"> · {{ p.numeroDocumento }}</small>
              </mat-option>
              } @empty {
              <mat-option disabled>Sin coincidencias — se guarda el texto tal cual</mat-option>
              }
            </mat-autocomplete>
            @if (personaVinculada()) {
            <mat-icon matSuffix matTooltip="Vinculada a persona registrada" color="primary">how_to_reg</mat-icon>
            }
            <mat-hint>
              @if (personaVinculada()) { Vinculada a persona CI registrada }
              @else { No está en la lista: se guarda el texto libre }
            </mat-hint>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancelar()" [disabled]="guardando()">
        Cancelar
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="guardar()"
        [disabled]="guardando()"
      >
        @if (guardando()) {
        <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        <span>Guardando...</span>
        } @else {
        <span>{{ esEdicion ? 'Guardar cambios' : 'Registrar' }}</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .mov-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 520px;
      }
      .mov-form__row {
        display: grid;
        grid-template-columns: 1fr 1.2fr 1fr;
        gap: 14px;
      }
      .mov-form__row2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .mov-form__full {
        width: 100%;
      }
      .mov-form mat-form-field {
        width: 100%;
      }
      .benef-doc {
        color: rgba(0, 0, 0, 0.5);
      }
      .btn-spinner {
        display: inline-block;
      }
      .btn-spinner ::ng-deep circle {
        stroke: currentColor;
      }
      @media (max-width: 620px) {
        .mov-form {
          min-width: 0;
        }
        .mov-form__row,
        .mov-form__row2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MovimientoFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<MovimientoFormDialogComponent>,
  );
  private readonly data = inject<MovimientoFormDialogData>(MAT_DIALOG_DATA);
  private readonly libretaService = inject(LibretaBancoService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);
  readonly personas = signal<PersonaCI[]>([]);

  get esEdicion(): boolean {
    return !!this.data.movimiento;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    tipo: new FormControl<TipoMovimientoBanco | null>(null, [
      Validators.required,
    ]),
    monto: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    concepto: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    nroTransaccion: new FormControl('', [Validators.maxLength(30)]),
    beneficiario: new FormControl<Beneficiario>(null, [Validators.maxLength(255)]),
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
    // Concepto siempre en mayúsculas.
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });
    // Beneficiario: solo cuando es texto libre lo pasamos a mayúsculas.
    this.f.beneficiario.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.beneficiario.setValue(up, { emitEvent: false });
    });

    this.personaService
      .listarPersonas({ page: 1, limit: 1000, activo: true })
      .subscribe({
        next: (res) => this.personas.set(res.data ?? []),
        error: () => this.personas.set([]),
      });

    const m = this.data.movimiento;
    if (m) {
      const debe = Number(m.debe);
      this.form.patchValue({
        fecha: this.parseFecha(m.fecha),
        tipo: debe > 0 ? 'DEBE' : 'HABER',
        monto: debe > 0 ? debe : Number(m.haber),
        concepto: m.concepto,
        nroTransaccion: m.nroTransaccion ?? '',
        beneficiario: m.persona ?? m.nombresApellidos ?? '',
      });
    } else if (this.data.fechaSugerida) {
      this.form.controls.fecha.setValue(this.parseFecha(this.data.fechaSugerida));
    }
  }

  // ---------- Autocomplete beneficiario ----------

  nombreCompleto(
    p: PersonaCI | PersonaMovimientoRef,
  ): string {
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

    const request: GuardarMovimientoBancoRequest = {
      ...(this.data.movimiento ? { id: this.data.movimiento.id } : {}),
      idCuentaBancaria: this.data.idCuentaBancaria,
      fecha: this.formatFecha(v.fecha!),
      concepto: v.concepto!.trim(),
      tipo: v.tipo!,
      monto: Number(v.monto),
    };

    const nroTransaccion = (v.nroTransaccion ?? '').trim();
    if (nroTransaccion) request.nroTransaccion = nroTransaccion;

    const b = v.beneficiario;
    if (b && typeof b === 'object' && 'id' in b) {
      // Persona elegida de la lista: se manda su id y su nombre compuesto.
      request.idPersona = b.id;
      request.nombresApellidos = this.nombreCompleto(b);
    } else {
      const texto = (typeof b === 'string' ? b : '').trim();
      if (texto) request.nombresApellidos = texto;
      // En edición, si se borró la persona, se limpia el vínculo.
      if (this.esEdicion && this.data.movimiento?.idPersona) {
        request.idPersona = null;
      }
    }

    this.libretaService.guardarMovimiento(request).subscribe({
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
