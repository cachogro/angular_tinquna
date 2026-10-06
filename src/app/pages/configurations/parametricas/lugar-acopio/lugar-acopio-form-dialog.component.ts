import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { LugarAcopio } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

/** Mayúsculas, letras (con acentos/ñ), números, espacios y .- */
const CHARSET_DESCRIPCION = /^[A-ZÁÉÍÓÚÑÜ0-9 .-]*$/;
const CARACTERES_INVALIDOS_DESCRIPCION = /[^A-ZÁÉÍÓÚÑÜ0-9 .-]/g;

@Component({
  selector: 'app-lugar-acopio-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
    ParametricaDialogShellComponent,
  ],
  templateUrl: './lugar-acopio-form-dialog.component.html',
  styleUrl: './lugar-acopio-form-dialog.component.scss',
})
export class LugarAcopioFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  guardando = false;
  columnas = ['id', 'descripcion', 'estado', 'acciones'];

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender de datos inyectados en el modal.
  lugarEditando: LugarAcopio | null = null;

  get modoEdicion(): boolean {
    return !!this.lugarEditando;
  }

  form: FormGroup = this.fb.group({
    descripcion: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        Validators.pattern(CHARSET_DESCRIPCION),
      ],
    ],
  });

  ngOnInit(): void {
    this.parametricasService.cargarLugaresAcopio();

    // Reescribe el valor en vivo: mayúsculas + solo caracteres permitidos.
    const control = this.form.get('descripcion')!;
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = valor
        .toUpperCase()
        .replace(CARACTERES_INVALIDOS_DESCRIPCION, '');
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
    const descripcion = this.descripcionLimpia();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar lugar de acopio'
          : 'Crear lugar de acopio',
        message: this.modoEdicion
          ? `¿Confirmas actualizar "${descripcion}"?`
          : `¿Confirmas crear "${descripcion}"?`,
        confirmLabel: this.modoEdicion ? 'Actualizar' : 'Crear',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: this.modoEdicion ? 'edit' : 'add_circle_outline',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.persistir();
      }
    });
  }

  private descripcionLimpia(): string {
    return (this.form.getRawValue().descripcion as string).trim();
  }

  private persistir(): void {
    this.guardando = true;

    // Un solo POST: si hay lugar en edición, se manda su id y el back
    // actualiza; si no, lo crea.
    this.parametricasService
      .guardarLugarAcopio({
        id: this.lugarEditando?.id,
        descripcion: this.descripcionLimpia(),
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Lugar de acopio actualizado correctamente'
              : 'Lugar de acopio creado correctamente',
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
  editar(lugar: LugarAcopio): void {
    this.lugarEditando = lugar;
    this.form.patchValue({ descripcion: lugar.descripcion });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({ descripcion: '' });
    this.lugarEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva un lugar de acopio, con confirmación previa */
  cambiarEstado(lugar: LugarAcopio): void {
    const accion = lugar.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: lugar.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${lugar.descripcion}"?`,
        confirmLabel: lugar.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: lugar.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoLugarAcopio(lugar.id, !lugar.activo)
        .subscribe({
          next: () => {
            this.snackBar.open(
              `${lugar.activo ? 'Desactivado' : 'Activado'} correctamente`,
              'Cerrar',
              { duration: 3000 },
            );
            if (this.lugarEditando?.id === lugar.id) this.limpiar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'Ocurrió un error al cambiar el estado',
              'Cerrar',
              { duration: 4000 },
            ),
        });
    });
  }

  get lugares(): LugarAcopio[] {
    return this.parametricasService.lugaresAcopio();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoLugaresAcopio();
  }
}
