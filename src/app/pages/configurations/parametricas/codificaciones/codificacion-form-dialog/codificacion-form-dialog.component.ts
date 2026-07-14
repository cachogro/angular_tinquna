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

import { Codificacion, Mineral } from '../../models/parametricas.models';
import { ParametricaDialogShellComponent } from '../../shared/parametrica-dialog-shell/parametrica-dialog-shell.component';
import { ParametricasService } from '../../../services/parametricas.service';

/** Datos que se le pasan al modal al abrirlo. Si viene `codificacion`, es edición */
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
  ],
  templateUrl: './codificacion-form-dialog.component.html',
})
export class CodificacionFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<CodificacionFormDialogComponent>);
  private readonly data = inject<CodificacionDialogData>(MAT_DIALOG_DATA, {
    optional: true,
  }) ?? {};

  minerales: Mineral[] = [];
  guardando = false;

  get modoEdicion(): boolean {
    return !!this.data.codificacion;
  }

  form: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(10)]],
    nombre: [{ value: '', disabled: true }, [Validators.required]],
    minerales: [[] as number[], [Validators.required]],
  });

  ngOnInit(): void {
    this.cargarMinerales();

    // Arma el "nombre" automáticamente según los minerales seleccionados
    this.form.get('minerales')!.valueChanges.subscribe((ids: number[]) => {
      const nombre = this.minerales
        .filter((m) => ids?.includes(m.id))
        .map((m) => m.descripcion.toUpperCase())
        .join(', ');
      this.form.get('nombre')!.setValue(nombre, { emitEvent: false });
    });
  }

  private cargarMinerales(): void {
    this.parametricasService.obtenerMinerales().subscribe({
      next: (data) => {
        this.minerales = data.filter((m) => m.activo !== false);

        if (this.modoEdicion) {
          this.form.patchValue({
            codigo: this.data.codificacion!.codigo,
            minerales: this.data.codificacion!.minerales.map((m) => m.id),
          });
        }
      },
      error: () =>
        this.snackBar.open('Error al cargar los minerales', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  /** Se ejecuta al hacer submit: primero confirma, luego persiste */
  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const codigo = this.form.get('codigo')!.value;
    const nombre = this.form.get('nombre')!.value;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion ? 'Actualizar codificación' : 'Crear codificación',
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
      this.modoEdicion && this.data.codificacion
        ? this.parametricasService.actualizarCodificacion({
            id: this.data.codificacion.id,
            codigo,
            nombre,
            minerales,
          })
        : this.parametricasService.crearCodificacion({ codigo, nombre, minerales });

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
        // Cierra el modal indicando que hubo cambios (por si el que abre
        // quiere reaccionar a esto, aunque la tabla ya se refresca sola
        // vía el signal del servicio)
        this.dialogRef.close(true);
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

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
