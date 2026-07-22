// src/app/pages/ui-components/recepcion-mineral/recepcion-mineral-form/recepcion-mineral-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, forkJoin, map, merge, startWith } from 'rxjs';
import {
  ActorProductivoMinero,
  PersonaCI,
} from 'src/app/pages/configurations/models/persona.models';
import { PersonaService } from 'src/app/pages/configurations/services/persona.service';
import {
  CodificacionCatalogo,
  DetalleMineralRegistro,
  GuardarRegistroMineralRequest,
  LeyUnidad,
} from '../../models/registro-mineral.models';
import { RegistroMineralService } from '../../services/registro-mineral.service';
import { MatCardModule } from '@angular/material/card';
import {
  PersonaFormDialogComponent,
  PersonaFormDialogData,
} from 'src/app/pages/configurations/gestion-clientes/persona-form-dialog/persona-form-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

const ID_TIPO_PERSONA_PROVEEDOR = 1;

/** Palabra clave para identificar, por código o nombre, la codificación de tipo "cargas"
 *  (para esa codificación el N° de sacos no es obligatorio) */
const CLAVE_CODIFICACION_CARGAS = 'CARGA';

/** Unidades disponibles para expresar la ley de un mineral */
export const LEY_UNIDADES: LeyUnidad[] = ['%', 'g/TM'];
const LEY_UNIDAD_POR_DEFECTO: LeyUnidad = '%';

