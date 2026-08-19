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
import {
  ExtrasGastoTratamiento,
  ID_TIPO_CALCULO_GASTO_TRATAMIENTO,
  TipoCalculoValorizacion,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

@Component({
  selector: 'app-gasto-tratamiento-form-dialog',
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
  templateUrl: './gasto-tratamiento-form-dialog.component.html',
  styleUrl: './gasto-tratamiento-form-dialog.component.scss',
})
export class GastoTratamientoFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<GastoTratamientoFormDialogComponent>,
  );

  guardando = false;
  columnas = ['numero', 'descripcion', 'base', 'unidad', 'escalador', 'estado', 'acciones'];

  // Estado propio del componente: permite pasar de "nuevo" a "edición" sin
  // depender de datos inyectados en el modal (igual que Entidad de Aporte).
  gastoEditando: TipoCalculoValorizacion<ExtrasGastoTratamiento> | null = null;

  get modoEdicion(): boolean {
    return !!this.gastoEditando;
  }

  form: FormGroup = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(150)]],
    base: [null as number | null, [Validators.required, Validators.min(0)]],
    unidad: ['', [Validators.required, Validators.maxLength(20)]],
    escalador: [0 as number | null, [Validators.min(0)]],
  });

  ngOnInit(): void {
    this.recargarTabla();
  }

  private recargarTabla(): void {
    this.parametricasService.cargarTipoCalculoValorizacion();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { descripcion } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar gasto de tratamiento'
          : 'Crear gasto de tratamiento',
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
      if (confirmado) this.persistir();
    });
  }

  private persistir(): void {
    this.guardando = true;
    const { descripcion, base, unidad, escalador } = this.form.getRawValue();

    const payload = {
      id: this.gastoEditando?.id,
      descripcion,
      idTipoCalculo: ID_TIPO_CALCULO_GASTO_TRATAMIENTO,
      extras: { base, unidad, escalador: escalador ?? 0 } as ExtrasGastoTratamiento,
    };

    const request$ = this.modoEdicion
      ? this.parametricasService.actualizarTipoCalculoValorizacion(payload)
      : this.parametricasService.crearTipoCalculoValorizacion(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.modoEdicion
            ? 'Gasto de tratamiento actualizado correctamente'
            : 'Gasto de tratamiento creado correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.guardando = false;
        // No cerramos el modal: la tabla vive adentro, solo limpiamos el
        // formulario para dejarlo listo para un nuevo registro.
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
  editar(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): void {
    this.gastoEditando = gasto;
    this.form.patchValue({
      descripcion: gasto.descripcion,
      base: gasto.extras?.base ?? null,
      unidad: gasto.extras?.unidad ?? '',
      escalador: gasto.extras?.escalador ?? 0,
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({ descripcion: '', base: null, unidad: '', escalador: 0 });
    this.gastoEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva un gasto de tratamiento, con confirmación previa */
  cambiarEstado(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): void {
    const accion = gasto.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: gasto.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${gasto.descripcion}"?`,
        confirmLabel: gasto.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: gasto.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoTipoCalculoValorizacion(gasto.id, !gasto.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${gasto.activo ? 'Desactivado' : 'Activado'} correctamente`,
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

  get gastos(): TipoCalculoValorizacion<ExtrasGastoTratamiento>[] {
    return [...this.parametricasService.gastosTratamiento()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoTipoCalculoValorizacion();
  }
}
