import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

import { Codificacion, Mineral } from '../models/parametricas.models';
import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { ParametricasService } from '../../services/parametricas.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';

export interface CodificacionDialogData {
  codificacion?: Codificacion;
}

@Component({
  selector: 'app-codificacion-form-dialog',
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
    ParametricaDialogShellComponent,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
  ],
  templateUrl: './codificacion-form-dialog.component.html',
  styleUrl: './codificacion-form-dialog.component.scss',
})
export class CodificacionFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<CodificacionFormDialogComponent>,
  );
  private readonly data =
    inject<CodificacionDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  minerales: Mineral[] = [];
  guardando = false;
  columnas = ['id', 'codigo', 'nombre', 'acciones'];

  // Ahora es estado propio del componente, no depende solo de `data`.
  // Así el mismo modal puede pasar de "nuevo" a "edición" y viceversa.
  codificacionEditando: Codificacion | null = null;

  get modoEdicion(): boolean {
    return !!this.codificacionEditando;
  }

  form: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(10)]],
    nombre: [{ value: '', disabled: true }, [Validators.required]],
    minerales: [[] as number[], [Validators.required]],
  });

  ngOnInit(): void {
    this.cargarMinerales();

    this.form.get('minerales')!.valueChanges.subscribe((ids: number[]) => {
      const nombre = this.minerales
        .filter((m) => ids?.includes(m.id))
        .map((m) => m.descripcion.toUpperCase())
        .join(', ');
      this.form.get('nombre')!.setValue(nombre, { emitEvent: false });
    });

    this.parametricasService.cargarCodificaciones();

    if (this.data.codificacion) {
      this.editar(this.data.codificacion);
    }
  }
  private cargarMinerales(): void {
    this.parametricasService.obtenerMinerales().subscribe({
      next: (data) => {
        this.minerales = data.filter((m) => m.activo !== false);
      },
      error: () =>
        this.snackBar.open('Error al cargar los minerales', 'Cerrar', {
          duration: 3000,
        }),
    });
  }
  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const codigo = this.form.get('codigo')!.value;
    const nombre = this.form.get('nombre')!.value;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar codificación'
          : 'Crear codificación',
        message: this.modoEdicion
          ? `¿Confirmas actualizar la codificación "${codigo}" con los minerales: ${nombre}?`
          : `¿Confirmas crear la codificación "${codigo}" con los minerales: ${nombre}?`,
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
    const { codigo, nombre, minerales } = this.form.getRawValue();
    const request$ =
      this.modoEdicion && this.codificacionEditando
        ? this.parametricasService.actualizarCodificacion({
            id: this.codificacionEditando.id,
            codigo,
            nombre,
            minerales,
          })
        : this.parametricasService.crearCodificacion({
            codigo,
            nombre,
            minerales,
          });
    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.modoEdicion
            ? 'Codificación actualizada correctamente'
            : 'Codificación creada correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.guardando = false;
        // Ya NO cerramos el modal: la tabla vive adentro, así que solo
        // limpiamos el formulario para dejarlo listo para un nuevo registro.
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
  editar(codificacion: Codificacion): void {
    this.codificacionEditando = codificacion;
    this.form.patchValue({
      codigo: codificacion.codigo,
      minerales: codificacion.minerales.map((m) => m.id),
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({ codigo: '', nombre: '', minerales: [] });
    this.codificacionEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  get codificaciones(): Codificacion[] {
    return this.parametricasService.codificaciones();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoCodificaciones();
  }
}
