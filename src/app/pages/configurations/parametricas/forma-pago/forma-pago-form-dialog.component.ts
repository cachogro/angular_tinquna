import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { FormaPago } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

/** Mayúsculas, números y guion bajo (sin espacios) */
const CHARSET_CODIGO = /^[A-Z0-9_]*$/;
const CARACTERES_INVALIDOS_CODIGO = /[^A-Z0-9_]/g;

/** Mayúsculas, letras (con acentos/ñ), números, espacios y .- */
const CHARSET_NOMBRE = /^[A-ZÁÉÍÓÚÑÜ0-9 .-]*$/;
const CARACTERES_INVALIDOS_NOMBRE = /[^A-ZÁÉÍÓÚÑÜ0-9 .-]/g;

@Component({
  selector: 'app-forma-pago-form-dialog',
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
  templateUrl: './forma-pago-form-dialog.component.html',
  styleUrl: './forma-pago-form-dialog.component.scss',
})
export class FormaPagoFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  guardando = false;
  columnas = ['id', 'codigo', 'nombre', 'afectaFondo', 'estado', 'acciones'];

  formaPagoEditando: FormaPago | null = null;

  get modoEdicion(): boolean {
    return !!this.formaPagoEditando;
  }

  form: FormGroup = this.fb.group({
    // Solo editable al crear: el sistema decide por código si la forma de
    // pago exige cuenta bancaria, así que el back no lo cambia después.
    codigo: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(20),
        Validators.pattern(CHARSET_CODIGO),
      ],
    ],
    nombre: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(40),
        Validators.pattern(CHARSET_NOMBRE),
      ],
    ],
    afectaFondo: [true, Validators.required],
  });

  ngOnInit(): void {
    this.parametricasService.cargarFormasPagoAdmin();

    this.registrarSaneador(this.form.get('codigo')!, (v) =>
      v.toUpperCase().replace(CARACTERES_INVALIDOS_CODIGO, ''),
    );
    this.registrarSaneador(this.form.get('nombre')!, (v) =>
      v.toUpperCase().replace(CARACTERES_INVALIDOS_NOMBRE, ''),
    );
  }

  /** Suscribe un control para reescribir su valor en vivo según la función de saneo dada */
  private registrarSaneador(
    control: AbstractControl,
    sanea: (valor: string) => string,
  ): void {
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = sanea(valor);
      if (limpio !== valor) {
        control.setValue(limpio, { emitEvent: false });
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const nombre = String(this.form.getRawValue().nombre).trim();
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: this.modoEdicion
            ? 'Actualizar forma de pago'
            : 'Crear forma de pago',
          message: this.modoEdicion
            ? `¿Confirmas actualizar "${nombre}"?`
            : `¿Confirmas crear "${nombre}"?`,
          confirmLabel: this.modoEdicion ? 'Actualizar' : 'Crear',
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon: this.modoEdicion ? 'edit' : 'add_circle_outline',
        },
      })
      .afterClosed()
      .subscribe((confirmado: boolean) => {
        if (confirmado) this.persistir(nombre);
      });
  }

  private persistir(nombre: string): void {
    this.guardando = true;
    // getRawValue incluye el código aunque esté deshabilitado en edición.
    const { codigo, afectaFondo } = this.form.getRawValue();

    // Un solo POST: con id actualiza, sin id crea.
    this.parametricasService
      .guardarFormaPago({
        id: this.formaPagoEditando?.id,
        codigo: String(codigo).trim(),
        nombre,
        afectaFondo,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Forma de pago actualizada correctamente'
              : 'Forma de pago creada correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          this.limpiar();
        },
        error: (err) => {
          this.snackBar.open(
            this.mensajeError(err, 'Ocurrió un error al guardar'),
            'Cerrar',
            { duration: 5000 },
          );
          this.guardando = false;
        },
      });
  }

  editar(formaPago: FormaPago): void {
    this.formaPagoEditando = formaPago;
    this.form.patchValue({
      codigo: formaPago.codigo,
      nombre: formaPago.nombre,
      afectaFondo: formaPago.afectaFondo !== false,
    });
    this.form.get('codigo')?.disable({ emitEvent: false });
  }

  limpiar(): void {
    this.form.get('codigo')?.enable({ emitEvent: false });
    this.form.reset({ codigo: '', nombre: '', afectaFondo: true });
    this.formaPagoEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  cambiarEstado(formaPago: FormaPago): void {
    const activo = formaPago.activo !== false;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activo ? 'Desactivar' : 'Activar',
          message: `¿Confirmas ${activo ? 'desactivar' : 'activar'} "${formaPago.nombre}"?`,
          confirmLabel: activo ? 'Desactivar' : 'Activar',
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon: activo ? 'toggle_off' : 'toggle_on',
        },
      })
      .afterClosed()
      .subscribe((confirmado: boolean) => {
        if (!confirmado) return;
        this.parametricasService
          .cambiarEstadoFormaPago(formaPago.id, !activo)
          .subscribe({
            next: () => {
              this.snackBar.open(
                `${activo ? 'Desactivada' : 'Activada'} correctamente`,
                'Cerrar',
                { duration: 3000 },
              );
              if (this.formaPagoEditando?.id === formaPago.id) this.limpiar();
            },
            error: (err) =>
              this.snackBar.open(
                this.mensajeError(err, 'Ocurrió un error al cambiar el estado'),
                'Cerrar',
                { duration: 4000 },
              ),
          });
      });
  }

  /** Los 409 (código repetido) traen el mensaje listo; los de validación vienen como arreglo. */
  private mensajeError(err: any, porDefecto: string): string {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join(', ') : msg) ?? porDefecto;
  }

  get formasPago(): FormaPago[] {
    return this.parametricasService.formasPagoAdmin();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoFormasPagoAdmin();
  }
}
