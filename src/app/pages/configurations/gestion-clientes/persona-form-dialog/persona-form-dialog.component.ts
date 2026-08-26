// src/app/pages/configurations/gestion-clientes/persona-form-dialog/persona-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, forkJoin, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import {
  ActorProductivoMinero,
  GuardarPersonaRequest,
  PersonaCI,
  PersonaTipoCatalogo,
  TipoDocumentoCatalogo,
} from '../../models/persona.models';
import { PersonaService } from '../../services/persona.service';
import { ActorProductivoMineroFormDialogComponent } from '../../parametricas/actor-productivo-minero/actor-productivo-minero-form-dialog.component';

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
    MatAutocompleteModule,
    MatTooltipModule,
  ],
  templateUrl: './persona-form-dialog.component.html',
  styleUrl: './persona-form-dialog.component.scss',
})
export class PersonaFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PersonaFormDialogComponent>);
  private readonly data = inject<PersonaFormDialogData>(MAT_DIALOG_DATA);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly tiposPersonaCatalogo = signal<PersonaTipoCatalogo[]>([]);
  readonly tiposDocumentoCatalogo = signal<TipoDocumentoCatalogo[]>([]);
  readonly actoresMineroCatalogo = signal<ActorProductivoMinero[]>([]);
  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  get esEdicion(): boolean {
    return !!this.data.persona;
  }

  readonly form = new FormGroup({
    nombres: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    apellidoPaterno: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    apellidoMaterno: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    // Por defecto CI (id 1). En edición se sobreescribe con el valor real de la persona.
    idTipoDocumento: new FormControl<number | null>(1, [Validators.required]),
    numeroDocumento: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-Z0-9]+(-[A-Z0-9]+)?$/),
    ]),
    celular: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[0-9]{6,15}$/),
    ]),
    tiposPersona: new FormControl<number[]>(
      [],
      [Validators.required, this.minUnTipo],
    ),
    actorProductivoMinero: new FormControl<
      ActorProductivoMinero | string | null
    >(null),
  });

  /** Lista filtrada que se muestra en el autocomplete: al enfocar (valor vacío) muestra todo el catálogo */
  readonly actoresFiltrados$: Observable<ActorProductivoMinero[]> =
    combineLatest([
      this.form.controls.actorProductivoMinero.valueChanges.pipe(startWith('')),
      toObservable(this.actoresMineroCatalogo),
    ]).pipe(map(([valor, lista]) => this.filtrarActores(valor, lista)));

  /** true cuando lo tecleado/buscado no matchea ningún actor del catálogo:
   *  se usa para ofrecer ahí mismo el botón de registrar uno nuevo. */
  readonly actorSinResultados = toSignal(
    this.actoresFiltrados$.pipe(map((lista) => lista.length === 0)),
    { initialValue: false },
  );

  get f() {
    return this.form.controls;
  }

  private minUnTipo(control: AbstractControl): ValidationErrors | null {
    const value = control.value as number[] | null;
    return value && value.length > 0 ? null : { minSeleccion: true };
  }

  private filtrarActores(
    valor: ActorProductivoMinero | string | null,
    lista: ActorProductivoMinero[],
  ): ActorProductivoMinero[] {
    const texto = (typeof valor === 'string' ? valor : (valor?.nombre ?? ''))
      .trim()
      .toLowerCase();
    if (!texto) return lista;
    return lista.filter((actor) => actor.nombre.toLowerCase().includes(texto));
  }

  /** Usado por [displayWith] del mat-autocomplete para mostrar el nombre en el input */
  displayActor = (actor: ActorProductivoMinero | string | null): string => {
    if (!actor) return '';
    return typeof actor === 'string' ? actor : actor.nombre;
  };

  /** Abre el mismo diálogo de gestión de actores productivos mineros que hay
   *  en Parametrías, para registrar uno nuevo sin salir de este formulario.
   *  Al cerrar, recarga el catálogo para que el recién creado aparezca en
   *  la lista (no se autoselecciona: el usuario lo elige del autocomplete). */
  abrirRegistrarActor(): void {
    this.dialog
      .open(ActorProductivoMineroFormDialogComponent, {
        width: '900px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe(() => this.recargarActoresMinero());
  }

  private recargarActoresMinero(): void {
    this.personaService.getAllActoresMineros().subscribe({
      next: (data) => this.actoresMineroCatalogo.set(data),
      error: () => {},
    });
  }

  /** Mayúsculas, solo letras (con acentos/ñ) y espacios — sin números ni símbolos */
  private saneaSoloLetras(valor: string): string {
    return valor.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ ]/g, '');
  }

  /** Solo dígitos */
  private saneaSoloNumeros(valor: string): string {
    return valor.replace(/[^0-9]/g, '');
  }

  /** Mayúsculas, letras y números, con un único guion como separador
   *  (ej. 2878532-1T, 980790-1V, 4941597, E-10137653) */
  private saneaNumeroDocumento(valor: string): string {
    let limpio = valor.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const partes = limpio.split('-');
    if (partes.length > 2) {
      limpio = partes[0] + '-' + partes.slice(1).join('');
    }
    return limpio;
  }

  /** Suscribe un control para reescribir su valor en vivo según la función de saneo dada */
  private registrarSaneador(
    control: FormControl<string | null>,
    sanea: (valor: string) => string,
  ): void {
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = sanea(valor);
      if (limpio !== valor) {
        control.setValue(limpio, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.registrarSaneador(this.form.controls.nombres, (v) =>
      this.saneaSoloLetras(v),
    );
    this.registrarSaneador(this.form.controls.apellidoPaterno, (v) =>
      this.saneaSoloLetras(v),
    );
    this.registrarSaneador(this.form.controls.apellidoMaterno, (v) =>
      this.saneaSoloLetras(v),
    );
    this.registrarSaneador(this.form.controls.celular, (v) =>
      this.saneaSoloNumeros(v),
    );
    this.registrarSaneador(this.form.controls.numeroDocumento, (v) =>
      this.saneaNumeroDocumento(v),
    );

    forkJoin({
      tiposPersona: this.personaService.getAllPersonaTipo(),
      tiposDocumento: this.personaService.getAllTiposDocumento(),
      actoresMinero: this.personaService.getAllActoresMineros(),
    }).subscribe({
      next: ({ tiposPersona, tiposDocumento, actoresMinero }) => {
        this.tiposPersonaCatalogo.set(tiposPersona);
        this.tiposDocumentoCatalogo.set(tiposDocumento);
        this.actoresMineroCatalogo.set(actoresMinero);
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });

    if (this.data.persona) {
      const p = this.data.persona;
      this.form.patchValue({
        nombres: p.nombres,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
        idTipoDocumento: Number(p.idTipoDocumento),
        numeroDocumento: p.numeroDocumento,
        celular: p.celular,
        tiposPersona: p.personaTipos.map((pt) => pt.idPersonaTipo),
        actorProductivoMinero: p.actorProductivoMinero ?? null,
      });
      // patchValue no debería marcar el form como dirty, pero lo forzamos
      // explícitamente para que el chequeo de "sin cambios" en guardar() sea confiable.
      this.form.markAsPristine();
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revisa los campos marcados en rojo', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    if (this.esEdicion && this.form.pristine) {
      this.snackBar.open('No se detectaron cambios', 'Cerrar', {
        duration: 3000,
      });
      this.dialogRef.close();
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();

    const actorSeleccionado = v.actorProductivoMinero;
    // Si el usuario eligió un actor de la lista llega como objeto -> se manda su id.
    // Si el campo quedó vacío o con texto suelto (sin seleccionar opción), se limpia la relación
    // en edición, o simplemente no se envía al crear.
    const idActorProductivoMinero =
      actorSeleccionado && typeof actorSeleccionado === 'object'
        ? actorSeleccionado.id
        : this.esEdicion
          ? null
          : undefined;

    const request: GuardarPersonaRequest = {
      ...(this.data.persona ? { id: this.data.persona.id } : {}),
      nombres: v.nombres!,
      apellidoPaterno: v.apellidoPaterno!,
      apellidoMaterno: v.apellidoMaterno!,
      idTipoDocumento: v.idTipoDocumento!,
      numeroDocumento: v.numeroDocumento!,
      celular: v.celular!,
      tiposPersona: v.tiposPersona!,
      idActorProductivoMinero,
    };

    this.personaService.guardarPersona(request).subscribe({
      next: (resultado) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion
            ? 'Persona actualizada correctamente'
            : 'Persona creada correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(resultado);
      },
      error: (err) => {
        this.guardando.set(false);
        const mensaje =
          err?.error?.message ?? 'Ocurrió un error al guardar la persona';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 5000 });
      },
    });
  }
}
