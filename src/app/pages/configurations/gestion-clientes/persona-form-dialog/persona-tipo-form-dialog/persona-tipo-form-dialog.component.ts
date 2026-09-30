// src/app/pages/configurations/gestion-clientes/persona-form-dialog/persona-tipo-form-dialog/persona-tipo-form-dialog.component.ts
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
} from '../../../models/persona.models';
import { PersonaService } from '../../../services/persona.service';

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
  templateUrl: './persona-tipo-form-dialog.component.html',
  styleUrl: './persona-tipo-form-dialog.component.scss',
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
