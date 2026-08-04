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
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { Laboratorio } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

@Component({
  selector: 'app-laboratorio-form-dialog',
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
  templateUrl: './laboratorio-form-dialog.component.html',
  styleUrl: './laboratorio-form-dialog.component.scss',
})
export class LaboratorioFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<LaboratorioFormDialogComponent>,
  );

  guardando = false;
  columnas = ['id', 'nombre', 'direccion', 'telefono', 'estado', 'acciones'];

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender de datos inyectados en el modal.
  laboratorioEditando: Laboratorio | null = null;

  get modoEdicion(): boolean {
    return !!this.laboratorioEditando;
  }

  // Dirección y teléfono son opcionales según lo definido por el back.
  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    direccion: ['', [Validators.maxLength(200)]],
    telefono: ['', [Validators.maxLength(20)]],
  });

  ngOnInit(): void {
    this.recargarTabla();
  }

  private recargarTabla(): void {
    // Máximo ~10 laboratorios esperados: se listan todos sin paginación.
    this.parametricasService.cargarLaboratorios();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion ? 'Actualizar laboratorio' : 'Crear laboratorio',
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
      if (confirmado) {
        this.persistir();
      }
    });
  }

  private persistir(): void {
    this.guardando = true;
    const { nombre, direccion, telefono } = this.form.getRawValue();

    // Un solo POST: si hay laboratorio en edición, se manda su id y el back
    // actualiza; si no, lo crea.
    this.parametricasService
      .guardarLaboratorio({
        id: this.laboratorioEditando?.id,
        nombre,
        direccion: direccion?.trim() || undefined,
        telefono: telefono?.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Laboratorio actualizado correctamente'
              : 'Laboratorio creado correctamente',
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
  editar(laboratorio: Laboratorio): void {
    this.laboratorioEditando = laboratorio;
    this.form.patchValue({
      nombre: laboratorio.nombre,
      direccion: laboratorio.direccion ?? '',
      telefono: laboratorio.telefono ?? '',
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      nombre: '',
      direccion: '',
      telefono: '',
    });
    this.laboratorioEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva un laboratorio, con confirmación previa */
  cambiarEstado(laboratorio: Laboratorio): void {
    const accion = laboratorio.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: laboratorio.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${laboratorio.nombre}"?`,
        confirmLabel: laboratorio.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: laboratorio.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoLaboratorio(laboratorio.id, !laboratorio.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${laboratorio.activo ? 'Desactivado' : 'Activado'} correctamente`,
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

  get laboratorios(): Laboratorio[] {
    return [...this.parametricasService.laboratorios()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoLaboratorios();
  }
}
