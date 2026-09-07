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
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import { PersonaTipoFormDialogComponent } from './persona-tipo-form-dialog.component';

export interface PersonaFormDialogData {
  persona: PersonaCI | null; // null = crear, con valor = editar
  /** Solo al crear: precarga este actor productivo en el formulario
   *  (p.ej. cuando se agrega una persona desde la ficha de un actor). */
  actorPreseleccionado?: ActorProductivoMinero;
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
    MatDatepickerModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
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

  /** Tope del datepicker de nacimiento: nadie nace en el futuro */
  readonly hoy = new Date();

  /** true cuando el actor productivo minero elegido es la propia empresa
   *  (id 1, "TINKURIKUNA"): se pide el registro completo de personal. */
  readonly esRegistroPersonalEmpresa = signal(false);

  get esEdicion(): boolean {
    return !!this.data.persona;
  }

  readonly form = new FormGroup({
    // El actor productivo minero va primero y es OPCIONAL: hay clientes sueltos
    // que no pertenecen a ningún actor. Cuando se elige el de la propia empresa
    // (id 1) se pide además el registro completo de personal.
    actorProductivoMinero: new FormControl<ActorProductivoMinero | string | null>(
      null,
    ),
    nombres: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    apellidoPaterno: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    // Opcional: hay personas sin segundo apellido. Si se escribe, debe ser válido.
    apellidoMaterno: new FormControl('', [
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    // Por defecto CI (id 1). En edición se sobreescribe con el valor real de la persona.
    idTipoDocumento: new FormControl<number | null>(1, [Validators.required]),
    numeroDocumento: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-Z0-9]+(-[A-Z0-9]+)?$/),
    ]),
    // Opcional: no todos los registros traen celular. Si se escribe, debe ser válido.
    celular: new FormControl('', [Validators.pattern(/^[0-9]{6,15}$/)]),
    tiposPersona: new FormControl<number[]>(
      [],
      [Validators.required, this.minUnTipo],
    ),
    // Solo se validan/envían cuando el actor es la propia empresa (ver
    // aplicarValidadoresRegistroEmpresa). "YYYY-MM-DD" al guardar.
    fechaNacimiento: new FormControl<Date | null>(null),
    fechaInicioLaboral: new FormControl<Date | null>(null),
    direccion: new FormControl(''),
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

  /** true si hay un actor productivo minero realmente elegido de la lista
   *  (objeto), no texto suelto ni vacío. */
  get hayActorSeleccionado(): boolean {
    const v = this.form.controls.actorProductivoMinero.value;
    return !!v && typeof v === 'object';
  }

  /** Deja el registro sin actor productivo minero ("ninguno"). */
  limpiarActor(): void {
    this.form.controls.actorProductivoMinero.setValue(null);
    this.form.controls.actorProductivoMinero.markAsDirty();
  }

  /** true si el actor es la propia empresa: id 1 y nombre "TINKURIKUNA". */
  private esActorMismaEmpresa(
    actor: ActorProductivoMinero | string | null,
  ): boolean {
    return (
      !!actor &&
      typeof actor === 'object' &&
      String(actor.id) === '1' &&
      (actor.nombre ?? '').trim().toUpperCase() === 'TINKURIKUNA'
    );
  }

