// src/app/pages/configurations/gestion-clientes/persona-form-dialog/persona-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import {
  GuardarPersonaRequest,
  PersonaCI,
  PersonaTipoCatalogo,
  TipoDocumentoCatalogo,
} from '../../models/persona.models';
import { PersonaService } from '../../services/persona.service';

export interface PersonaFormDialogData {
  persona: PersonaCI | null; // null = crear, con valor = editar
}

@Component({
  selector: 'app-persona-form-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './persona-form-dialog.component.html',
  styleUrl: './persona-form-dialog.component.scss',
})
export class PersonaFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PersonaFormDialogComponent>);
  private readonly data = inject<PersonaFormDialogData>(MAT_DIALOG_DATA);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly tiposPersonaCatalogo = signal<PersonaTipoCatalogo[]>([]);
  readonly tiposDocumentoCatalogo = signal<TipoDocumentoCatalogo[]>([]);
  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  get esEdicion(): boolean {
    return !!this.data.persona;
  }

  readonly form = new FormGroup({
    nombres: new FormControl('', [Validators.required]),
    apellidoPaterno: new FormControl('', [Validators.required]),
    apellidoMaterno: new FormControl('', [Validators.required]),
    idTipoDocumento: new FormControl<string | null>(null, [Validators.required]),
    numeroDocumento: new FormControl('', [Validators.required]),
    celular: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{6,15}$/)]),
    tiposPersona: new FormControl<number[]>([], [Validators.required, this.minUnTipo]),
  });

  get f() {
    return this.form.controls;
  }

 private minUnTipo(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number[] | null;
  return value && value.length > 0 ? null : { minSeleccion: true };
}

  ngOnInit(): void {
    forkJoin({
      tiposPersona: this.personaService.getAllPersonaTipo(),
      tiposDocumento: this.personaService.getAllTiposDocumento(),
    }).subscribe({
      next: ({ tiposPersona, tiposDocumento }) => {
        this.tiposPersonaCatalogo.set(tiposPersona);
        this.tiposDocumentoCatalogo.set(tiposDocumento);
        this.cargandoCatalogos.set(false);
        console.log('xxxxxxx tiposDocumento',tiposDocumento)
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', { duration: 4000 });
      },
    });

    if (this.data.persona) {
      const p = this.data.persona;
      this.form.patchValue({
        nombres: p.nombres,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
        idTipoDocumento: String(p.idTipoDocumento),
        numeroDocumento: p.numeroDocumento,
        celular: p.celular,
        tiposPersona: p.personaTipos.map((pt) => pt.idPersonaTipo),
      });
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revisa los campos marcados en rojo', 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();

    const request: GuardarPersonaRequest = {
      ...(this.data.persona ? { id: this.data.persona.id } : {}),
      nombres: v.nombres!,
      apellidoPaterno: v.apellidoPaterno!,
      apellidoMaterno: v.apellidoMaterno!,
      idTipoDocumento: v.idTipoDocumento!,
      numeroDocumento: v.numeroDocumento!,
      celular: v.celular!,
      tiposPersona: v.tiposPersona!,
    };

    this.personaService.guardarPersona(request).subscribe({
      next: (resultado) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion ? 'Persona actualizada correctamente' : 'Persona creada correctamente',
          'Cerrar',
          { duration: 3000 }
        );
        this.dialogRef.close(resultado);
      },
      error: (err) => {
        this.guardando.set(false);
        const mensaje = err?.error?.message ?? 'Ocurrió un error al guardar la persona';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 5000 });
      },
    });
  }
}