/** Fila de la sección dinámica de leyes: una por cada mineral que integra la codificación elegida */
interface DetalleFormRow {
  idMineral: string;
  descripcion: string;
  simbolo?: string;
  control: FormControl<number | null>;
  unidadControl: FormControl<LeyUnidad>;
}

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
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatDialogModule,
  ],
  templateUrl: './recepcion-mineral-form.component.html',
  styleUrl: './recepcion-mineral-form.component.scss',
})
export class RecepcionMineralFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  /** Opciones de unidad de ley disponibles en el select de cada fila de mineral */
  readonly leyUnidades = LEY_UNIDADES;

  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  readonly proveedores = signal<PersonaCI[]>([]);
  readonly actoresMinero = signal<ActorProductivoMinero[]>([]);
  readonly cargandoCatalogos = signal(true);
  readonly cargandoRegistro = signal(false);
  readonly guardando = signal(false);

  /** Filas dinámicas de ley por mineral, generadas a partir de la codificación elegida */
  readonly detalleControls = signal<DetalleFormRow[]>([]);
  /** Detalles del registro que se está editando, para pre-cargar sus leyes al reconstruir las filas */
  private detallesIniciales?: DetalleMineralRegistro[];

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
    pesoNeto: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.001),
    ]),
    anticipo: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
    ]),
    fechaHoraOperacion: new FormControl<string | null>(
      this.formatDatetimeLocal(new Date()),
      [Validators.required, (control) => this.validadorFechaNoFutura(control)],
    ),
    observaciones: new FormControl(''),
  });

  /** Control independiente para el autocomplete: guarda el objeto PersonaCI
   *  completo cuando se selecciona una opción, o el texto libre mientras se
   *  escribe. El id real que se envía al backend sale de aquí, no del form. */
  readonly proveedorControl = new FormControl<PersonaCI | string | null>(null, [
    Validators.required,
    this.proveedorValidoValidator,
  ]);

  /** Control independiente (opcional) para filtrar/relacionar por actor productivo minero.
   *  Se autocompleta al elegir un proveedor, o el usuario puede elegirlo primero para
   *  acotar la lista de proveedores a los que pertenecen a ese actor. */
  readonly actorControl = new FormControl<
    ActorProductivoMinero | string | null
  >(null);

  filtroProveedores!: Observable<PersonaCI[]>;
  filtroActores!: Observable<ActorProductivoMinero[]>;

  private proveedorValidoValidator(control: AbstractControl) {
    const valor = control.value;
    if (!valor) return { required: true };
    return typeof valor === 'object' ? null : { proveedorInvalido: true };
  }

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.registroId = this.route.snapshot.paramMap.get('id');

    // Recalcula la lista de proveedores mostrada en el autocomplete cada vez que
    // cambia el texto escrito O el actor elegido (para acotar por actor).
    this.filtroProveedores = merge(
      this.proveedorControl.valueChanges,
      this.actorControl.valueChanges,
    ).pipe(
      startWith(null),
      map(() => {
        const valor = this.proveedorControl.value;
        const texto =
          typeof valor === 'string' ? valor : this.displayProveedor(valor);
        return this.filtrarProveedores(texto);
      }),
    );

    this.filtroActores = this.actorControl.valueChanges.pipe(
      startWith(''),
      map((valor) => {
        const texto =
          typeof valor === 'string' ? valor : this.displayActor(valor);
        return this.filtrarActores(texto);
      }),
    );

    // Al elegir un proveedor, se autocompleta el actor productivo relacionado.
    this.proveedorControl.valueChanges.subscribe((valor) => {
      if (!valor || typeof valor !== 'object') return;
      const actorDePersona = this.resolverActorDePersona(valor);
      const actorActual = this.actorControl.value;
      const yaCoincide =
        actorActual &&
        typeof actorActual === 'object' &&
        actorDePersona &&
        String(actorActual.id) === String(actorDePersona.id);
      if (!yaCoincide) {
        this.actorControl.setValue(actorDePersona);
      }
    });

    // Si se cambia el actor y el proveedor ya elegido no pertenece a él, se limpia
    // para forzar a elegir uno de la lista filtrada por ese actor.
    this.actorControl.valueChanges.subscribe((valor) => {
      if (!valor || typeof valor !== 'object') return;
      const proveedorActual = this.proveedorControl.value;
      if (
        proveedorActual &&
        typeof proveedorActual === 'object' &&
        String(proveedorActual.idActorProductivoMinero) !== String(valor.id)
      ) {
        this.proveedorControl.setValue(null);
      }
    });

    // Reconstruye las filas de leyes por mineral cada vez que cambia la codificación,
    // y ajusta si el N° de sacos es obligatorio o no (no lo es para la codificación "cargas").
    this.form.controls.idCodificacion.valueChanges.subscribe((id) => {
      this.actualizarDetalles(id, this.detallesIniciales);
      this.actualizarValidadorSacos(id);
    });

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
        idTipoPersona: ID_TIPO_PERSONA_PROVEEDOR,
        activo: true,
      }),
      actoresMinero: this.personaService.getAllActoresMineros(),
    }).subscribe({
      next: ({ codificaciones, proveedores, actoresMinero }) => {
        this.codificaciones.set(codificaciones);
        this.proveedores.set(proveedores.data);
        this.actoresMinero.set(actoresMinero);
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
   * No existe (por ahora) un GET por id de registro_mineral, así que buscamos
   * el registro dentro del listado ya cargado del componente padre vía
   * navegación. Si no se encuentra (ej. se entró directo por URL con F5),
   * mostramos un error y regresamos al listado.
   */
  private cargarRegistroParaEditar(): void {
    const registro = history.state?.registro;

    if (!registro || registro.id !== this.registroId) {
      this.snackBar.open(
        'No se encontró el registro a editar (recarga la página desde el listado)',
        'Cerrar',
        { duration: 5000 },
      );
      this.router.navigate(['/ui-components/recepcion-minerales']);
      return;
    }

    // Se guarda antes del patchValue: la reconstrucción de filas de leyes (disparada
    // por el valueChanges de idCodificacion dentro del patch) ya la necesita lista.
    this.detallesIniciales = registro.detalles;

    const fechaHoraRegistro = registro.fechaOperacion
      ? new Date(registro.fechaOperacion)
      : new Date();

    this.form.patchValue({
      idCodificacion: registro.idCodificacion,
      numeroSacos: registro.numeroSacos,
      pesoNeto: Number(registro.pesoNeto),
      anticipo: Number(registro.anticipo),
      fechaHoraOperacion: this.formatDatetimeLocal(fechaHoraRegistro),
      observaciones: registro.observaciones ?? '',
    });

    const proveedor = this.proveedores().find(
      (p) => p.id === registro.idPersona,
    );
    this.proveedorControl.setValue(proveedor ?? null);
  }

  displayProveedor = (persona: PersonaCI | string | null): string => {
    if (!persona || typeof persona === 'string') return persona ?? '';
    return `${this.nombreProveedor(persona)} — ${persona.numeroDocumento}`;
  };

  displayActor = (actor: ActorProductivoMinero | string | null): string => {
    if (!actor || typeof actor === 'string') return actor ?? '';
    return actor.nombre;
  };

  /** Lista base de proveedores: si hay un actor elegido, se acota a los que le pertenecen */
  private baseProveedores(): PersonaCI[] {
    const actor = this.actorControl.value;
    if (actor && typeof actor === 'object') {
      return this.proveedores().filter(
        (p) => String(p.idActorProductivoMinero) === String(actor.id),
      );
    }
    return this.proveedores();
  }

  private filtrarProveedores(texto: string): PersonaCI[] {
    const busqueda = texto.trim().toLowerCase();
    const base = this.baseProveedores();
    if (!busqueda) return base;

    return base.filter((p) => {
      const nombreCompleto = this.nombreProveedor(p).toLowerCase();
      return (
        nombreCompleto.includes(busqueda) ||
        p.numeroDocumento.toLowerCase().includes(busqueda)
      );
    });
  }

  private filtrarActores(texto: string): ActorProductivoMinero[] {
    const busqueda = texto.trim().toLowerCase();
    const lista = this.actoresMinero();
    if (!busqueda) return lista;
    return lista.filter((a) => a.nombre.toLowerCase().includes(busqueda));
  }

  /** Resuelve el actor productivo minero de una persona: usa el objeto anidado si
   *  viene incluido, o lo busca por id dentro del catálogo ya cargado. */
  private resolverActorDePersona(
    persona: PersonaCI,
  ): ActorProductivoMinero | null {
    if (persona.actorProductivoMinero) return persona.actorProductivoMinero;
    if (!persona.idActorProductivoMinero) return null;
    return (
      this.actoresMinero().find(
        (a) => String(a.id) === String(persona.idActorProductivoMinero),
      ) ?? null
    );
  }

  /** Reconstruye las filas de ley por mineral según la codificación elegida.
   *  Si se pasan detalles previos (edición), pre-carga sus leyes por idMineral. */
  private actualizarDetalles(
    idCodificacion: string | null,
    detallesPrevios?: DetalleMineralRegistro[],
  ): void {
    const codificacion = this.codificaciones().find(
      (c) => String(c.id) === String(idCodificacion),
    );
    const minerales = codificacion?.minerales ?? [];

    const filas: DetalleFormRow[] = minerales.map((m) => {
      const previa = detallesPrevios?.find(
        (d) => String(d.idMineral) === String(m.id),
      );
      const leyInicial = previa ? Number(previa.ley) : 0;
      const unidadInicial: LeyUnidad =
        previa?.leyUnidad ?? LEY_UNIDAD_POR_DEFECTO;

      const control = new FormControl<number | null>(
        leyInicial,
        this.validadoresLey(unidadInicial),
      );
      const unidadControl = new FormControl<LeyUnidad>(unidadInicial, {
        nonNullable: true,
      });

      // Si cambian la unidad (% <-> g/TM), se recalculan los límites de la ley
      // (100 como tope solo aplica a %; g/TM queda libre).
      unidadControl.valueChanges.subscribe((unidad) => {
        control.setValidators(this.validadoresLey(unidad));
        control.updateValueAndValidity({ emitEvent: false });
      });

      return {
        idMineral: String(m.id),
        descripcion: m.descripcion,
        simbolo: m.simbolo,
        control,
        unidadControl,
      };
    });

    this.detalleControls.set(filas);
  }

  nombreProveedor(persona: PersonaCI): string {
    return `${persona.nombres} ${persona.apellidoPaterno} ${persona.apellidoMaterno}`.trim();
  }

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

  /** Validadores de la ley según su unidad: en "%" no puede superar 100,
   *  en "g/TM" no tiene tope superior. Ambas permiten decimales y nunca negativos. */
  private validadoresLey(unidad: LeyUnidad): ValidatorFn[] {
    const base: ValidatorFn[] = [Validators.required, Validators.min(0)];
    return unidad === '%' ? [...base, Validators.max(100)] : base;
  }

  /** true si la codificación (por código o nombre) corresponde al tipo "cargas",
   *  para la cual el N° de sacos no es obligatorio */
  private codificacionEsCargas(idCodificacion: string | null): boolean {
    if (!idCodificacion) return false;
    const codificacion = this.codificaciones().find(
      (c) => String(c.id) === String(idCodificacion),
    );
    if (!codificacion) return false;
    const texto = `${codificacion.codigo} ${codificacion.nombre}`.toUpperCase();
    return texto.includes(CLAVE_CODIFICACION_CARGAS);
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

  cancelar(): void {
    this.router.navigate(['/ui-components/recepcion-minerales']);
  }

  guardar(): void {
    const filasInvalidas = this.detalleControls().some(
      (d) => d.control.invalid,
    );
    const sinMinerales = this.detalleControls().length === 0;

    if (
      this.form.invalid ||
      this.proveedorControl.invalid ||
      filasInvalidas ||
      sinMinerales
    ) {
      this.form.markAllAsTouched();
      this.proveedorControl.markAsTouched();
      this.detalleControls().forEach((d) => d.control.markAsTouched());

      const mensaje = sinMinerales
        ? 'La codificación elegida no tiene minerales configurados'
        : this.f.fechaHoraOperacion.hasError('fechaFutura')
          ? 'La fecha y hora de operación no puede ser futura'
          : 'Revisa los campos marcados en rojo';
      this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();
    const proveedor = this.proveedorControl.value as PersonaCI;
    const fechaHora = new Date(v.fechaHoraOperacion!);
    const observaciones =
      (v.observaciones ?? '').trim().toUpperCase() || 'SIN OBSERVACIONES';

    const request: GuardarRegistroMineralRequest = {
      ...(this.esEdicion ? { id: this.registroId! } : {}),
      idCodificacion: v.idCodificacion!,
      idPersona: proveedor.id,
      numeroSacos: v.numeroSacos ?? null,
      pesoNeto: v.pesoNeto!,
      anticipo: v.anticipo!,
      fechaOperacion: this.formatFechaHora(fechaHora),
      observaciones,
      detalles: this.detalleControls().map((d) => ({
        idMineral: Number(d.idMineral),
        ley: d.control.value ?? 0,
        leyUnidad: d.unidadControl.value,
      })),
    };

    this.registroMineralService.guardarRegistro(request).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion
            ? 'Recepción actualizada correctamente'
            : 'Recepción registrada correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.router.navigate(['/ui-components/recepcion-minerales']);
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
      .open(PersonaFormDialogComponent, { data, width: '600px' })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) {
          this.cargarProveedores(resultado.id);
        }
      });
  }

  private cargarProveedores(idParaSeleccionar?: string): void {
    this.personaService
      .listarPersonas({
        page: 1,
        limit: 1000,
        idTipoPersona: ID_TIPO_PERSONA_PROVEEDOR,
        activo: true,
      })
      .subscribe((resp) => {
        this.proveedores.set(resp.data);

        if (idParaSeleccionar) {
          const nuevo = resp.data.find((p) => p.id === idParaSeleccionar);
          if (nuevo) this.proveedorControl.setValue(nuevo);
        }
      });
  }
}
