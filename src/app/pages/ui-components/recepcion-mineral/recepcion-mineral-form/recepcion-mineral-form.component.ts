// src/app/pages/ui-components/recepcion-mineral/recepcion-mineral-form/recepcion-mineral-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, startWith } from 'rxjs';
import {
  ActorProductivoMinero,
  PersonaCI,
} from 'src/app/pages/configurations/models/persona.models';
import { PersonaService } from 'src/app/pages/configurations/services/persona.service';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import {
  Laboratorio,
  LugarAcopio,
} from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import {
  CodificacionCatalogo,
  GuardarRegistroMineralRequest,
  RegistroMineral,
} from '../../models/registro-mineral.models';
import { RegistroMineralService } from '../../services/registro-mineral.service';
import { MatCardModule } from '@angular/material/card';
import {
  PersonaFormDialogComponent,
  PersonaFormDialogData,
} from 'src/app/pages/configurations/gestion-clientes/persona-form-dialog/persona-form-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { MayusculasDirective } from 'src/app/shared/directives/mayusculas.directive';
import { sinSoloEspacios } from 'src/app/shared/utils/texto.util';
import { abrirBlobEnPestana } from 'src/app/shared/utils/descarga-archivo.util';
import { nombrePersona } from '../../../contabilidad/components/personal-interno.util';

import {
  abrirReciboAnticipo,
  faltaReciboAnticipo,
} from '../recibo-anticipo.util';

const ID_TIPO_PERSONA_MUESTRERO = 6;

/** Actor reservado a la propia empresa (TINKURIKUNA): no se le compra mineral. */
const ID_ACTOR_EMPRESA = '1';

/** Quién deja el mineral: persona registrada (incluye personal interno),
 *  actor productivo o un externo del que solo se anota el nombre. */
type ProveedorTipo = 'PERSONA' | 'ACTOR' | 'TEXTO';

/** Palabra clave para identificar, por código o nombre, la codificación de tipo "cargas"
 *  (para esa codificación el N° de sacos no es obligatorio) */
const CLAVE_CODIFICACION_CARGAS = 'CARGA';

/** La codificación "RAM" (id '5' en el catálogo, ver también valorizacion-form.component.ts)
 *  tampoco exige N° de sacos: se identifica igual que ahí, por id o por nombre. */
const ID_CODIFICACION_RAM = '5';
const CLAVE_CODIFICACION_RAM = 'RAM';