  /** Activa/desactiva los campos extra (fecha nacimiento, inicio laboral y
   *  dirección) según si el actor elegido es la propia empresa. */
  private aplicarValidadoresRegistroEmpresa(esEmpresa: boolean): void {
    this.esRegistroPersonalEmpresa.set(esEmpresa);
    const validadores = esEmpresa ? [Validators.required] : [];
    const { fechaNacimiento, fechaInicioLaboral, direccion } = this.form.controls;

    fechaNacimiento.setValidators(validadores);
    fechaInicioLaboral.setValidators(validadores);
    direccion.setValidators(validadores);

    if (!esEmpresa) {
      fechaNacimiento.reset(null, { emitEvent: false });
      fechaInicioLaboral.reset(null, { emitEvent: false });
      direccion.reset('', { emitEvent: false });
    }

    fechaNacimiento.updateValueAndValidity({ emitEvent: false });
    fechaInicioLaboral.updateValueAndValidity({ emitEvent: false });
    direccion.updateValueAndValidity({ emitEvent: false });
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
        width: '1100px',
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

  /** Alta rápida de un tipo o rol de persona cuando el que se necesita no
   *  está en la lista. Al cerrar, recarga el catálogo (forzando la caché) y
   *  autoselecciona el recién creado en el multiselect. */
  abrirCrearTipoRol(): void {
    this.dialog
      .open(PersonaTipoFormDialogComponent, {
        width: '460px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((creado?: PersonaTipoCatalogo) => {
        if (!creado) return;
        this.personaService.getAllPersonaTipo(true).subscribe({
          next: (tipos) => {
            this.tiposPersonaCatalogo.set(tipos);
            const actuales = this.form.controls.tiposPersona.value ?? [];
            if (!actuales.includes(creado.id)) {
              this.form.controls.tiposPersona.setValue([
                ...actuales,
                creado.id,
              ]);
              this.form.controls.tiposPersona.markAsDirty();
            }
          },
          error: () => {},
        });
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

  /** Mayúsculas, letras (con acentos/ñ), números, espacio y los caracteres
   *  de dirección: # / ° ' " . , - _ */
  private saneaDireccion(valor: string): string {
    return valor.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ0-9#/°'".,_\- ]/g, '');
  }

  /** Date -> "YYYY-MM-DD" con las partes locales (sin corrimiento por zona horaria) */
  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /** "YYYY-MM-DD" (u otra fecha ISO) -> Date local, o null si no hay valor */
  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
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
    this.registrarSaneador(this.form.controls.direccion, (v) =>
      this.saneaDireccion(v),
    );

    // El actor productivo minero define si se pide el registro completo de
    // personal (fecha de nacimiento, inicio laboral y dirección).
    this.form.controls.actorProductivoMinero.valueChanges.subscribe((actor) =>
      this.aplicarValidadoresRegistroEmpresa(this.esActorMismaEmpresa(actor)),
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
        fechaNacimiento: this.parseFecha(p.fechaNacimiento),
        fechaInicioLaboral: this.parseFecha(p.fechaInicioLaboral),
        direccion: p.direccion ?? '',
      });
      // Si el actor patcheado es la propia empresa, activa ya sus validadores
      // (el valueChanges de patchValue lo dispara, pero lo forzamos por si
      // el actor viene null y luego cambia).
      this.aplicarValidadoresRegistroEmpresa(
        this.esActorMismaEmpresa(p.actorProductivoMinero ?? null),
      );
      // patchValue no debería marcar el form como dirty, pero lo forzamos
      // explícitamente para que el chequeo de "sin cambios" en guardar() sea confiable.
      this.form.markAsPristine();
    } else if (this.data.actorPreseleccionado) {
      // Alta desde la ficha de un actor: dejamos el actor ya elegido.
      this.form.controls.actorProductivoMinero.setValue(
        this.data.actorPreseleccionado,
      );
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
    // El actor es opcional. Si se eligió uno de la lista (objeto) se manda su id;
    // si el campo quedó vacío o con texto suelto, en edición se limpia la
    // relación (null) y al crear simplemente no se envía (el back admite null).
    const actorEsObjeto =
      !!actorSeleccionado && typeof actorSeleccionado === 'object';
    const idActorProductivoMinero = actorEsObjeto
      ? actorSeleccionado.id
      : this.esEdicion
        ? null
        : undefined;

    const request: GuardarPersonaRequest = {
      ...(this.data.persona ? { id: this.data.persona.id } : {}),
      nombres: v.nombres!,
      apellidoPaterno: v.apellidoPaterno!,
      idTipoDocumento: v.idTipoDocumento!,
      numeroDocumento: v.numeroDocumento!,
      tiposPersona: v.tiposPersona!,
      idActorProductivoMinero,
    };

    // Apellido materno es opcional: se envía solo si hay valor; en edición se
    // manda vacío para poder limpiarlo.
    const apellidoMaterno = (v.apellidoMaterno ?? '').trim();
    if (apellidoMaterno) {
      request.apellidoMaterno = apellidoMaterno;
    } else if (this.esEdicion) {
      request.apellidoMaterno = '';
    }

    // Celular es opcional (mismo criterio que apellido materno).
    const celular = (v.celular ?? '').trim();
    if (celular) {
      request.celular = celular;
    } else if (this.esEdicion) {
      request.celular = '';
    }

    // Registro completo de personal: solo cuando el actor es la propia empresa.
    if (this.esActorMismaEmpresa(actorSeleccionado)) {
      request.fechaNacimiento = this.formatFecha(v.fechaNacimiento!);
      request.fechaInicioLaboral = this.formatFecha(v.fechaInicioLaboral!);
      request.direccion = (v.direccion ?? '').trim();
    }

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
        // El back a veces responde 200/201 con cuerpo vacío; devolvemos un
        // valor truthy igualmente para que la bandeja que abrió el diálogo
        // recargue la lista (mismo patrón que el diálogo de actor productivo).
        this.dialogRef.close(resultado ?? true);
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
