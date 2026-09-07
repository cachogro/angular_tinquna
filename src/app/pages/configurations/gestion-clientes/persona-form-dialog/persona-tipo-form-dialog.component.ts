// src/app/pages/configurations/gestion-clientes/persona-form-dialog/persona-tipo-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  GuardarPersonaTipoRequest,
  PersonaTipoCatalogo,
} from '../../models/persona.models';
import { PersonaService } from '../../services/persona.service';

/**
 * Alta rápida de un "tipo o rol" de persona (persona-tipo), pensada para
 * abrirse desde el formulario de persona cuando el que se necesita no está
 * en la lista. Solo crea (POST sin id); al cerrar devuelve el registro
 * creado para que el formulario que la abrió recargue el catálogo y lo
 * autoseleccione.
 */
@Component({
  selector: 'app-persona-tipo-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Nuevo tipo o rol</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="tipo-rol-form">
        <mat-form-field appearance="outline">
          <mat-label>Código</mat-label>
          <input matInput formControlName="codigo" maxlength="20" />
          <mat-hint>2 a 20 caracteres (ej. INT, CHOF)</mat-hint>
          @if (f.codigo.hasError('required') && f.codigo.touched) {
          <mat-error>Obligatorio</mat-error>
          }
          @if (f.codigo.hasError('minlength') && f.codigo.touched) {
          <mat-error>Mínimo 2 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="50" />
          <mat-hint>3 a 50 caracteres</mat-hint>
          @if (f.nombre.hasError('required') && f.nombre.touched) {
          <mat-error>Obligatorio</mat-error>
          }
          @if (f.nombre.hasError('minlength') && f.nombre.touched) {
          <mat-error>Mínimo 3 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descripción (opcional)</mat-label>
          <textarea
            matInput
            formControlName="descripcion"
            rows="2"
            maxlength="150"
          ></textarea>
          @if (f.descripcion.hasError('maxlength') && f.descripcion.touched) {
          <mat-error>Máximo 150 caracteres</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancelar()" [disabled]="guardando()">
        Cancelar
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="guardar()"
        [disabled]="guardando()"
      >
        @if (guardando()) {
        <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        <span>Guardando...</span>
        } @else {
        <span>Crear</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .tipo-rol-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 380px;
      }
      .btn-spinner {
        display: inline-block;
      }
      .btn-spinner ::ng-deep circle {
        stroke: currentColor;
      }
      @media (max-width: 480px) {
        .tipo-rol-form {
          min-width: 0;
        }
      }
    `,
  ],
})
export class PersonaTipoFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<PersonaTipoFormDialogComponent>,
  );
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);

  readonly form = new FormGroup({
    codigo: new FormControl('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(20),
    ]),
    nombre: new FormControl('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50),
    ]),
    descripcion: new FormControl('', [Validators.maxLength(150)]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    // El backend guarda en mayúsculas: lo reflejamos en vivo. El código además
    // no lleva espacios.
    this.form.controls.codigo.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const limpio = v.toUpperCase().replace(/\s+/g, '');
      if (limpio !== v) {
        this.form.controls.codigo.setValue(limpio, { emitEvent: false });
      }
    });
    for (const control of [
      this.form.controls.nombre,
      this.form.controls.descripcion,
    ]) {
      control.valueChanges.subscribe((v) => {
        if (typeof v !== 'string') return;
        const limpio = v.toUpperCase();
        if (limpio !== v) control.setValue(limpio, { emitEvent: false });
      });
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();
    const request: GuardarPersonaTipoRequest = {
      codigo: v.codigo!.trim(),
      nombre: v.nombre!.trim(),
    };
    const descripcion = v.descripcion?.trim();
    if (descripcion) request.descripcion = descripcion;

    this.personaService.guardarPersonaTipo(request).subscribe({
      next: (creado: PersonaTipoCatalogo) => {
        this.guardando.set(false);
        this.snackBar.open('Tipo o rol creado correctamente', 'Cerrar', {
          duration: 3000,
        });
        this.dialogRef.close(creado);
      },
      error: (err) => {
        this.guardando.set(false);
        const mensaje = err?.error?.message;
        this.snackBar.open(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo crear el tipo o rol'),
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }
}