@Component({
  selector: 'app-recepcion-mineral-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
    MayusculasDirective,
  ],
  templateUrl: './recepcion-mineral-form.component.html',
  styleUrl: './recepcion-mineral-form.component.scss',
})
export class RecepcionMineralFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly personaService = inject(PersonaService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  /** Personas activas que se ofrecen como proveedor (tengan o no kardex: a
   *  qué kardex va el dinero se decide al procesar el recibo). */
  readonly proveedores = signal<PersonaCI[]>([]);
  /** Personas con tipo "muestrero" (idTipoPersona = 6), para el select de muestrero */
  readonly muestreros = signal<PersonaCI[]>([]);
  readonly actoresMinero = signal<ActorProductivoMinero[]>([]);
  readonly lugaresAcopio = signal<LugarAcopio[]>([]);
  /** Solo laboratorios activos (el back rechaza los inactivos con 404). */
  readonly laboratorios = signal<Laboratorio[]>([]);
  /** Laboratorio con el que se cargó la recepción al editar: solo se envía
   *  idLaboratorio si cambió (sin enviarlo, el back conserva el que tenía). */
  private idLaboratorioInicial: string | null = null;
  readonly cargandoCatalogos = signal(true);
  readonly cargandoRegistro = signal(false);
  readonly guardando = signal(false);

  /** true mientras la fecha/hora de recepción se actualiza sola cada segundo
   *  (solo aplica a registros nuevos). Se detiene si el usuario la edita a mano
   *  o mientras se está guardando, y se puede reanudar con el botón del campo. */
  readonly horaAutomatica = signal(true);
  private tickHoraInterval?: ReturnType<typeof setInterval>;

  registroId: string | null = null;
  get esEdicion(): boolean {
    return !!this.registroId;
  }

  /** Valor máximo para el input datetime-local: el momento actual (no se permiten fechas futuras) */
  maxFechaHoraLocal(): string {
    return this.formatDatetimeLocal(new Date());
  }

  readonly form = new FormGroup({
    idCodificacion: new FormControl<string | null>(null, [Validators.required]),
    numeroSacos: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    balanzaL: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.001),
    ]),
    balanzaT: new FormControl<number | null>(null, [Validators.min(0)]),
    anticipo: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    humedad: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    fechaHoraRecepcion: new FormControl<string | null>(
      this.formatDatetimeLocal(new Date()),
      [Validators.required, (control) => this.validadorFechaNoFutura(control)],
    ),
    observaciones: new FormControl(''),
    /** Id de la persona (tipo muestrero) asignada a la recepción. Obligatorio: el
     *  usuario debe elegir uno explícitamente, no queda ninguno por defecto. */
    idMuestrero: new FormControl<string | null>(null, [Validators.required]),
    /** Descripción del lugar de acopio elegido del catálogo. Obligatorio. */
    lugarAcopio: new FormControl<string | null>(null, [Validators.required]),
    /** Laboratorio al que va la muestra. Opcional: la valorización lo precarga. */
    idLaboratorio: new FormControl<string | null>(null),
  });

  /** Mismo selector que "Recibí de / Entregué a" del recibo (sin Cliente):
   *  de los tres controles de abajo solo cuenta el del tipo elegido. */
  readonly proveedorTipo = new FormControl<ProveedorTipo>('PERSONA', {
    nonNullable: true,
  });

  /** Autocomplete de persona: guarda el objeto PersonaCI elegido, o el texto
   *  libre mientras se escribe (inválido al guardar). */
  readonly proveedorControl = new FormControl<PersonaCI | string | null>(null, [
    this.seleccionDeLista,
  ]);

  /** Autocomplete de actor productivo: mismo criterio que el de persona. */
  readonly actorControl = new FormControl<
    ActorProductivoMinero | string | null
  >(null, [this.seleccionDeLista]);

  /** Externo sin registro: solo nombre y apellido. */
  readonly externoControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, sinSoloEspacios, Validators.maxLength(255)],
  });

  filtroProveedores!: Observable<PersonaCI[]>;
  filtroActores!: Observable<ActorProductivoMinero[]>;

  /** Obligatorio y elegido de la lista (un texto suelto no vale). */
  private seleccionDeLista(control: AbstractControl) {
    const valor = control.value;
    if (!valor) return { required: true };
    return typeof valor === 'object' ? null : { proveedorInvalido: true };
  }

  /** Control que vale según el tipo de proveedor elegido. */
  private get controlProveedorActivo(): AbstractControl {
    switch (this.proveedorTipo.value) {
      case 'ACTOR':
        return this.actorControl;
      case 'TEXTO':
        return this.externoControl;
      default:
        return this.proveedorControl;
    }
  }

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.registroId = this.route.snapshot.paramMap.get('id');

    // En registros nuevos, la fecha/hora de recepción avanza sola cada segundo
    // hasta que el usuario la edite a mano o se registre la recepción.
    if (!this.esEdicion) {
      this.tickHoraInterval = setInterval(() => {
        if (this.horaAutomatica() && !this.guardando()) {
          this.form.controls.fechaHoraRecepcion.setValue(
            this.formatDatetimeLocal(new Date()),
            { emitEvent: false },
          );
        }
      }, 1000);

      this.form.controls.fechaHoraRecepcion.valueChanges.subscribe(() => {
        this.horaAutomatica.set(false);
      });
    }

    // Listas de los autocompletes: se filtran con lo que se va escribiendo;
    // con una opción ya elegida se muestra la lista completa.
    this.filtroProveedores = this.proveedorControl.valueChanges.pipe(
      startWith(null),
      map(() => {
        const valor = this.proveedorControl.value;
        return this.filtrarProveedores(typeof valor === 'string' ? valor : '');
      }),
    );

    this.filtroActores = this.actorControl.valueChanges.pipe(
      startWith(null),
      map(() => {
        const valor = this.actorControl.value;
        return this.filtrarActores(typeof valor === 'string' ? valor : '');
      }),
    );

    // El N° de sacos no es obligatorio para la codificación "cargas" ni RAM.
    this.form.controls.idCodificacion.valueChanges.subscribe((id) =>
      this.actualizarValidadorSacos(id),
    );

    // Todo lo que se escriba en observaciones se normaliza a mayúsculas.
    this.form.controls.observaciones.valueChanges.subscribe((valor) => {
      if (valor && valor !== valor.toUpperCase()) {
        this.form.controls.observaciones.setValue(valor.toUpperCase(), {
          emitEvent: false,
        });
      }
    });

    forkJoin({
      codificaciones: this.registroMineralService.getAllCodificaciones(),
      proveedores: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      }),
      muestreros: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        idTipoPersona: ID_TIPO_PERSONA_MUESTRERO,
        activo: true,
      }),
      actoresMinero: this.personaService.getAllActoresMineros(),
      lugaresAcopio: this.parametricasService.obtenerLugaresAcopio(),
      // Es opcional: si falla, el formulario igual carga sin laboratorios.
      laboratorios: this.parametricasService
        .obtenerLaboratorios()
        .pipe(catchError(() => of([] as Laboratorio[]))),
    }).subscribe({
      next: ({
        codificaciones,
        proveedores,
        muestreros,
        actoresMinero,
        lugaresAcopio,
        laboratorios,
      }) => {
        this.laboratorios.set(laboratorios.filter((l) => l.activo));
        this.lugaresAcopio.set(lugaresAcopio);
        this.codificaciones.set(codificaciones);
        this.proveedores.set(proveedores.data);
        this.muestreros.set(muestreros.data);
        this.actoresMinero.set(
          actoresMinero.filter((a) => String(a.id) !== ID_ACTOR_EMPRESA),
        );
        this.cargandoCatalogos.set(false);

        if (this.esEdicion) {
          this.cargarRegistroParaEditar();
        }
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  /**
   * Usa el registro que la bandeja pasa por navegación; si no viene (se entró
   * directo por URL o se recargó con F5) lo pide al back por id.
   */
  private cargarRegistroParaEditar(): void {
    const registro = history.state?.registro as RegistroMineral | undefined;
    if (registro && String(registro.id) === String(this.registroId)) {
      this.precargarRegistro(registro);
      return;
    }

    const noEncontrado = () => {
      this.cargandoRegistro.set(false);
      this.snackBar.open('No se encontró la recepción a editar', 'Cerrar', {
        duration: 5000,
      });
      this.volverALista();
    };
    this.cargandoRegistro.set(true);
    this.registroMineralService.obtenerPorId(this.registroId!).subscribe({
      next: (encontrado) => {
        if (!encontrado) return noEncontrado();
        this.cargandoRegistro.set(false);
        this.precargarRegistro(encontrado);
      },
      error: noEncontrado,
    });
  }

  private precargarRegistro(registro: RegistroMineral): void {
    const fechaHoraRegistro = registro.fechaRecepcion
      ? new Date(registro.fechaRecepcion)
      : new Date();

    this.form.patchValue({
      idCodificacion: registro.idCodificacion,
      numeroSacos: registro.numeroSacos,
      balanzaL: Number(registro.balanzaL),
      balanzaT: registro.balanzaT != null ? Number(registro.balanzaT) : 0,
      anticipo: registro.anticipo != null ? Number(registro.anticipo) : 0,
      humedad: registro.humedad != null ? Number(registro.humedad) : 0,
      fechaHoraRecepcion: this.formatDatetimeLocal(fechaHoraRegistro),
      observaciones: registro.observaciones ?? '',
      idMuestrero: registro.idPersonalInterno ?? null,
      lugarAcopio: registro.lugarAcopio || null,
      idLaboratorio: registro.idLaboratorio ?? null,
    });
    this.idLaboratorioInicial = registro.idLaboratorio ?? null;

    // Igual que el lugar de acopio: si el laboratorio guardado ya no está activo,
    // se conserva como opción para no perderlo al editar.
    const labGuardado = registro.laboratorio as Laboratorio | undefined;
    if (
      labGuardado &&
      !this.laboratorios().some((l) => String(l.id) === String(labGuardado.id))
    ) {
      this.laboratorios.update((lista) => [
        ...lista,
        { ...labGuardado, activo: false },
      ]);
    }

    // Si el valor guardado ya no está en el catálogo activo, se conserva como opción
    // para no perderlo al editar.
    const lugarGuardado = registro.lugarAcopio as string | undefined;
    if (
      lugarGuardado &&
      !this.lugaresAcopio().some((l) => l.descripcion === lugarGuardado)
    ) {
      this.lugaresAcopio.update((lista) => [
        ...lista,
        { id: -1, descripcion: lugarGuardado, activo: false },
      ]);
    }

    // Proveedor: persona, actor productivo o externo. Si el registro elegido
    // ya no está en el catálogo activo, se usa el que trae la recepción.
    if (registro.idPersona) {
      const persona =
        this.proveedores().find(
          (p) => String(p.id) === String(registro.idPersona),
        ) ??
        (registro.persona as PersonaCI | undefined) ??
        null;
      this.proveedorTipo.setValue('PERSONA');
      this.proveedorControl.setValue(persona);
    } else if (registro.idActorProductivoMinero) {
      const actor =
        this.actoresMinero().find(
          (a) => String(a.id) === String(registro.idActorProductivoMinero),
        ) ??
        (registro.actorProductivoMinero as ActorProductivoMinero | undefined) ??
        null;
      this.proveedorTipo.setValue('ACTOR');
      this.actorControl.setValue(actor);
    } else {
      this.proveedorTipo.setValue('TEXTO');
      this.externoControl.setValue(registro.nombresApellidos ?? '');
    }
  }

  displayProveedor = (persona: PersonaCI | string | null): string => {
    if (!persona || typeof persona === 'string') return persona ?? '';
    return `${this.nombreProveedor(persona)} — ${persona.numeroDocumento}`;
  };

  displayActor = (actor: ActorProductivoMinero | string | null): string => {
    if (!actor || typeof actor === 'string') return actor ?? '';
    return actor.nombre;
  };

  /** Hasta 50 personas cuyo nombre o documento contiene lo escrito. */
  private filtrarProveedores(texto: string): PersonaCI[] {
    const busqueda = texto.trim().toLowerCase();
    const lista = this.proveedores();
    if (!busqueda) return lista.slice(0, 50);

    return lista
      .filter(
        (p) =>
          this.nombreProveedor(p).toLowerCase().includes(busqueda) ||
          (p.numeroDocumento ?? '').toLowerCase().includes(busqueda),
      )
      .slice(0, 50);
  }

  private filtrarActores(texto: string): ActorProductivoMinero[] {
    const busqueda = texto.trim().toLowerCase();
    const lista = this.actoresMinero();
    if (!busqueda) return lista;
    return lista.filter((a) => a.nombre.toLowerCase().includes(busqueda));
  }

  /** Lo que se envía según el tipo de proveedor elegido (uno de los tres). */
  private proveedorRequest(): Pick<
    GuardarRegistroMineralRequest,
    'idPersona' | 'idActorProductivoMinero' | 'nombresApellidos'
  > {
    switch (this.proveedorTipo.value) {
      case 'ACTOR':
        return {
          idActorProductivoMinero: String(
            (this.actorControl.value as ActorProductivoMinero).id,
          ),
        };
      case 'TEXTO':
        return {
          nombresApellidos: this.externoControl.value
            .trim()
            .replace(/\s+/g, ' ')
            .toUpperCase(),
        };
      default:
        return {
          idPersona: String((this.proveedorControl.value as PersonaCI).id),
        };
    }
  }

  readonly nombreProveedor = nombrePersona;

  /** Formatea una fecha al valor que espera un input nativo type="datetime-local":
   *  "YYYY-MM-DDTHH:mm", en hora local (sin offset). */
  private formatDatetimeLocal(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${anio}-${mes}-${dia}T${horas}:${minutos}`;
  }

  /** Bolivia no tiene horario de verano: el offset es siempre -04:00 */
  private static readonly OFFSET_BOLIVIA = '-04:00';

  /** Devuelve la fecha/hora en formato ISO 8601 con offset, ej. "2026-07-22T14:35:00-04:00".
   *  Es el formato recomendado para enviar al backend: estándar, sin ambigüedad de zona
   *  horaria, y compatible con columnas TIMESTAMP WITH TIME ZONE. Se envía como string. */
  private formatFechaHora(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${anio}-${mes}-${dia}T${horas}:${minutos}:00${RecepcionMineralFormComponent.OFFSET_BOLIVIA}`;
  }

  /** Validador: la fecha/hora de operación (input datetime-local) no puede ser futura */
  private validadorFechaNoFutura(
    control: AbstractControl,
  ): { fechaFutura: true } | null {
    const valor = control.value as string | null;
    if (!valor) return null;
    const fecha = new Date(valor);
    return fecha.getTime() > Date.now() ? { fechaFutura: true } : null;
  }

  /** Impide escribir el signo negativo, "+" o notación científica ("e") en un campo numérico.
   *  Se complementa con el atributo [min]="0" en el input, que evita que las flechitas
   *  del spinner bajen de 0. */
  bloquearNegativos(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  /** Igual que bloquearNegativos, pero además impide el punto decimal: para
   *  campos numéricos que solo aceptan enteros (ej. N° de sacos). */
  bloquearDecimales(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E', '.'].includes(event.key)) {
      event.preventDefault();
    }
  }

  /** Refuerza el bloqueo de letras/símbolos en campos numéricos ante lo que el
   *  bloqueo por teclado no alcanza a cubrir: pegar texto, autocompletado o
   *  teclados de algunos dispositivos móviles. Cuando el navegador marca el
   *  contenido tecleado como no numérico (badInput), su valor real ya queda
   *  vacío, pero el texto puede seguir mostrándose en pantalla; esto fuerza a
   *  limpiar también lo que se ve. */
  limpiarEntradaInvalida(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.validity.badInput) {
      input.value = '';
    }
  }

  /** true si la codificación (por id, código o nombre) corresponde al tipo "cargas"
   *  o a RAM, para las cuales el N° de sacos no es obligatorio */
  private codificacionEsCargas(idCodificacion: string | null): boolean {
    if (!idCodificacion) return false;
    if (String(idCodificacion) === ID_CODIFICACION_RAM) return true;
    const codificacion = this.codificaciones().find(
      (c) => String(c.id) === String(idCodificacion),
    );
    if (!codificacion) return false;
    const texto = `${codificacion.codigo} ${codificacion.nombre}`.toUpperCase();
    return (
      texto.includes(CLAVE_CODIFICACION_CARGAS) ||
      texto.includes(CLAVE_CODIFICACION_RAM)
    );
  }

  /** Ajusta si el control de N° de sacos es obligatorio según la codificación elegida */
  private actualizarValidadorSacos(idCodificacion: string | null): void {
    const control = this.form.controls.numeroSacos;
    const validadores = this.codificacionEsCargas(idCodificacion)
      ? [Validators.min(1)]
      : [Validators.required, Validators.min(1)];
    control.setValidators(validadores);
    control.updateValueAndValidity({ emitEvent: false });
  }

  /** true si el laboratorio elegido difiere del que tenía la recepción
   *  (en una nueva, del vacío). */
  private laboratorioCambio(idLaboratorio: string | null): boolean {
    return (
      String(idLaboratorio ?? '') !== String(this.idLaboratorioInicial ?? '')
    );
  }

  ngOnDestroy(): void {
    if (this.tickHoraInterval) clearInterval(this.tickHoraInterval);
  }

  /** Reanuda el avance automático de la fecha/hora de recepción, tras haberla
   *  editado a mano, y la lleva de inmediato al momento actual. */
  reanudarHoraAutomatica(): void {
    this.form.controls.fechaHoraRecepcion.setValue(
      this.formatDatetimeLocal(new Date()),
      { emitEvent: false },
    );
    this.horaAutomatica.set(true);
  }

  cancelar(): void {
    this.volverALista();
  }

  guardar(): void {
    if (this.guardando()) return;

    if (this.form.invalid || this.controlProveedorActivo.invalid) {
      this.form.markAllAsTouched();
      this.controlProveedorActivo.markAsTouched();

      const mensaje = this.f.fechaHoraRecepcion.hasError('fechaFutura')
        ? 'La fecha y hora de operación no puede ser futura'
        : 'Revisa los campos marcados en rojo';
      this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();
    const fechaHora = new Date(v.fechaHoraRecepcion!);
    const observaciones =
      (v.observaciones ?? '').trim().toUpperCase() || 'SIN OBSERVACIONES';

    const request: GuardarRegistroMineralRequest = {
      ...(this.esEdicion ? { id: this.registroId! } : {}),
      idCodificacion: v.idCodificacion!,
      ...this.proveedorRequest(),
      numeroSacos: v.numeroSacos ?? null,
      balanzaL: v.balanzaL!,
      balanzaT: v.balanzaT ?? 0,
      anticipo: v.anticipo ?? 0,
      humedad: v.humedad ?? 0,
      idPersonalInterno: v.idMuestrero!,
      lugarAcopio: v.lugarAcopio!,
      // Al crear solo va si se eligió; al editar solo si cambió (null lo quita).
      ...(this.laboratorioCambio(v.idLaboratorio)
        ? { idLaboratorio: v.idLaboratorio ?? null }
        : {}),
      fechaRecepcion: this.formatFechaHora(fechaHora),
      observaciones,
    };

    this.registroMineralService.guardarRegistro(request).subscribe({
      next: (registro) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion
            ? 'Recepción actualizada correctamente'
            : 'Recepción registrada correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        // El comprobante RM- se emite para toda recepción nueva, tenga o no
        // anticipo; al editar se reimprime desde la bandeja.
        const finalizar = () => {
          if (!this.esEdicion && registro?.id) this.abrirComprobante(registro);
          this.volverALista();
        };
        // Con anticipo y sin recibo vigente: Aceptar abre "Procesar recibo"
        // (one-shot); Cancelar lo deja en BORRADOR. Si el diálogo del recibo se
        // cierra sin guardar, queda pendiente en la bandeja.
        if (registro?.id && faltaReciboAnticipo(registro)) {
          this.dialog
            .open(ConfirmDialogComponent, {
              disableClose: true,
              data: {
                title: 'Anticipo registrado',
                message:
                  'La recepción tiene anticipo, ¿proceder a procesar el recibo? Si cancelas, el recibo se genera en borrador.',
                confirmLabel: 'Aceptar',
                cancelLabel: 'Cancelar',
                icon: 'receipt_long',
              },
            })
            .afterClosed()
            .subscribe((confirmado) => {
              abrirReciboAnticipo(
                this.dialog,
                registro,
                confirmado ? 'PROCESAR' : 'GENERAR',
              ).subscribe(finalizar);
            });
          return;
        }
        finalizar();
      },
      error: (err) => {
        this.guardando.set(false);
        const mensaje =
          err?.error?.message ?? 'Ocurrió un error al guardar la recepción';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 5000 });
      },
    });
  }

  // dialog persona
  abrirDialogoRegistroPersona(persona: PersonaCI | null): void {
    const data: PersonaFormDialogData = { persona };

    this.dialog
      .open(PersonaFormDialogComponent, { data, width: '820px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) {
          this.cargarProveedores(resultado.id);
        }
      });
  }

  /** Abre el comprobante RM- en otra pestaña. Si el navegador bloquea la
   *  ventana (ya pasó el clic del usuario), queda un aviso para abrirlo a mano. */
  private abrirComprobante(registro: RegistroMineral): void {
    this.registroMineralService.obtenerPdf(registro.id).subscribe({
      next: (blob) => {
        if (abrirBlobEnPestana(blob, 5 * 60000)) return;
        this.snackBar
          .open(`Comprobante de ${registro.codigoOperacion} listo`, 'Abrir', {
            duration: 15000,
          })
          .onAction()
          .subscribe(() => abrirBlobEnPestana(blob));
      },
      error: (err) =>
        this.snackBar.open(
          err?.error?.message ??
            'No se pudo generar el comprobante de la recepción',
          'Cerrar',
          { duration: 5000 },
        ),
    });
  }

  private volverALista(): void {
    this.router.navigate(['/ui-components/recepcion-minerales']);
  }

  private cargarProveedores(idParaSeleccionar?: string): void {
    this.personaService
      .listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      })
      .subscribe((resp) => {
        this.proveedores.set(resp.data);

        if (idParaSeleccionar) {
          const nuevo = resp.data.find(
            (p) => String(p.id) === String(idParaSeleccionar),
          );
          if (nuevo) {
            this.proveedorTipo.setValue('PERSONA');
            this.proveedorControl.setValue(nuevo);
          }
        }
      });
  }
}
