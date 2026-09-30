// src/app/pages/configurations/parametricas/codificacion-lote/codificacion-lote-form-dialog.component.ts
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { CodificacionLoteParam } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

/** Código: mayúsculas y números (el back lo guarda en mayúsculas) */
const CHARSET_CODIGO = /^[A-Z0-9]*$/;
const CARACTERES_INVALIDOS_CODIGO = /[^A-Z0-9]/g;

@Component({
  selector: 'app-codificacion-lote-form-dialog',
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
  templateUrl: './codificacion-lote-form-dialog.component.html',
  styleUrl: './codificacion-lote-form-dialog.component.scss',
})
export class CodificacionLoteFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  guardando = false;
  columnas = ['id', 'codigo', 'nombre', 'correlativo', 'estado', 'acciones'];

  codificacionEditando: CodificacionLoteParam | null = null;

  get modoEdicion(): boolean {
    return !!this.codificacionEditando;
  }

  form: FormGroup = this.fb.group({
    codigo: [
      '',
      [
        Validators.required,
        Validators.maxLength(10),
        Validators.pattern(CHARSET_CODIGO),
      ],
    ],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
  });

  ngOnInit(): void {
    this.parametricasService.cargarCodificacionesLote();
    this.registrarSaneador(this.form.get('codigo')!, (v) =>
      v.toUpperCase().replace(CARACTERES_INVALIDOS_CODIGO, ''),
    );
  }

  /** Reescribe en vivo el valor de un control según la función de saneo */
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

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { codigo, nombre } = this.form.getRawValue();
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: this.modoEdicion
            ? 'Actualizar codificación de lote'
            : 'Crear codificación de lote',
          message: this.modoEdicion
            ? `¿Confirmas actualizar "${codigo} · ${nombre}"? Los promedios ya creados conservan su código de lote.`
            : `¿Confirmas crear "${codigo} · ${nombre}"? Su primer promedio será ${codigo}-0001.`,
          confirmLabel: this.modoEdicion ? 'Actualizar' : 'Crear',
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon: this.modoEdicion ? 'edit' : 'add_circle_outline',
        },
      })
      .afterClosed()
      .subscribe((confirmado: boolean) => {
        if (confirmado) this.persistir();
      });
  }

  private persistir(): void {
    this.guardando = true;
    const { codigo, nombre } = this.form.getRawValue();

    // Un solo POST: con id actualiza (solo código y nombre; el correlativo no
    // se toca), sin id crea con correlativo en 0.
    this.parametricasService
      .guardarCodificacionLote({
        id: this.codificacionEditando?.id,
        codigo,
        nombre: String(nombre).trim(),
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Codificación de lote actualizada correctamente'
              : 'Codificación de lote creada correctamente',
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

  editar(cod: CodificacionLoteParam): void {
    this.codificacionEditando = cod;
    this.form.patchValue({ codigo: cod.codigo, nombre: cod.nombre });
  }

  limpiar(): void {
    this.form.reset({ codigo: '', nombre: '' });
    this.codificacionEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  cambiarEstado(cod: CodificacionLoteParam): void {
    const accion = cod.activo ? 'desactivar' : 'activar';
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: cod.activo ? 'Desactivar' : 'Activar',
          message: `¿Confirmas ${accion} "${cod.codigo} · ${cod.nombre}"?`,
          confirmLabel: cod.activo ? 'Desactivar' : 'Activar',
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon: cod.activo ? 'toggle_off' : 'toggle_on',
        },
      })
      .afterClosed()
      .subscribe((confirmado: boolean) => {
        if (!confirmado) return;
        this.parametricasService
          .cambiarEstadoCodificacionLote(cod.id, !cod.activo)
          .subscribe({
            next: () =>
              this.snackBar.open(
                `${cod.activo ? 'Desactivada' : 'Activada'} correctamente`,
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

  /** Los 409 (código repetido) traen el mensaje listo; los de validación vienen como arreglo. */
  private mensajeError(err: any, porDefecto: string): string {
    const msg = err?.error?.message;
    return (Array.isArray(msg) ? msg.join(', ') : msg) ?? porDefecto;
  }

  get codificaciones(): CodificacionLoteParam[] {
    return [...this.parametricasService.codificacionesLote()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoCodificacionesLote();
  }
}
