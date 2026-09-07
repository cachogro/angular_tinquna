import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import {
  CuentaFinanciera,
  EntidadFinanciera,
  GuardarCuentaFinancieraRequest,
  MonedaCuenta,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

/** Mayúsculas, letras (con acentos/ñ), números, espacio y . - & */
const CARACTERES_INVALIDOS_NOMBRE = /[^A-ZÁÉÍÓÚÑÜ0-9 .\-&]/g;
/** Mayúsculas y números (sin espacios) */
const CARACTERES_INVALIDOS_SIGLA = /[^A-Z0-9]/g;
/** Solo dígitos */
const CARACTERES_INVALIDOS_NUMERO_CUENTA = /[^0-9]/g;

interface FilaCuentaRaw {
  id: number | null;
  numeroCuenta: string;
  moneda: MonedaCuenta | null;
  alias: string;
  activo: boolean;
  // Se conservan tal cual vienen del back para no perderlos al editar la
  // entidad (el saldo inicial se configura desde Contabilidad › Libreta).
  saldoInicial: number | null;
  fechaSaldoInicial: string | null;
}

@Component({
  selector: 'app-entidad-financiera-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
    ParametricaDialogShellComponent,
  ],
  templateUrl: './entidad-financiera-form-dialog.component.html',
  styleUrl: './entidad-financiera-form-dialog.component.scss',
})
export class EntidadFinancieraFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<EntidadFinancieraFormDialogComponent>,
  );

  guardando = false;
  columnas = ['id', 'nombre', 'sigla', 'cuentas', 'estado', 'acciones'];

  readonly monedas: MonedaCuenta[] = ['BOB', 'USD'];

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender de datos inyectados en el modal.
  entidadEditando: EntidadFinanciera | null = null;

  get modoEdicion(): boolean {
    return !!this.entidadEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: [
      '',
      [Validators.required, Validators.maxLength(120)],
    ],
    sigla: ['', [Validators.required, Validators.maxLength(10)]],
    cuentas: this.fb.array([], this.sinNumerosCuentaRepetidos),
  });

  get cuentas(): FormArray {
    return this.form.get('cuentas') as FormArray;
  }

  ngOnInit(): void {
    this.recargarTabla();

    this.registrarSaneador(this.form.get('nombre')!, (v) =>
      v.toUpperCase().replace(CARACTERES_INVALIDOS_NOMBRE, ''),
    );
    this.registrarSaneador(this.form.get('sigla')!, (v) =>
      v.toUpperCase().replace(CARACTERES_INVALIDOS_SIGLA, ''),
    );

    // Arranca con una fila de cuenta lista para llenar.
    this.agregarCuenta();
  }

  private recargarTabla(): void {
    this.parametricasService.cargarEntidadesFinancieras();
  }

  // ---------- Cuentas (FormArray) ----------

  private crearFilaCuenta(cuenta?: CuentaFinanciera): FormGroup {
    const fila = this.fb.group({
      id: [cuenta?.id ?? null],
      numeroCuenta: [
        cuenta?.numeroCuenta ?? '',
        [Validators.required, Validators.maxLength(30)],
      ],
      moneda: [cuenta?.moneda ?? null, [Validators.required]],
      alias: [cuenta?.alias ?? '', [Validators.maxLength(60)]],
      activo: [cuenta?.activo ?? true],
      saldoInicial: [
        cuenta?.saldoInicial != null ? Number(cuenta.saldoInicial) : null,
      ],
      fechaSaldoInicial: [cuenta?.fechaSaldoInicial ?? null],
    });
    this.registrarSaneador(fila.get('numeroCuenta')!, (v) =>
      v.replace(CARACTERES_INVALIDOS_NUMERO_CUENTA, ''),
    );
    return fila;
  }

  agregarCuenta(): void {
    this.cuentas.push(this.crearFilaCuenta());
  }

  /** Solo para filas nuevas (sin id): las existentes se dan de baja con el toggle. */
  quitarCuenta(indice: number): void {
    this.cuentas.removeAt(indice);
    if (this.cuentas.length === 0) this.agregarCuenta();
  }

  esCuentaNueva(indice: number): boolean {
    return !this.cuentas.at(indice).get('id')?.value;
  }

  /** Activa/desactiva una cuenta ya guardada (endpoint propio de la cuenta). */
  toggleEstadoCuenta(indice: number): void {
    const fila = this.cuentas.at(indice) as FormGroup;
    const id = fila.get('id')?.value as number | null;
    if (!id) return;
    const activoActual = !!fila.get('activo')?.value;

    this.parametricasService
      .cambiarEstadoCuentaFinanciera(id, !activoActual)
      .subscribe({
        next: () => {
          fila.get('activo')?.setValue(!activoActual);
          this.snackBar.open(
            `Cuenta ${!activoActual ? 'activada' : 'desactivada'} correctamente`,
            'Cerrar',
            { duration: 3000 },
          );
        },
        error: (err) =>
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cambiar el estado de la cuenta',
            'Cerrar',
            { duration: 4000 },
          ),
      });
  }

  /** Marca error en el FormArray si hay dos cuentas con el mismo número. */
  private sinNumerosCuentaRepetidos(
    control: AbstractControl,
  ): ValidationErrors | null {
    const filas = (control as FormArray).controls;
    const numeros = filas
      .map((f) => (f.get('numeroCuenta')?.value ?? '').trim())
      .filter((n) => n.length > 0);
    const hayRepetido = new Set(numeros).size !== numeros.length;
    return hayRepetido ? { cuentasDuplicadas: true } : null;
  }

  // ---------- Saneador genérico ----------

  private registrarSaneador(
    control: AbstractControl,
    sanea: (valor: string) => string,
  ): void {
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = sanea(valor);
      if (limpio !== valor) control.setValue(limpio, { emitEvent: false });
    });
  }

  // ---------- Guardar ----------

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.cuentas.hasError('cuentasDuplicadas')) {
        this.snackBar.open(
          'Hay dos cuentas con el mismo número',
          'Cerrar',
          { duration: 3000 },
        );
      }
      return;
    }
    const { nombre } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar entidad financiera'
          : 'Crear entidad financiera',
        message: this.modoEdicion
          ? `¿Confirmas actualizar "${nombre}"?`
          : `¿Confirmas crear "${nombre}"?`,
        confirmLabel: this.modoEdicion ? 'Actualizar' : 'Crear',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: this.modoEdicion ? 'edit' : 'add_circle_outline',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) this.persistir();
    });
  }

  private persistir(): void {
    this.guardando = true;
    const { nombre, sigla, cuentas } = this.form.getRawValue() as {
      nombre: string;
      sigla: string;
      cuentas: FilaCuentaRaw[];
    };

    // Solo se envían filas con número cargado. `activo` no va en el payload
    // (se maneja con el endpoint cambiar_estado de la cuenta).
    const cuentasPayload: GuardarCuentaFinancieraRequest[] = cuentas
      .filter((c) => c.numeroCuenta?.trim())
      .map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        numeroCuenta: c.numeroCuenta.trim(),
        moneda: c.moneda as MonedaCuenta,
        ...(c.alias?.trim() ? { alias: c.alias.trim() } : {}),
        ...(c.saldoInicial != null
          ? { saldoInicial: Number(c.saldoInicial) }
          : {}),
        ...(c.fechaSaldoInicial
          ? { fechaSaldoInicial: c.fechaSaldoInicial }
          : {}),
      }));

    this.parametricasService
      .guardarEntidadFinanciera({
        id: this.entidadEditando?.id,
        nombre: nombre.trim(),
        sigla: sigla.trim(),
        ...(cuentasPayload.length ? { cuentas: cuentasPayload } : {}),
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Entidad financiera actualizada correctamente'
              : 'Entidad financiera creada correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          // No cerramos el modal: la tabla vive adentro, solo limpiamos
          // el formulario para dejarlo listo para un nuevo registro.
          this.limpiar();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message ?? 'Ocurrió un error al guardar',
            'Cerrar',
            { duration: 4000 },
          );
          this.guardando = false;
        },
      });
  }

  /** Pone el formulario en modo edición con los datos de la fila seleccionada */
  editar(entidad: EntidadFinanciera): void {
    this.entidadEditando = entidad;
    this.form.patchValue({ nombre: entidad.nombre, sigla: entidad.sigla });

    this.cuentas.clear();
    (entidad.cuentas ?? []).forEach((c) =>
      this.cuentas.push(this.crearFilaCuenta(c)),
    );
    if (this.cuentas.length === 0) this.agregarCuenta();
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({ nombre: '', sigla: '' });
    this.cuentas.clear();
    this.agregarCuenta();
    this.entidadEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva una entidad financiera, con confirmación previa */
  cambiarEstado(entidad: EntidadFinanciera): void {
    const accion = entidad.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: entidad.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${entidad.nombre}"?`,
        confirmLabel: entidad.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: entidad.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoEntidadFinanciera(entidad.id, !entidad.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${entidad.activo ? 'Desactivada' : 'Activada'} correctamente`,
              'Cerrar',
              { duration: 3000 },
            ),
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'Ocurrió un error al cambiar el estado',
              'Cerrar',
              { duration: 4000 },
            ),
        });
    });
  }

  get entidadesFinancieras(): EntidadFinanciera[] {
    // Ordenadas por id ascendente para que la columna ID quede correlativa.
    return [...this.parametricasService.entidadesFinancieras()].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoEntidadesFinancieras();
  }
}
