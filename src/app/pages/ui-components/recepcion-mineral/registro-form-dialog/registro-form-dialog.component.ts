// src/app/pages/ui-components/recepcion-mineral/registro-form-dialog/registro-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, forkJoin, map, startWith } from 'rxjs';
import { PersonaCI } from 'src/app/pages/configurations/models/persona.models';
import { PersonaService } from 'src/app/pages/configurations/services/persona.service';
import {
  CodificacionCatalogo,
  GuardarRegistroMineralRequest,
  RegistroMineral,
} from '../../models/registro-mineral.models';
import { RegistroMineralService } from '../../services/registro-mineral.service';

const ID_TIPO_PERSONA_PROVEEDOR = 1;

export interface RegistroFormDialogData {
  registro: RegistroMineral | null; // null = crear, con valor = editar
}

@Component({
  selector: 'app-registro-form-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './registro-form-dialog.component.html',
  styleUrl: './registro-form-dialog.component.scss',
})
export class RegistroFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<RegistroFormDialogComponent>,
  );
  private readonly data = inject<RegistroFormDialogData>(MAT_DIALOG_DATA);
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  readonly proveedores = signal<PersonaCI[]>([]);
  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  get esEdicion(): boolean {
    return !!this.data.registro;
  }

  readonly form = new FormGroup({
    idCodificacion: new FormControl<string | null>(null, [Validators.required]),
    numeroSacos: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    pesoNeto: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.001),
    ]),
    ley: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    anticipo: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
    ]),
    totalValorBruto: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    fechaOperacion: new FormControl<Date | null>(new Date(), [
      Validators.required,
    ]),
    observaciones: new FormControl(''),
  });

  /** Control independiente para el autocomplete: guarda el objeto PersonaCI
   *  completo cuando se selecciona una opción, o el texto libre mientras se
   *  escribe. El id real que se envía al backend sale de aquí, no del form. */

  readonly proveedorControl = new FormControl<PersonaCI | string | null>(null, [
    Validators.required,
    this.proveedorValidoValidator,
  ]);

  filtroProveedores!: Observable<PersonaCI[]>;

  /** Un valor válido de proveedor debe ser un objeto PersonaCI (seleccionado
   *  de la lista), no un texto libre que el usuario dejó escrito sin elegir. */
  private proveedorValidoValidator(control: AbstractControl) {
    const valor = control.value;
    if (!valor) return { required: true };
    return typeof valor === 'object' ? null : { proveedorInvalido: true };
  }

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    forkJoin({
      codificaciones: this.registroMineralService.getAllCodificaciones(),


      proveedores: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        idTipoPersona: ID_TIPO_PERSONA_PROVEEDOR,
        activo: true,
      }),
    }).subscribe({
      next: ({ codificaciones, proveedores }) => {
        console.log('Respuesta completa proveedores:', proveedores);
    console.log('Array de proveedores:', proveedores.data);
        this.codificaciones.set(codificaciones);
        this.proveedores.set(proveedores.data);
        this.cargandoCatalogos.set(false);

        // Preselecciona el proveedor recién que la lista está disponible
        if (this.data.registro) {
          const encontrado = proveedores.data.find(
            (p) => p.id === this.data.registro!.idPersona,
          );
          this.proveedorControl.setValue(encontrado ?? null);
        }
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });


    console.log('proveedoress',this.proveedores)

    this.filtroProveedores = this.proveedorControl.valueChanges.pipe(
      startWith(''),
      map((valor) => {
        const texto =
          typeof valor === 'string' ? valor : this.displayProveedor(valor);
        return this.filtrarProveedores(texto);
      }),
    );

    console.log('dddddddddd', this.filtroProveedores)

    if (this.data.registro) {
      const r = this.data.registro;
      this.form.patchValue({
        idCodificacion: r.idCodificacion,
        numeroSacos: r.numeroSacos,
        pesoNeto: Number(r.pesoNeto),
        ley: Number(r.ley),
        anticipo: Number(r.anticipo),
        totalValorBruto: Number(r.totalValorBruto),
        fechaOperacion: r.fechaOperacion
          ? new Date(r.fechaOperacion)
          : new Date(),
        observaciones: r.observaciones ?? '',
      });
    }
  }

  displayProveedor = (persona: PersonaCI | string | null): string => {
    if (!persona || typeof persona === 'string') return persona ?? '';
    return `${this.nombreProveedor(persona)} — ${persona.numeroDocumento}`;
  };

  private filtrarProveedores(texto: string): PersonaCI[] {
    const busqueda = texto.trim().toLowerCase();
    if (!busqueda) return this.proveedores();

    return this.proveedores().filter((p) => {
      const nombreCompleto = this.nombreProveedor(p).toLowerCase();
      return (
        nombreCompleto.includes(busqueda) ||
        p.numeroDocumento.toLowerCase().includes(busqueda)
      );
    });
  }

  nombreProveedor(persona: PersonaCI): string {
    return `${persona.nombres} ${persona.apellidoPaterno} ${persona.apellidoMaterno}`.trim();
  }

  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid || this.proveedorControl.invalid) {
      this.form.markAllAsTouched();
      this.proveedorControl.markAsTouched();
      this.snackBar.open('Revisa los campos marcados en rojo', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();
    const proveedor = this.proveedorControl.value as PersonaCI;

    const request: GuardarRegistroMineralRequest = {
      ...(this.data.registro ? { id: this.data.registro.id } : {}),
      idCodificacion: v.idCodificacion!,
      idPersona: proveedor.id,
      numeroSacos: v.numeroSacos!,
      pesoNeto: v.pesoNeto!,
      ley: v.ley!,
      anticipo: v.anticipo!,
      totalValorBruto: v.totalValorBruto!,
      fechaOperacion: this.formatFecha(v.fechaOperacion!),
      observaciones: v.observaciones || undefined,
    };

    this.registroMineralService.guardarRegistro(request).subscribe({
      next: (resultado) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion
            ? 'Recepción actualizada correctamente'
            : 'Recepción registrada correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(resultado);
      },
      error: (err) => {
        this.guardando.set(false);
        const mensaje =
          err?.error?.message ?? 'Ocurrió un error al guardar la recepción';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 5000 });
      },
    });
  }
}
