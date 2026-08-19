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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import {
  ExtrasPenalidad,
  ID_TIPO_CALCULO_PENALIDAD,
  TipoCalculoValorizacion,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

@Component({
  selector: 'app-penalidad-form-dialog',
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
  templateUrl: './penalidad-form-dialog.component.html',
  styleUrl: './penalidad-form-dialog.component.scss',
})
export class PenalidadFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<PenalidadFormDialogComponent>);

  guardando = false;
  columnas = [
    'numero',
    'descripcion',
    'leyLibre',
    'cada',
    'cargo',
    'estado',
    'acciones',
  ];

  // Unidades fijas de ley, igual que en la valorización (ver LEY_UNIDADES).
  readonly unidadesLey = ['%', 'g/TM'];

  // Estado propio del componente: permite pasar de "nuevo" a "edición" sin
  // depender de datos inyectados en el modal (igual que Entidad de Aporte).
  penalidadEditando: TipoCalculoValorizacion<ExtrasPenalidad> | null = null;

  get modoEdicion(): boolean {
    return !!this.penalidadEditando;
  }

  form: FormGroup = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(50)]],
    leyLibre: [null as number | null, [Validators.required, Validators.min(0)]],
    unidadLey: ['%', [Validators.required]],
    cada: [null as number | null, [Validators.required, Validators.min(0.0001)]],
    cargo: [null as number | null, [Validators.required, Validators.min(0)]],
    unidadCargo: ['', [Validators.required, Validators.maxLength(20)]],
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
        title: this.modoEdicion ? 'Actualizar penalidad' : 'Crear penalidad',
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
    const { descripcion, leyLibre, unidadLey, cada, cargo, unidadCargo } =
      this.form.getRawValue();

    const payload = {
      id: this.penalidadEditando?.id,
      descripcion,
      idTipoCalculo: ID_TIPO_CALCULO_PENALIDAD,
      extras: { leyLibre, unidadLey, cada, cargo, unidadCargo } as ExtrasPenalidad,
    };

    const request$ = this.modoEdicion
      ? this.parametricasService.actualizarTipoCalculoValorizacion(payload)
      : this.parametricasService.crearTipoCalculoValorizacion(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.modoEdicion
            ? 'Penalidad actualizada correctamente'
            : 'Penalidad creada correctamente',
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
  editar(penalidad: TipoCalculoValorizacion<ExtrasPenalidad>): void {
    this.penalidadEditando = penalidad;
    this.form.patchValue({
      descripcion: penalidad.descripcion,
      leyLibre: penalidad.extras?.leyLibre ?? null,
      unidadLey: penalidad.extras?.unidadLey ?? '%',
      cada: penalidad.extras?.cada ?? null,
      cargo: penalidad.extras?.cargo ?? null,
      unidadCargo: penalidad.extras?.unidadCargo ?? '',
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      descripcion: '',
      leyLibre: null,
      unidadLey: '%',
      cada: null,
      cargo: null,
      unidadCargo: '',
    });
    this.penalidadEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva una penalidad, con confirmación previa */
  cambiarEstado(penalidad: TipoCalculoValorizacion<ExtrasPenalidad>): void {
    const accion = penalidad.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: penalidad.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${penalidad.descripcion}"?`,
        confirmLabel: penalidad.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: penalidad.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoTipoCalculoValorizacion(penalidad.id, !penalidad.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${penalidad.activo ? 'Desactivada' : 'Activada'} correctamente`,
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

  get penalidades(): TipoCalculoValorizacion<ExtrasPenalidad>[] {
    return [...this.parametricasService.penalidadesValorizacion()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoTipoCalculoValorizacion();
  }
}
