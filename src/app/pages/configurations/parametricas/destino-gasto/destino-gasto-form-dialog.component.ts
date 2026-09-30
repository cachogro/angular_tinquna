// src/app/pages/configurations/parametricas/destino-gasto/destino-gasto-form-dialog.component.ts
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { DestinoGasto } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

/** Mayúsculas, letras (con acentos/ñ), números y los caracteres
 *  especiales de negocio: " : - _ ' */
const CHARSET_NOMBRE = /^[A-ZÁÉÍÓÚÑÜ0-9":\-_' ]*$/;
const CARACTERES_INVALIDOS_NOMBRE = /[^A-ZÁÉÍÓÚÑÜ0-9":\-_' ]/g;

@Component({
  selector: 'app-destino-gasto-form-dialog',
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
  templateUrl: './destino-gasto-form-dialog.component.html',
  styleUrl: './destino-gasto-form-dialog.component.scss',
})
export class DestinoGastoFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  guardando = false;
  columnas = ['id', 'nombre', 'tipo', 'estado', 'acciones'];

  destinoEditando: DestinoGasto | null = null;

  get modoEdicion(): boolean {
    return !!this.destinoEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.maxLength(150),
        Validators.pattern(CHARSET_NOMBRE),
      ],
    ],
    esEgreso: [true, Validators.required],
  });

  ngOnInit(): void {
    this.parametricasService.cargarDestinosGastoAdmin();

    // Mayúsculas + solo caracteres permitidos, en vivo.
    this.form.get('nombre')?.valueChanges.subscribe((valor: string) => {
      if (typeof valor !== 'string') return;
      const limpio = valor
        .toUpperCase()
        .replace(CARACTERES_INVALIDOS_NOMBRE, '');
      if (limpio !== valor) {
        this.form.get('nombre')?.setValue(limpio, { emitEvent: false });
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
            ? 'Actualizar destino del gasto'
            : 'Crear destino del gasto',
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
    const { esEgreso } = this.form.getRawValue();

    // Un solo POST: con id actualiza (se envían todos los campos), sin id crea.
    this.parametricasService
      .guardarDestinoGasto({
        id: this.destinoEditando?.id,
        nombre,
        esEgreso,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Destino del gasto actualizado correctamente'
              : 'Destino del gasto creado correctamente',
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

  editar(destino: DestinoGasto): void {
    this.destinoEditando = destino;
    this.form.patchValue({
      nombre: destino.nombre,
      esEgreso: destino.esEgreso,
    });
  }

  limpiar(): void {
    this.form.reset({ nombre: '', esEgreso: true });
    this.destinoEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  cambiarEstado(destino: DestinoGasto): void {
    const activo = destino.activo !== false;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activo ? 'Desactivar' : 'Activar',
          message: `¿Confirmas ${activo ? 'desactivar' : 'activar'} "${destino.nombre}"?`,
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
          .cambiarEstadoDestinoGasto(destino.id, !activo)
          .subscribe({
            next: () =>
              this.snackBar.open(
                `${activo ? 'Desactivado' : 'Activado'} correctamente`,
                'Cerrar',
                { duration: 3000 },
              ),
            error: (err) =>
              this.snackBar.open(
                this.mensajeError(err, 'Ocurrió un error al cambiar el estado'),
                'Cerrar',
                { duration: 4000 },
              ),
          });
      });
  }

  /** Los 409 (nombre repetido) traen el mensaje listo; los de validación vienen como arreglo. */
  private mensajeError(err: any, porDefecto: string): string {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join(', ') : msg) ?? porDefecto;
  }

  get destinos(): DestinoGasto[] {
    return [...this.parametricasService.destinosGastoAdmin()].sort(
      (a, b) => b.id - a.id,
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoDestinosGastoAdmin();
  }
}
