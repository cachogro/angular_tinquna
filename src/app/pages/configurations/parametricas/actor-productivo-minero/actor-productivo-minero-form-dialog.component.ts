import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import {
  ActorProductivoMinero,
  Municipio,
  SeccionMina,
  TipoActorProductivoMinero,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

export interface ActorProductivoMineroDialogData {
  actorProductivoMinero?: ActorProductivoMinero;
}

/** Mayúsculas, letras (con acentos/ñ), números, espacio y los caracteres
 *  especiales de negocio: # / ° ' " . - _ , */
const CHARSET_NOMBRE_DIRECCION = /^[A-ZÁÉÍÓÚÑÜ0-9#/°'".,_\- ]*$/;
const CARACTERES_INVALIDOS_NOMBRE_DIRECCION = /[^A-ZÁÉÍÓÚÑÜ0-9#/°'".,_\- ]/g;

/** Solo dígitos y el signo "+" */
const CHARSET_TELEFONO = /^[0-9+]*$/;
const CARACTERES_INVALIDOS_TELEFONO = /[^0-9+]/g;

/** Solo dígitos, con como máximo 2 guiones medios (ej. 05-0486-04) */
const CHARSET_NIM = /^[0-9]*(-[0-9]*){0,2}$/;
const CARACTERES_INVALIDOS_NIM = /[^0-9-]/g;

/** Solo dígitos */
const CHARSET_CODIGO = /^[0-9]*$/;
const CARACTERES_INVALIDAS_CODIGO = /[^0-9]/g;

/** Mayúsculas, espacios y números (búsqueda de municipio) */
const CARACTERES_INVALIDOS_MUNICIPIO = /[^A-Z0-9 ]/g;

/** Mayúsculas, números, espacio y _- (nueva sección de mina) */
const CHARSET_SECCION = /^[A-Z0-9_\- ]*$/;
const CARACTERES_INVALIDOS_SECCION = /[^A-Z0-9_\- ]/g;

/**
 * Diálogo SOLO de formulario para crear/editar un actor productivo minero.
 * La bandeja (lista + filtros + paginación) vive ahora en
 * `ActoresProductivosComponent`; este diálogo se abre desde ahí y se cierra
 * devolviendo el actor guardado para que la lista se refresque.
 */
@Component({
  selector: 'app-actor-productivo-minero-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatTooltipModule,
    ParametricaDialogShellComponent,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ],
  templateUrl: './actor-productivo-minero-form-dialog.component.html',
  styleUrl: './actor-productivo-minero-form-dialog.component.scss',
})
export class ActorProductivoMineroFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<ActorProductivoMineroFormDialogComponent>,
  );
  private readonly data =
    inject<ActorProductivoMineroDialogData>(MAT_DIALOG_DATA, {
      optional: true,
    }) ?? {};

  guardando = false;

  /** Tope del datepicker: no se puede iniciar operaciones en el futuro */
  readonly hoy = new Date();

  tipos: TipoActorProductivoMinero[] = [];

  // ---------- Municipio: autocomplete buscable (departamento/provincia/municipio/código) ----------
  municipios: Municipio[] = [];
  municipiosFiltrados: Municipio[] = [];
  /** Control aparte del `form`: guarda lo que se ve en el input (texto
   *  mientras se busca, o el Municipio una vez seleccionado). El id real
   *  seleccionado sigue viviendo en `form.get('idMunicipio')`. */
  readonly municipioCtrl = new FormControl<Municipio | string | null>('');

  // ---------- Secciones de mina: lista simple, no vive en el `form` reactivo ----------
  seccionesMina: SeccionMina[] = [];
  readonly nuevaSeccionControl = new FormControl('', [
    Validators.maxLength(60),
    Validators.pattern(CHARSET_SECCION),
  ]);

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender solo de `data`.
  actorEditando: ActorProductivoMinero | null = null;

  get modoEdicion(): boolean {
    return !!this.actorEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.maxLength(55),
        Validators.pattern(CHARSET_NOMBRE_DIRECCION),
      ],
    ],
    direccion: [
      '',
      [
        Validators.required,
        Validators.maxLength(55),
        Validators.pattern(CHARSET_NOMBRE_DIRECCION),
      ],
    ],
    telefono: [
      '',
      [
        Validators.required,
        Validators.maxLength(10),
        Validators.pattern(CHARSET_TELEFONO),
      ],
    ],
    idTipoActorProductivoMinero: [
      null as number | string | null,
      [Validators.required],
    ],
    // Opcionales, se omiten del request si quedan vacíos.
    idMunicipio: [null as number | null],
    fechaInicioOperaciones: [null as Date | null],
    nim: ['', [Validators.maxLength(30), Validators.pattern(CHARSET_NIM)]],
    codigo: [
      '',
      [Validators.maxLength(30), Validators.pattern(CHARSET_CODIGO)],
    ],
  });

  ngOnInit(): void {
    this.cargarTipos();
    this.cargarMunicipios();

    this.registrarSaneador(this.form.get('nombre')!, (v) =>
      this.saneaNombreDireccion(v),
    );
    this.registrarSaneador(this.form.get('direccion')!, (v) =>
      this.saneaNombreDireccion(v),
    );
    this.registrarSaneador(this.form.get('telefono')!, (v) =>
      this.saneaTelefono(v),
    );
    this.registrarSaneador(this.form.get('nim')!, (v) => this.saneaNim(v));
    this.registrarSaneador(this.form.get('codigo')!, (v) =>
      this.saneaSoloNumeros(v),
    );
    this.registrarSaneador(this.nuevaSeccionControl, (v) =>
      this.saneaSeccion(v),
    );

    // Saneo y filtro en la misma suscripción (no dos separadas): así el
    // filtro siempre usa el texto ya saneado, sin depender del orden de
    // ejecución entre suscripciones distintas.
    this.municipioCtrl.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') {
        this.municipiosFiltrados = this.filtrarMunicipios(
          this.mostrarMunicipio(valor),
        );
        return;
      }
      const limpio = this.saneaMunicipioTexto(valor);
      if (limpio !== valor) {
        this.municipioCtrl.setValue(limpio, { emitEvent: false });
      }
      this.municipiosFiltrados = this.filtrarMunicipios(limpio);
    });

    if (this.data.actorProductivoMinero) {
      this.editar(this.data.actorProductivoMinero);
    }
  }

  /** Mayúsculas + solo caracteres permitidos, para nombre y dirección */
  private saneaNombreDireccion(valor: string): string {
    return valor
      .toUpperCase()
      .replace(CARACTERES_INVALIDOS_NOMBRE_DIRECCION, '');
  }

  /** Solo dígitos y "+", para teléfono */
  private saneaTelefono(valor: string): string {
    return valor.replace(CARACTERES_INVALIDOS_TELEFONO, '');
  }

  /** Solo dígitos, con como máximo 2 guiones medios, para NIM */
  private saneaNim(valor: string): string {
    const limpio = valor.replace(CARACTERES_INVALIDOS_NIM, '');
    let guiones = 0;
    return limpio.replace(/-/g, () => (++guiones <= 2 ? '-' : ''));
  }

  /** Solo dígitos, para código */
  private saneaSoloNumeros(valor: string): string {
    return valor.replace(CARACTERES_INVALIDAS_CODIGO, '');
  }

  /** Mayúsculas, espacios y números, para la búsqueda de municipio */
  private saneaMunicipioTexto(valor: string): string {
    return valor.toUpperCase().replace(CARACTERES_INVALIDOS_MUNICIPIO, '');
  }

  /** Mayúsculas, números, espacio y _-, para nueva sección de mina */
  private saneaSeccion(valor: string): string {
    return valor.toUpperCase().replace(CARACTERES_INVALIDOS_SECCION, '');
  }

  /** Suscribe un control para reescribir su valor en vivo según la función de saneo dada */
  private registrarSaneador(
    control: AbstractControl,
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

  private cargarTipos(): void {
    this.parametricasService.obtenerTiposActorProductivoMinero().subscribe({
      next: (data) => {
        this.tipos = data.filter((t) => t.activo !== false);
      },
      error: () =>
        this.snackBar.open('Error al cargar los tipos', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  private cargarMunicipios(): void {
    this.parametricasService.obtenerMunicipios().subscribe({
      next: (data) => {
        this.municipios = data.filter((m) => m.activo !== false);
        this.municipiosFiltrados = this.municipios;
        this.sincronizarMunicipioCtrl();
      },
      error: () =>
        this.snackBar.open('Error al cargar los municipios', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  /** Refleja en el input de búsqueda el municipio que ya está seleccionado en
   *  `form.get('idMunicipio')` (al editar). Se llama tras cargar los
   *  municipios por si el id ya estaba seteado antes de tenerlos. */
  private sincronizarMunicipioCtrl(): void {
    const id = this.form.get('idMunicipio')?.value;
    if (id == null) return;
    const municipio = this.municipios.find((m) => m.id === id);
    if (municipio) this.municipioCtrl.setValue(municipio, { emitEvent: false });
  }

  private filtrarMunicipios(texto: string): Municipio[] {
    const filtro = texto.trim().toLowerCase();
    if (!filtro) return this.municipios;
    return this.municipios.filter(
      (m) =>
        m.departamento.toLowerCase().includes(filtro) ||
        m.provincia.toLowerCase().includes(filtro) ||
        m.municipio.toLowerCase().includes(filtro) ||
        m.codigo.toLowerCase().includes(filtro),
    );
  }

  mostrarMunicipio = (municipio: Municipio | string | null): string => {
    if (!municipio) return '';
    if (typeof municipio === 'string') return municipio;
    return `${municipio.departamento} - ${municipio.provincia} - ${municipio.municipio} - ${municipio.codigo}`;
  };

  onMunicipioSeleccionado(event: MatAutocompleteSelectedEvent): void {
    const municipio = event.option.value as Municipio;
    this.form.get('idMunicipio')!.setValue(municipio.id);
  }

  /** Si al salir del campo no se llegó a seleccionar un municipio real de la
   *  lista, se intenta hacer match exacto por el texto mostrado; si no hay
   *  match, se limpia el campo (es opcional, no marca error).
   *
   *  El clic en una opción del autocomplete también le quita el foco al
   *  input (dispara blur) ANTES de que Material procese la selección: sin
   *  este retraso, esta función corría primero con el texto tecleado
   *  todavía en el control, no encontraba match exacto y vaciaba el campo
   *  recién seleccionado. */
  onMunicipioBlur(): void {
    setTimeout(() => this.resolverMunicipioBlur(), 150);
  }

  private resolverMunicipioBlur(): void {
    const valor = this.municipioCtrl.value;
    if (valor && typeof valor === 'object') return;

    const texto = (valor ?? '').toString().trim().toLowerCase();
    const coincidencia = this.municipios.find(
      (m) => this.mostrarMunicipio(m).toLowerCase() === texto,
    );
    if (coincidencia) {
      this.municipioCtrl.setValue(coincidencia);
      this.form.get('idMunicipio')!.setValue(coincidencia.id);
    } else {
      this.municipioCtrl.setValue('');
      this.form.get('idMunicipio')!.setValue(null);
    }
  }

  /** Agrega una sección de mina a la lista local (se manda completa al
   *  guardar). El id es un correlativo local: lo maneja el frontend, no la
   *  base de datos. */
  agregarSeccion(): void {
    const descripcion = (this.nuevaSeccionControl.value ?? '')
      .trim()
      .toUpperCase();
    if (!descripcion || this.nuevaSeccionControl.invalid) return;
    const siguienteId =
      this.seccionesMina.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    this.seccionesMina = [
      ...this.seccionesMina,
      { id: siguienteId, descripcion },
    ];
    this.nuevaSeccionControl.reset('');
  }

  quitarSeccion(id: number): void {
    this.seccionesMina = this.seccionesMina.filter((s) => s.id !== id);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar actor productivo minero'
          : 'Crear actor productivo minero',
        message: this.modoEdicion
          ? `¿Confirmas actualizar "${nombre}"?`
          : `¿Confirmas crear "${nombre}"?`,
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
    const {
      nombre,
      direccion,
      telefono,
      idTipoActorProductivoMinero,
      idMunicipio,
      fechaInicioOperaciones,
      nim,
      codigo,
    } = this.form.getRawValue();

    // Un solo POST: si hay actor en edición, se manda su id y el back
    // actualiza; si no, lo crea. idMunicipio/fechaInicioOperaciones/nim/codigo/
    // seccionesMina son opcionales: se omiten del body si quedan vacíos.
    this.parametricasService
      .guardarActorProductivoMinero({
        id: this.actorEditando?.id,
        nombre,
        direccion,
        telefono,
        idTipoActorProductivoMinero,
        idMunicipio: idMunicipio ?? undefined,
        fechaInicioOperaciones: fechaInicioOperaciones
          ? this.formatFecha(fechaInicioOperaciones)
          : undefined,
        nim: nim?.trim() || undefined,
        codigo: codigo?.trim() || undefined,
        seccionesMina:
          this.seccionesMina.length > 0 ? this.seccionesMina : undefined,
      })
      .subscribe({
        next: (actor) => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Actor productivo minero actualizado correctamente'
              : 'Actor productivo minero creado correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          // El diálogo es solo-formulario: se cierra devolviendo el actor
          // para que la bandeja que lo abrió recargue.
          this.dialogRef.close(actor ?? true);
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

  /** Pone el formulario en modo edición con los datos recibidos */
  private editar(actor: ActorProductivoMinero): void {
    this.actorEditando = actor;
    this.form.patchValue({
      nombre: actor.nombre,
      direccion: actor.direccion,
      telefono: actor.telefono,
      idTipoActorProductivoMinero: actor.idTipoActorProductivoMinero,
      idMunicipio: actor.idMunicipio ?? null,
      fechaInicioOperaciones: this.parseFecha(actor.fechaInicioOperaciones),
      nim: actor.nim ?? '',
      codigo: actor.codigo ?? '',
    });
    this.seccionesMina = actor.seccionesMina ? [...actor.seccionesMina] : [];
    if (actor.municipio) {
      this.municipioCtrl.setValue(actor.municipio, { emitEvent: false });
    } else {
      this.sincronizarMunicipioCtrl();
    }
  }

  cancelar(): void {
    this.dialogRef.close();
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
}
