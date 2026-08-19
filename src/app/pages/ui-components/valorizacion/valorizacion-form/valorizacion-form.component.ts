// src/app/pages/ui-components/valorizacion/valorizacion-form/valorizacion-form.component.ts
import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { CotizacionFormDialogComponent } from 'src/app/pages/configurations/parametricas/cotizacion/cotizacion-form-dialog.component';
import { EscalaPrecioFormDialogComponent } from 'src/app/pages/configurations/parametricas/escala-precio/escala-precio-form-dialog.component';
import {
  Cotizacion,
  EscalaPrecio,
  ExtrasGastoTratamiento,
  ExtrasPenalidad,
  Laboratorio,
  Mineral,
  TipoCalculoValorizacion,
} from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import {
  LeyUnidad,
  MineralResumen,
} from '../../models/registro-mineral.models';
import { VerRecepcionDialogComponent } from '../../recepcion-mineral/ver-recepcion-dialog/ver-recepcion-dialog.component';
import {
  ActualizarValorizacionRequest,
  AporteValorizacionRequest,
  CalculoValorizacionRequest,
  DetalleValorizacionRequest,
  ESTADO_VALORIZACION_BORRADOR_ID,
  ESTADO_VALORIZACION_PREVALORIZADO_ID,
  ESTADO_VALORIZACION_VALORIZADO_ID,
  EntidadAporte,
  TipoBaseAporteCatalogo,
  ValorizacionMineral,
} from '../../models/valorizacion-mineral.models';
import { ValorizacionMineralService } from '../../services/valorizacion-mineral.service';
import {
  DescuentoVisualizacion,
  LeyPrecioVisualizacion,
  VerValorizacionDialogComponent,
  VerValorizacionDialogData,
} from './ver-valorizacion-dialog/ver-valorizacion-dialog.component';
import { VerTablaPrecioDialogComponent } from './ver-tabla-precio-dialog/ver-tabla-precio-dialog.component';

/** Unidades disponibles para expresar la ley de un mineral. */
const LEY_UNIDADES: LeyUnidad[] = ['%', 'g/TM'];
const LEY_UNIDAD_POR_DEFECTO: LeyUnidad = '%';

/** Gramos por onza troy: solo se usa como respaldo si por algún motivo la
 *  cotización vigente de un mineral no trae su factorConversion (no debería
 *  pasar en operación normal, ya que sin cotización vigente no se deja
 *  valorizar). El factor real y correcto de cada mineral es el que devuelve
 *  el backend en `cotizacion.mineral.factorConversion`. */
const GRAMOS_POR_ONZA_TROY = 31.1035;

/** La codificación "RAM" es la única donde el mineral no viene fijo por la
 *  codificación de la recepción: el usuario puede elegir cualquiera del catálogo. */
const ID_CODIFICACION_RAM = '5';
const CLAVE_CODIFICACION_RAM = 'RAM';

/** BCL (Plata + Plomo) usa la fórmula del contrato de fundición (ver
 *  recalcularFilaLeyBcl), distinta de la estándar: descuento en puntos de
 *  ley (no de cotización) y, en Plata (ley "g/TM"), un % Adición aplicado
 *  después de recalcular la ley con el factor de conversión. */
const ID_CODIFICACION_BCL = '2';
const CLAVE_CODIFICACION_BCL = 'BCL';

/** Regalía minera no tiene alícuota configurada en su detalleAporte (a
 *  diferencia del resto de entidades de aporte): la suya sale de la suma de
 *  alicuotaInterna de las cotizaciones vigentes de los minerales que
 *  intervienen en la valorización. Se deja como sugerencia editable. */
const ID_REGALIA_MINERA = 60;

/** Entidades de aporte ("Descuentos de Ley") que se precargan por defecto en
 *  toda valorización nueva, cada una con un check para aplicarla o no. El
 *  usuario puede seguir agregando más entidades manualmente. */
const ENTIDADES_APORTE_POR_DEFECTO: Array<{
  id: number;
  tipoBaseAporte: TipoBaseAporteCatalogo;
}> = [
  { id: ID_REGALIA_MINERA, tipoBaseAporte: 'VBV' }, // Regalía minera
  { id: 2, tipoBaseAporte: 'VBV' }, // Caja Nacional de Salud
  { id: 1, tipoBaseAporte: 'VBV' }, // CORPORACION MINERA DE BOLIVIA - COMIBOL
  { id: 9, tipoBaseAporte: 'VBV' }, // FEDECOMIN - POTOSI R.L.
  { id: 12, tipoBaseAporte: 'VBV' }, // FENCOMIN TRADICIONAL R.L.
];

interface FilaLeyMineral {
  idMineral: number | null;
  ley: number | null;
  leyUnidad: LeyUnidad;
  /** Entero que se resta directo a la cotización vigente; si no viene guardado, se asume 0. */
  porcentajeCotizacion?: number;
  /** Entero tecleado por el liquidador (ver DetalleValorizacionRequest.precio). */
  precio?: number | null;
  /** Solo RAM: entero que se resta a la ley real (negativo para sumar) para
   *  buscar el tramo en la tabla de Escala de Precio (ver
   *  DetalleValorizacionRequest.ajustePuntosLey). */
  ajustePuntosLey?: number | null;
  /** Solo BCL: puntos que se restan a la ley recalculada antes de aplicar
   *  el precio. */
  descuentoLey?: number | null;
  /** Solo BCL: % Adición que multiplica a la ley aplicada antes de la
   *  cotización. Se teclea como porcentaje (ej. 83 = 83%), no como
   *  fracción. */
  porcentajeAdicion?: number | null;
}

/** Estado del autoguardado del borrador (se muestra junto a los botones). */
type EstadoAutoguardado = 'inactivo' | 'guardando' | 'guardado' | 'error';

/** Estado de verificación de la cotización vigente de UN mineral. Cada
 *  codificación puede mezclar varios minerales (BZL = Plata+Zinc, RAM =
 *  cualquiera), así que el control de "tiene cotización vigente" es por
 *  mineral, no uno solo global para toda la valorización. */
interface CotizacionMineralEstado {
  cargando: boolean;
  sinCotizacion: boolean;
  cotizacion: Cotizacion | null;
}

/** Igual que CotizacionMineralEstado pero para la tabla de Escala de Precio
 *  (solo RAM): reemplaza a la cotización de mercado como fuente del precio. */
interface EscalaPrecioMineralEstado {
  cargando: boolean;
  sinTabla: boolean;
  /** Tramos vigentes del mineral, ordenados por ley ascendente. */
  filas: EscalaPrecio[];
}

@Component({
  selector: 'app-valorizacion-form',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    MatTooltipModule,
  ],
  templateUrl: './valorizacion-form.component.html',
  styleUrl: './valorizacion-form.component.scss',
})
export class ValorizacionFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly valorizacionMineralService = inject(
    ValorizacionMineralService,
  );
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly ESTADO_VALORIZACION_BORRADOR_ID = ESTADO_VALORIZACION_BORRADOR_ID;
  /** Expuesto para el template (hint de Regalía Minera en la fila de aportes). */
  readonly ID_REGALIA_MINERA = ID_REGALIA_MINERA;
  readonly cargando = signal(true);
  /** Solo para el guardado explícito (botones Pre-valorizado/Valorizado). */
  readonly guardando = signal(false);
  readonly valorizacion = signal<ValorizacionMineral | null>(null);

  /** Estado del autoguardado del borrador, para el indicador junto a los botones. */
  readonly estadoAutoguardado = signal<EstadoAutoguardado>('inactivo');
  /** true por unos segundos justo después de un autoguardado exitoso: pinta
   *  de verde el indicador para que se note el "Borrador guardado", y luego
   *  vuelve solo a su color normal (ver resaltarAutoguardadoTemporalmente). */
  readonly autoguardadoResaltado = signal(false);
  private timeoutResaltado?: ReturnType<typeof setTimeout>;
  /** true mientras se hidratan los datos iniciales: evita que el primer
   *  patchValue dispare un autoguardado innecesario. */
  private cargandoInicial = true;
  /** Temporizador del debounce manual del autoguardado (ver programarAutoguardado). */
  private autoguardadoTimeout?: ReturnType<typeof setTimeout>;
  /** Mutex simple: true mientras hay un PATCH de guardado (auto o explícito)
   *  en vuelo hacia el backend. Evita que dos guardados corran en paralelo
   *  y que una respuesta vieja pise a una más nueva (ver autoguardarBorrador
   *  y confirmarYGuardarConEstado). */
  private guardadoEnCurso = false;

  /** Primer mineral de la codificación de la recepción: solo se usa para el
   *  encabezado. La ley/cotización real se maneja por fila (ver
   *  cotizacionesPorMineral), ya que una codificación puede traer varios. */
  readonly mineral = signal<MineralResumen | null>(null);

  /** true = usar Balanza T de la recepción; false (por defecto) = Balanza L. */
  readonly usarBalanzaT = signal(false);

  /** Peso bruto húmedo: viene de la balanza registrada en la recepción,
   *  Balanza L o Balanza T según lo que elija el usuario en el check. */
  readonly pesoBrutoHumedo = computed(() => {
    const rm = this.valorizacion()?.recepcionMineral;
    const valor = this.usarBalanzaT() ? rm?.balanzaT : rm?.balanzaL;
    return Number(valor ?? 0);
  });

  /** Cotización vigente de cada mineral usado en las filas de ley, indexada
   *  por idMineral. Se verifica mineral por mineral (no uno global) porque
   *  una misma codificación puede mezclar varios (BZL, BCL) o cualquiera
   *  (RAM). */
  readonly cotizacionesPorMineral = signal<Record<number, CotizacionMineralEstado>>({});

  /** Igual que cotizacionesPorMineral pero para la tabla de Escala de
   *  Precio: solo se usa/verifica cuando la codificación es RAM. */
  readonly escalaPrecioPorMineral = signal<Record<number, EscalaPrecioMineralEstado>>({});

  /** Líquido pagable, estándar = peso neto seco × suma de P/KL de todas las
   *  filas de ley; RAM = peso neto seco × Valor Tonelada (Bs) × 1000. */
  readonly valorBrutoVenta = signal(0);
  /** Saldo a pagar = líquido pagable − anticipo − total de aportes (descuentos de ley). */
  readonly valorLiquidoVentaBs = signal(0);
  /** Saldo a pagar en USD = saldo a pagar (Bs) ÷ tipo de cambio. 0 si aún no
   *  hay tipo de cambio cargado. */
  readonly saldoAPagarUsd = signal(0);
  /** Solo RAM: suma de USD/TM (tabla) de todas las filas de ley — informativo
   *  (igual que F12 = F9+F10+F11 en la planilla de referencia). No reemplaza
   *  a liquidoPagable, que sigue saliendo de la suma de P/KL por fila. */
  readonly totalUsdTmRam = signal(0);
  /** Solo RAM: Valor por Tonelada (Bs) = USD/TM Total × tipo de cambio ÷ 1000
   *  (igual que G13 = F12×F13÷1000 en la planilla de referencia). Informativo. */
  readonly valorToneladaBsRam = signal(0);
  /** Solo BCL: suma del "Total (USD/TM)" de todas las filas de ley (Plata +
   *  Plomo) — es la misma suma que ya usa recalcularTotales para el líquido
   *  bruto de ley, expuesta acá para mostrarla. */
  readonly totalUsdTmBcl = signal(0);

  readonly laboratorios = signal<Laboratorio[]>([]);
  readonly entidadesAporte = signal<EntidadAporte[]>([]);
  /** Solo entidades activas y con alícuotas configuradas (detalleAporte) son
   *  seleccionables — excepto Regalía Minera, que no tiene detalleAporte
   *  propio (su alícuota sale de la cotización vigente del mineral). */
  readonly entidadesAporteActivas = computed(() =>
    this.entidadesAporte().filter(
      (e) =>
        e.activo &&
        (Number(e.id) === ID_REGALIA_MINERA ||
          (Array.isArray(e.detalleAporte) && e.detalleAporte.length > 0)),
    ),
  );
  /** Catálogo completo de minerales: solo se usa como opciones cuando la codificación es RAM. */
  readonly mineralesCatalogo = signal<Mineral[]>([]);

  readonly leyUnidades = LEY_UNIDADES;

  /** Solo BCL: ley tecleada por el liquidador para cada elemento traza
   *  (As, Sb, Bi, Sn, Fe, SiO2), indexada por id del catálogo de
   *  Penalidades. */
  readonly leyesPenalidad = signal<Record<number, number>>({});

  /** Solo BCL: "Actual" tecleado por el liquidador para cada Gasto de
   *  Tratamiento (ej. cargo de maquila vigente al momento de liquidar),
   *  indexado por id del catálogo. Se compara contra "Base" (ver
   *  basesGastoBcl) para calcular el ajuste por escalador, tal cual la
   *  sección "GASTOS DE TRATAMIENTO" del contrato de fundición de
   *  referencia. */
  readonly actualesGastoBcl = signal<Record<number, number>>({});

  /** Solo BCL: "Base" de cada Gasto de Tratamiento, indexada por id del
   *  catálogo. Se precarga con `extras.base` del catálogo pero el
   *  liquidador puede sobreescribirla por valorización (ver gastoBase). */
  readonly basesGastoBcl = signal<Record<number, number>>({});

  /** Solo en la codificación RAM el mineral es de libre elección; en el resto,
   *  el mineral viene fijo por la codificación de la recepción. */
  readonly esCodificacionRam = computed(() => {
    const cod = this.valorizacion()?.recepcionMineral?.codificacion;
    if (!cod) return false;
    const texto = `${cod.codigo ?? ''} ${cod.nombre ?? ''}`.toUpperCase();
    return (
      String(cod.id) === ID_CODIFICACION_RAM ||
      texto.includes(CLAVE_CODIFICACION_RAM)
    );
  });

  /** BCL (Plata + Plomo): fórmula propia del contrato de fundición (ver
   *  recalcularFilaLeyBcl), separada de la estándar y de RAM. */
  readonly esCodificacionBcl = computed(() => {
    const cod = this.valorizacion()?.recepcionMineral?.codificacion;
    if (!cod) return false;
    const texto = `${cod.codigo ?? ''} ${cod.nombre ?? ''}`.toUpperCase();
    return (
      String(cod.id) === ID_CODIFICACION_BCL ||
      texto.includes(CLAVE_CODIFICACION_BCL)
    );
  });

  private valorizacionId!: string;

  get esEditable(): boolean {
    return (
      this.valorizacion()?.idEstadoValorizacion ===
      ESTADO_VALORIZACION_BORRADOR_ID
    );
  }

  get puedeValorizar(): boolean {
    return (
      this.esEditable &&
      !this.verificandoPrecioVigente &&
      this.mineralesSinPrecioVigente.length === 0
    );
  }

  /** true mientras se está consultando /cotizacion/vigente/:id de cualquiera
   *  de los minerales usados en las filas de ley. */
  get verificandoCotizacion(): boolean {
    const estados = this.cotizacionesPorMineral();
    return this.idsMineralesEnFilas().some((id) => estados[id]?.cargando);
  }

  /** Minerales usados en las filas de ley que NO tienen cotización vigente
   *  ahora mismo; mientras esta lista no esté vacía no se puede guardar. */
  get mineralesSinCotizacion(): Array<{
    id: number;
    descripcion: string;
    simbolo?: string;
  }> {
    const estados = this.cotizacionesPorMineral();
    return this.idsMineralesEnFilas()
      .filter((id) => estados[id]?.sinCotizacion)
      .map((id) => {
        const mineral = this.buscarMineralPorId(id);
        return {
          id,
          descripcion: mineral?.descripcion ?? `Mineral #${id}`,
          simbolo: mineral?.simbolo,
        };
      });
  }

  /** Igual que verificandoCotizacion pero consultando la tabla de Escala de
   *  Precio (solo relevante en RAM). */
  get verificandoEscalaPrecio(): boolean {
    const estados = this.escalaPrecioPorMineral();
    return this.idsMineralesEnFilas().some((id) => estados[id]?.cargando);
  }

  /** Igual que mineralesSinCotizacion pero para minerales sin tabla de
   *  Escala de Precio vigente (solo relevante en RAM). */
  get mineralesSinEscalaPrecio(): Array<{
    id: number;
    descripcion: string;
    simbolo?: string;
  }> {
    const estados = this.escalaPrecioPorMineral();
    return this.idsMineralesEnFilas()
      .filter((id) => estados[id]?.sinTabla)
      .map((id) => {
        const mineral = this.buscarMineralPorId(id);
        return {
          id,
          descripcion: mineral?.descripcion ?? `Mineral #${id}`,
          simbolo: mineral?.simbolo,
        };
      });
  }

  /** Fuente de verdad para el gating de guardado: cotización de mercado en
   *  el resto de codificaciones, tabla de Escala de Precio en RAM. */
  get verificandoPrecioVigente(): boolean {
    return this.esCodificacionRam()
      ? this.verificandoEscalaPrecio
      : this.verificandoCotizacion;
  }

  get mineralesSinPrecioVigente(): Array<{
    id: number;
    descripcion: string;
    simbolo?: string;
  }> {
    return this.esCodificacionRam()
      ? this.mineralesSinEscalaPrecio
      : this.mineralesSinCotizacion;
  }

  /** ids únicos (sin repetir) de los minerales seleccionados en las filas de ley actuales. */
  private idsMineralesEnFilas(): number[] {
    const ids = this.detallesMineralesArray.controls
      .map((c) => c.get('idMineral')?.value)
      .filter((id) => id != null)
      .map((id) => Number(id));
    return Array.from(new Set(ids));
  }

  private buscarMineralPorId(id: number): Mineral | MineralResumen | undefined {
    const delCatalogo = this.mineralesCatalogo().find(
      (m) => Number(m.id) === id,
    );
    if (delCatalogo) return delCatalogo;
    const deCodificacion =
      this.valorizacion()?.recepcionMineral?.codificacion?.minerales ?? [];
    return deCodificacion.find((m) => Number(m.id) === id);
  }

  /** true si el mineral de la fila es Plata (por nombre o símbolo del
   *  catálogo): en BCL esto es lo que determina la fórmula/campos de la
   *  fila (ver recalcularFilaLeyBcl), NO la unidad de ley elegida —
   *  "leyUnidad" es solo una etiqueta que se muestra junto al número, sin
   *  ningún efecto en el cálculo ni en qué campos se ven. */
  esMineralPlata(idMineral: number | string | null | undefined): boolean {
    if (idMineral == null) return false;
    const mineral = this.buscarMineralPorId(Number(idMineral));
    if (!mineral) return false;
    const descripcion = (mineral.descripcion ?? '').toUpperCase();
    const simbolo = (mineral.simbolo ?? '').toUpperCase();
    return descripcion.includes('PLATA') || simbolo === 'AG';
  }

  // ==========================================================
  // FORMULARIO
  // ==========================================================

  /** Momento exacto en que se abrió el formulario: es lo que se guarda en fechaValorizacion. */
  private readonly fechaTransaccion = new Date();
  readonly fechaTransaccionTexto = this.formatFechaHoraLocal(
    this.fechaTransaccion,
  );

  readonly form: FormGroup = this.fb.group({
    idLaboratorio: [null as number | null, [Validators.required]],
    fechaValorizacion: [this.fechaTransaccion, [Validators.required]],
    // pesoNetoHumedoKilogramos: [
    //   null as number | null,
    //   [Validators.required, Validators.min(0)],
    // ],
    taraKilogramos: [0, [Validators.min(0)]],
    humedadPorcentaje: [0, [Validators.min(0)]],
    mermaPorcentaje: [0, [Validators.min(0)]],
    mermaKilogramos: [0, [Validators.min(0)]],
    /** Solo BCL: peso bruto húmedo − agua (peso bruto húmedo × humedad%).
     *  No aplica en RAM/estándar (ver recalcularPesoNetoSeco). */
    pesoBrutoSecoKilogramos: [null as number | null],
    /** Calculado: peso bruto húmedo − (peso bruto húmedo × humedad%) en
     *  RAM/estándar; peso bruto seco − merma en BCL (ver
     *  recalcularPesoNetoSeco/recalcularPesoNetoSecoBcl). */
    pesoNetoSecoKilogramos: [null as number | null],
    /** El liquidador lo teclea manualmente (no viene de ningún catálogo). */
    tipoCambio: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    /** Ajuste manual que teclea el operador: positivo suma al saldo a
     *  pagar, negativo resta. 0 si no se ingresa nada. */
    ajusteTransporte: [0 as number | null],
    /** Otro anticipo aparte del de la recepción: siempre resta al saldo a
     *  pagar. Debe ser 0 o mayor. */
    otrosAnticipo: [0 as number | null, [Validators.min(0)]],
    aportes: this.fb.array([]),
    detallesMinerales: this.fb.array([]),
  });

  get aportesArray(): FormArray {
    return this.form.get('aportes') as FormArray;
  }

  get detallesMineralesArray(): FormArray {
    return this.form.get('detallesMinerales') as FormArray;
  }

  /** Bases de cálculo disponibles para un aporte (catálogo estático VBV/VNV). */
  readonly basesAporte: TipoBaseAporteCatalogo[] = ['VBV', 'VNV'];

  /** Suma de las alícuotas (%) de todos los aportes agregados. */
  readonly totalAlicuotas = signal(0);
  /** Suma de los importes (Bs) de todos los aportes agregados. */
  readonly totalImporteAportes = signal(0);

  // ==========================================================
  // CICLO DE VIDA
  // ==========================================================

  ngOnInit(): void {
    this.valorizacionId = this.route.snapshot.paramMap.get('id')!;

    this.form.get('pesoNetoSecoKilogramos')?.disable({ emitEvent: false });
    this.form.get('pesoBrutoSecoKilogramos')?.disable({ emitEvent: false });
    // Calculado a partir de mermaPorcentaje (ver recalcularPesoNetoSecoBcl);
    // no se editaba desde ningún lado hoy (el campo estaba sin usar fuera
    // de BCL), así que deshabilitarlo no cambia nada para RAM/estándar.
    this.form.get('mermaKilogramos')?.disable({ emitEvent: false });
    this.form
      .get('humedadPorcentaje')!
      .valueChanges.subscribe(() => this.recalcularPesoNetoSeco());
    // Solo tiene efecto en BCL (ver recalcularPesoNetoSecoBcl); en
    // RAM/estándar la merma no participa del cálculo, así que esta
    // suscripción no cambia nada para esos casos.
    this.form
      .get('mermaPorcentaje')!
      .valueChanges.subscribe(() => this.recalcularPesoNetoSeco());
    this.form
      .get('tipoCambio')!
      .valueChanges.subscribe(() => this.recalcularTodasLasFilasLey());
    this.form
      .get('ajusteTransporte')!
      .valueChanges.subscribe(() => this.recalcularTotalesAportes());
    this.form
      .get('otrosAnticipo')!
      .valueChanges.subscribe(() => this.recalcularTotalesAportes());

    // Autoguardado de borrador: cualquier cambio del usuario en el form
    // (pesos, merma, filas de ley, aportes, etc.) dispara, con debounce
    // manual (programarAutoguardado), un PATCH parcial. Mientras se hidratan
    // los datos iniciales (cargandoInicial) se ignora para no autoguardar
    // apenas se abre el formulario.
    this.form.valueChanges.subscribe(() => {
      if (!this.cargandoInicial) this.programarAutoguardado();
    });

    this.parametricasService.obtenerLaboratorios().subscribe((data) => {
      this.laboratorios.set(data);
    });
    this.parametricasService
      .obtenerAllEntidadesAporte()
      .subscribe((data: EntidadAporte[]) => this.entidadesAporte.set(data));
    // Solo se usa en BCL (Gastos de Tratamiento y Penalidades), pero se
    // carga siempre igual que el resto de catálogos: no depende de datos
    // de la valorización, así que no hay riesgo de carrera que resolver.
    this.parametricasService.cargarTipoCalculoValorizacion();

    // El catálogo de minerales tiene que estar cargado ANTES de armar las
    // filas de ley (ver inicializarDetallesMinerales/opcionesMineral): en
    // RAM, el <mat-select> de cada fila arma sus opciones a partir de este
    // catálogo, así que si se dispara en paralelo con cargarValorizacion()
    // puede ganar la carrera y renderizar el select sin la opción del
    // mineral ya guardado (queda en blanco al recargar la página).
    this.parametricasService
      .obtenerMinerales()
      .pipe(finalize(() => this.cargarValorizacion()))
      .subscribe({
        next: (data) => this.mineralesCatalogo.set(data),
        error: () => {},
      });
  }

  ngOnDestroy(): void {
    if (this.autoguardadoTimeout) clearTimeout(this.autoguardadoTimeout);
    if (this.timeoutResaltado) clearTimeout(this.timeoutResaltado);
  }

  private cargarValorizacion(): void {
    this.cargando.set(true);
    this.valorizacionMineralService
      .obtenerPorId(this.valorizacionId)
      .subscribe({
        next: (v) => {
          this.inicializarConValorizacion(v);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.snackBar.open('No se pudo cargar la valorización', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  private inicializarConValorizacion(v: ValorizacionMineral): void {
    this.valorizacion.set(v);
    this.usarBalanzaT.set(this.resolverUsarBalanzaTInicial(v));
    // Antes de cualquier recalcularTotales() (que ya arranca con el
    // patchValue de abajo): si no están cargadas todavía, los totales de
    // gastos/penalidades BCL salen en 0 y se corrigen recién con la
    // primera edición manual.
    this.leyesPenalidad.set(this.resolverLeyesPenalidadInicial(v));
    this.actualesGastoBcl.set(this.resolverActualesGastoInicial(v));
    this.basesGastoBcl.set(this.resolverBasesGastoInicial(v));

    // Se usa solo para el encabezado (nombre a mostrar); la codificación
    // puede traer varios minerales (ej. BZL -> Plata + Zinc), cada uno se
    // valoriza con su propia cotización vigente y factorConversion.
    const mineral = v.recepcionMineral?.codificacion?.minerales?.[0] ?? null;
    this.mineral.set(mineral);

    this.form.patchValue({
     // pesoNetoHumedoKilogramos:Number(v.recepcionMineral?.balanzaL ?? 0) || null,
      humedadPorcentaje: this.resolverHumedadInicial(v),
      idLaboratorio: v.idLaboratorio ?? null,
      tipoCambio: v.cotizacionDolar != null ? Number(v.cotizacionDolar) : null,
      taraKilogramos: v.taraKilogramos != null ? Number(v.taraKilogramos) : 0,
      mermaPorcentaje:
        v.mermaPorcentaje != null ? Number(v.mermaPorcentaje) : 0,
      mermaKilogramos:
        v.mermaKilogramos != null ? Number(v.mermaKilogramos) : 0,
      pesoBrutoSecoKilogramos:
        v.pesoBrutoSecoKilogramos != null
          ? Number(v.pesoBrutoSecoKilogramos)
          : null,
      ajusteTransporte:
        v.ajusteTransporte != null ? Number(v.ajusteTransporte) : 0,
      otrosAnticipo:
        v.otrosAnticipo != null ? Number(v.otrosAnticipo) : 0,
    });
    this.recalcularPesoNetoSeco();
    // Va antes de inicializarDetallesMinerales a propósito: cada fila que se
    // agrega ahí recalcula su Precio por kilo usando el tipoCambio ya
    // patcheado arriba (si no, quedaría en 0 al recuperar un borrador).
    this.inicializarDetallesMinerales(v);
    // También antes de bajar cargandoInicial: reconstruir el FormArray de
    // aportes (un push por fila) dispara valueChanges igual que cualquier
    // otro control, así que si esto corriera después de cargandoInicial=false
    // dispararía un autoguardado solo por abrir la página, sin que el
    // usuario haya modificado nada. El autoguardado de los defaults recién
    // calculados queda para la primera modificación real o el próximo
    // cambio de step (ver onCambioStep), no para la carga inicial.
    this.inicializarAportes(v);

    // Recién ahora se considera "hidratado": los patchValue/pushes de
    // arriba no deben disparar un autoguardado apenas se abre el formulario.
    this.cargandoInicial = false;
  }

  /** Humedad inicial: prioriza la ya guardada en la valorización; si no
   *  existe, cae a la registrada en la recepción de mineral asociada. */
  private resolverHumedadInicial(v: ValorizacionMineral): number {
    if (v.humedadPorcentaje != null) return Number(v.humedadPorcentaje);
    if (v.recepcionMineral?.humedad != null)
      return Number(v.recepcionMineral.humedad);
    return 0;
  }

  /** Restaura qué balanza (L o T) se usó la última vez que se guardó esta
   *  valorización. El back no tiene un campo dedicado para esto, así que se
   *  infiere comparando el peso bruto húmedo ya persistido contra la
   *  Balanza T de la recepción; si no matchea (o es un borrador nuevo, sin
   *  nada guardado todavía), se asume Balanza L, el default de siempre. */
  private resolverUsarBalanzaTInicial(v: ValorizacionMineral): boolean {
    if (v.pesoBrutoHumedoKilogramos == null) return false;
    const balanzaT = v.recepcionMineral?.balanzaT;
    if (balanzaT == null) return false;
    return (
      Math.abs(Number(v.pesoBrutoHumedoKilogramos) - Number(balanzaT)) < 0.001
    );
  }

  // ==========================================================
  // LEY MINERAL (dinámico, con edición confirmada por fila)
  // ==========================================================

  /** Carga inicial de filas: una por cada detalle ya guardado y, si la
   *  codificación NO es RAM, una fila vacía adicional por cada mineral de la
   *  codificación que aún no tenga un detalle guardado. Fuera de RAM el
   *  mineral queda bloqueado (fijo por la codificación); en RAM, editable. */
  private inicializarDetallesMinerales(v: ValorizacionMineral): void {
    this.detallesMineralesArray.clear();

    const detallesGuardados = v.detalles ?? [];
    const esRam = this.esCodificacionRam();

    detallesGuardados.forEach((d) => {
      this.agregarFilaLey(
        {
          idMineral: Number(d['idMineral']),
          ley: Number(d['ley']),
          leyUnidad: (d['leyUnidad'] as LeyUnidad) ?? LEY_UNIDAD_POR_DEFECTO,
          porcentajeCotizacion:
            d['porcentajeCotizacion'] != null
              ? Number(d['porcentajeCotizacion'])
              : undefined,
          precio: d['precio'] != null ? Number(d['precio']) : null,
          ajustePuntosLey:
            d['ajustePuntosLey'] != null ? Number(d['ajustePuntosLey']) : null,
          descuentoLey:
            d['descuentoLey'] != null ? Number(d['descuentoLey']) : null,
          porcentajeAdicion:
            d['porcentajeAdicion'] != null
              ? Number(d['porcentajeAdicion'])
              : null,
        },
        !esRam,
      );
    });

    if (!esRam) {
      const idsGuardados = new Set(
        detallesGuardados.map((d) => String(d['idMineral'])),
      );
      const mineralesCodificacion =
        v.recepcionMineral?.codificacion?.minerales ?? [];

      mineralesCodificacion
        .filter((m) => !idsGuardados.has(String(m.id)))
        .forEach((m) => {
          this.agregarFilaLey(
            {
              idMineral: Number(m.id),
              ley: null,
              leyUnidad: LEY_UNIDAD_POR_DEFECTO,
            },
            true,
          );
        });
    }
  }

  /** @param mineralBloqueado true = el select de mineral queda deshabilitado (codificación fija) */
  private agregarFilaLey(
    valor: FilaLeyMineral,
    mineralBloqueado: boolean,
  ): void {
    const esRam = this.esCodificacionRam();
    const esBcl = this.esCodificacionBcl();
    const fila = this.fb.group({
      idMineral: [
        { value: valor.idMineral, disabled: mineralBloqueado },
        [Validators.required],
      ],
      ley: [valor.ley, [Validators.required, Validators.min(0)]],
      leyUnidad: [valor.leyUnidad, [Validators.required]],
      /** Entero tecleado por el liquidador que se resta directo a la
       *  cotización vigente; 0 = se reconoce la cotización vigente completa.
       *  No se usa en RAM (ver ajustePuntosLey). En BCL también aplica
       *  (ver recalcularFilaLeyBcl). */
      porcentajeCotizacion: [
        valor.porcentajeCotizacion ?? 0,
        [Validators.required, Validators.min(0)],
      ],
      /** Calculado: cotización vigente − descuento cotización. No aplica en RAM. */
      cotizacionAplicada: [{ value: 0, disabled: true }],
      /** Entero tecleado por el liquidador; se antepone "0.0000" para formar
       *  el factor que usa Ley Pagable (ej. 45 → 0.000045). Se persiste en el
       *  detalle guardado para poder retomar el borrador sin perderlo.
       *  No se usa en RAM ni en BCL (por eso no es requerido en esos casos). */
      precio: [
        valor.precio ?? (null as number | null),
        esRam || esBcl ? [] : [Validators.required, Validators.min(1)],
      ],
      /** Calculado: cotización vigente / factorConversion del mineral × ley × factor de "precio". No aplica en RAM ni en BCL. */
      leyPagable: [{ value: 0, disabled: true }],
      /** Solo BCL: puntos que se restan a la ley recalculada antes de
       *  aplicar el precio. */
      descuentoLey: [valor.descuentoLey ?? 0],
      /** Solo BCL: ley recalculada − descuento de ley (ver
       *  recalcularFilaLeyBcl). No se muestra como campo aparte (es
       *  derivado de ley y descuento de ley, ya visibles). */
      leyAplicada: [{ value: 0, disabled: true }],
      /** Solo BCL: % Adición que multiplica a la ley aplicada; se teclea
       *  como porcentaje (ej. 83), 100 = se reconoce el 100%. */
      porcentajeAdicion: [valor.porcentajeAdicion ?? 100],
      /** Solo BCL, Plomo: cotización vigente × factorConversion × 1000.
       *  Informativo por ahora, todavía no alimenta el Total (ver
       *  recalcularFilaLeyBcl — pendiente de definir el cálculo siguiente). */
      cotizacionAjustada: [{ value: 0, disabled: true }],
      /** Solo BCL: USD/TM antes de convertir a precio por kilo (ver
       *  recalcularFilaLeyBcl). */
      totalUsdTm: [{ value: 0, disabled: true }],
      /** Solo RAM: entero que el liquidador resta a la ley real para buscar
       *  el tramo en la tabla de Escala de Precio (negativo para sumar). */
      ajustePuntosLey: [valor.ajustePuntosLey ?? 0],
      /** Solo RAM, calculado: ley + ajustePuntosLey. */
      leyAjustada: [{ value: 0, disabled: true }],
      /** Solo RAM, calculado: USD/Punto del tramo de la tabla que le corresponde a leyAjustada. */
      precioPuntoEscala: [{ value: 0, disabled: true }],
      /** Solo RAM, calculado: USD/TM del tramo (ley del tramo × su USD/Punto). */
      precioTmEscala: [{ value: 0, disabled: true }],
      /** Calculado: ley pagable × 1000 × tipo de cambio (estándar) o
       *  (precioTmEscala / 1000) × tipo de cambio (RAM). */
      precioPorKilo: [{ value: 0, disabled: true }],
      /** Calculado: precio por kilo redondeado. */
      pKl: [{ value: 0, disabled: true }],
    });
    this.detallesMineralesArray.push(fila);
    if (esRam) {
      this.verificarEscalaPrecioMineral(valor.idMineral);
    } else {
      this.verificarCotizacionMineral(valor.idMineral);
    }
    this.recalcularFilaLey(this.detallesMineralesArray.length - 1);
  }

  /** cotización aplicada = cotización vigente del mineral − descuento cotización (entero)
   *  factor de precio = "0.0000" + entero tecleado en "precio" (ej. 45 → 0.000045)
   *  ley pagable = cotización aplicada / factorConversion del mineral × ley × factor de precio
   *  precio por kilo = ley pagable × 1000 × tipo de cambio
   *  P/KL = precio por kilo redondeado hacia abajo (truncado)
   *
   *  En RAM la fórmula es otra (ver recalcularFilaLeyRam): no hay cotización
   *  de mercado, el precio sale de la tabla de Escala de Precio del mineral. */
  recalcularFilaLey(i: number): void {
    const fila = this.detallesMineralesArray.at(i);
    if (!fila) return;

    if (this.esCodificacionRam()) {
      this.recalcularFilaLeyRam(fila);
    } else if (this.esCodificacionBcl()) {
      this.recalcularFilaLeyBcl(fila);
    } else {
      this.recalcularFilaLeyEstandar(fila);
    }

    this.recalcularTotales();
  }

  /** Fórmula propia de BCL (Plata + Plomo), tal cual el contrato de
   *  fundición de referencia — distinta de la estándar. Campos comunes a
   *  ambos minerales:
   *  ley recalculada = ley ÷ factorConversion × 100
   *  ley aplicada = ley recalculada − descuentoLey (solo se usa en el
   *  Total de Plata; en Plomo es informativa)
   *  cotización vigente = la de mercado tal cual (sin descuento)
   *  cotización ajustada (solo Plomo) = cotización vigente × factorConversion × 1000
   *
   *  Total (USD/TM):
   *   - Plata: ley aplicada × (% Adición ÷ 100) × cotización vigente. "%
   *     Adición" se teclea como porcentaje (ej. 83 = 83%), no como fracción.
   *   - Plomo: (ley − descuentoLey) × cotización ajustada ÷ 100.
   *
   *  El Total se calcula encadenando los valores SIN redondear los
   *  intermedios (leyAplicada, cotización ajustada) — igual que el
   *  contrato de fundición de referencia, que solo redondea el resultado
   *  final. Los campos leyAplicada/cotizacionAjustada que se guardan y
   *  muestran en pantalla sí van redondeados (son solo para mostrar), pero
   *  el Total usa las versiones exactas para no perder precisión.
   *
   *  BCL no calcula "Precio por kilo" ni "P/KL" (no aplican en esta
   *  codificación): el líquido pagable sale directo de sumar el USD/TM de
   *  todas las filas × peso neto seco (TMS) × tipo de cambio, ver
   *  recalcularTotales. */
  private recalcularFilaLeyBcl(fila: AbstractControl): void {
    const idMineral = fila.get('idMineral')?.value;
    const ley = Number(fila.get('ley')?.value ?? 0);
    const descuentoLey = Number(fila.get('descuentoLey')?.value ?? 0);
    // Se teclea como porcentaje (ej. 83 = 83%), no como fracción — por eso
    // se divide entre 100 antes de multiplicar.
    const porcentajeAdicion = Number(
      fila.get('porcentajeAdicion')?.value ?? 100,
    );

    const factorConversion = this.factorConversionMineral(idMineral);
    const leyRecalculadaExacta = (ley / factorConversion) * 100;
    const leyAplicadaExacta = leyRecalculadaExacta - descuentoLey;
    // Redondeados solo para mostrar en pantalla/guardar (ver comentario de
    // arriba: el Total usa las versiones exactas de arriba, no estas).
    const leyAplicada = this.redondear(leyAplicadaExacta, 3);

    // Se muestra tal cual, con todos sus decimales (sin redondear).
    const cotizacionAplicada = this.cotizacionUSDMineral(idMineral);

    const esPlata = this.esMineralPlata(idMineral);

    const cotizacionAjustadaExacta = esPlata
      ? 0
      : cotizacionAplicada * factorConversion * 1000;
    // Solo Plomo. A diferencia de cotizacionAplicada, esta sí se redondea
    // a entero para mostrar (el Total sigue usando la versión exacta).
    const cotizacionAjustada = esPlata
      ? 0
      : this.redondear(cotizacionAjustadaExacta, 0);

    const precioTm = esPlata
      ? this.redondear(
          leyAplicadaExacta * (porcentajeAdicion / 100) * cotizacionAplicada,
          4,
        )
      : this.redondear(
          ((ley - descuentoLey) * cotizacionAjustadaExacta) / 100,
          4,
        );

    fila.patchValue(
      { leyAplicada, cotizacionAplicada, cotizacionAjustada, totalUsdTm: precioTm },
      { emitEvent: false },
    );
  }

  // ==========================================================
  // GASTOS DE TRATAMIENTO Y PENALIDADES (solo BCL)
  // ==========================================================

  /** Gastos de tratamiento activos del catálogo (Maquila, Ajuste de
   *  maquila, Gastos de refinación Ag...). El liquidador teclea el
   *  "Actual" de cada uno (ver gastoActual); Base y Escalador salen del
   *  catálogo. */
  get gastosActivosBcl(): TipoCalculoValorizacion<ExtrasGastoTratamiento>[] {
    return this.parametricasService.gastosTratamiento().filter((g) => g.activo);
  }

  /** Penalidades activas del catálogo (As, Sb, Bi, Sn, Fe, SiO2). La única
   *  entrada del liquidador es la ley de cada una (ver leyPenalidad). */
  get penalidadesActivasBcl(): TipoCalculoValorizacion<ExtrasPenalidad>[] {
    return this.parametricasService.penalidadesValorizacion().filter((p) => p.activo);
  }

  leyPenalidad(id: number): number {
    return this.leyesPenalidad()[id] ?? 0;
  }

  onLeyPenalidadChange(id: number, valor: string): void {
    const ley = Number(valor) || 0;
    this.leyesPenalidad.update((actual) => ({ ...actual, [id]: ley }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  gastoActual(id: number): number {
    return this.actualesGastoBcl()[id] ?? 0;
  }

  onGastoActualChange(id: number, valor: string): void {
    const actual = Number(valor) || 0;
    this.actualesGastoBcl.update((actuales) => ({ ...actuales, [id]: actual }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** Base de un Gasto de Tratamiento: se precarga con la del catálogo
   *  (`extras.base`) pero el liquidador puede sobreescribirla por
   *  valorización (ver onGastoBaseChange) — a diferencia de Escalador, que
   *  siempre viene fijo del catálogo. */
  gastoBase(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): number {
    const sobrescrita = this.basesGastoBcl()[gasto.id];
    return sobrescrita ?? Number(gasto.extras?.base ?? 0);
  }

  onGastoBaseChange(id: number, valor: string): void {
    const base = Number(valor) || 0;
    this.basesGastoBcl.update((bases) => ({ ...bases, [id]: base }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** Peso neto seco en toneladas métricas secas (TMS): base de cálculo de
   *  Penalidades. */
  private pesoNetoSecoTms(): number {
    return Number(this.form.get('pesoNetoSecoKilogramos')?.value ?? 0) / 1000;
  }

  /** Gasto de tratamiento, tal cual la sección "GASTOS DE TRATAMIENTO" del
   *  contrato de fundición de referencia:
   *  diferencia = Actual − Base (ambos tecleados por el liquidador)
   *  Importe (Bs) = Escalador (catálogo) × diferencia — directo, sin tipo
   *  de cambio ni ninguna cantidad (TMS/oz) de por medio. */
  calcularGastoBcl(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): {
    actual: number;
    base: number;
    diferencia: number;
    escalador: number;
    importeBs: number;
  } {
    const actual = this.gastoActual(gasto.id);
    const base = this.gastoBase(gasto);
    const escalador = Number(gasto.extras?.escalador ?? 0);
    const diferencia = this.redondear(actual - base, 4);
    const importeBs = this.redondear(escalador * diferencia, 2);
    return { actual, base, diferencia, escalador, importeBs };
  }

  /** Penalidad, tal cual la sección "PENALIDADES" del contrato de fundición
   *  de referencia:
   *  Importe (Bs) = SI(ley > leyLibre, ((ley − leyLibre) × cargo) ÷ cada, 0)
   *  — directo, sin multiplicar por peso neto seco ni tipo de cambio (igual
   *  que Gastos de Tratamiento, ver calcularGastoBcl). "cada" se guarda tal
   *  cual se ve en el catálogo (ej. 0.10 para "0.10%"), no como fracción
   *  (0.001). Redondeado a 2 decimales (ley general de redondeo: ≥5 sube). */
  calcularPenalidadBcl(penalidad: TipoCalculoValorizacion<ExtrasPenalidad>): {
    ley: number;
    importeBs: number;
  } {
    const ley = this.leyPenalidad(penalidad.id);
    const leyLibre = Number(penalidad.extras?.leyLibre ?? 0);
    const cada = Number(penalidad.extras?.cada ?? 0) || 1;
    const cargo = Number(penalidad.extras?.cargo ?? 0);
    const importeBs =
      ley > leyLibre
        ? this.redondear(((ley - leyLibre) * cargo) / cada, 2)
        : 0;
    return { ley, importeBs };
  }

  /** Suma en Bs de todos los gastos de tratamiento + penalidades activos:
   *  se resta del líquido pagable bruto de ley (ver recalcularTotales).
   *  Público: también lo usa el template para mostrar el total. */
  totalGastosYPenalidadesBcl(): number {
    const gastos = this.gastosActivosBcl.reduce(
      (acc, g) => acc + this.calcularGastoBcl(g).importeBs,
      0,
    );
    const penalidades = this.penalidadesActivasBcl.reduce(
      (acc, p) => acc + this.calcularPenalidadBcl(p).importeBs,
      0,
    );
    return this.redondear(gastos + penalidades, 2);
  }

  /** Valor Neto TM = Total (USD/TM) − Total Gastos + Penalidades (Bs), tal
   *  cual "VALOR NETO TM" del contrato de fundición de referencia.
   *  Público: lo usa el template para mostrar el total. */
  valorNetoTmBcl(): number {
    return this.redondear(
      this.totalUsdTmBcl() - this.totalGastosYPenalidadesBcl(),
      2,
    );
  }

  /** Arma las filas de `calculos` para el PATCH: snapshot de lo que se usó
   *  en el cálculo (no solo el resultado), para que la valorización
   *  guardada no cambie si el catálogo se edita después. */
  private construirCalculosBcl(): CalculoValorizacionRequest[] {
    const gastos: CalculoValorizacionRequest[] = this.gastosActivosBcl.map(
      (g) => {
        const { actual, base, diferencia, escalador, importeBs } =
          this.calcularGastoBcl(g);
        return {
          idTipoCalculoValorizacion: g.id,
          // "Base sobre la que se aplicó la tasa" (escalador) es la
          // diferencia Actual−Base; los gastos de tratamiento ya no usan
          // TMS/oz (ver calcularGastoBcl).
          baseCalculo: diferencia,
          importeBolivianos: importeBs,
          valorAplicado: actual,
          extras: { actual, base, diferencia, escalador },
        };
      },
    );
    const penalidades: CalculoValorizacionRequest[] =
      this.penalidadesActivasBcl.map((p) => {
        const { ley, importeBs } = this.calcularPenalidadBcl(p);
        return {
          idTipoCalculoValorizacion: p.id,
          baseCalculo: this.redondear(this.pesoNetoSecoTms(), 4),
          importeBolivianos: importeBs,
          extras: { ley, leyLibre: p.extras?.leyLibre, cargo: p.extras?.cargo },
        };
      });
    return [...gastos, ...penalidades];
  }

  /** Restaura las leyes de penalidad ya guardadas (extras.ley de cada fila
   *  de `calculos`), indexadas por id del catálogo. */
  private resolverLeyesPenalidadInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const leyes: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as { ley?: number } | undefined;
      if (!Number.isNaN(id) && extras?.ley != null) {
        leyes[id] = Number(extras.ley);
      }
    });
    return leyes;
  }

  /** Restaura los "Actual" de gastos de tratamiento ya guardados
   *  (extras.actual de cada fila de `calculos`), indexados por id del
   *  catálogo. */
  private resolverActualesGastoInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const actuales: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as { actual?: number } | undefined;
      if (!Number.isNaN(id) && extras?.actual != null) {
        actuales[id] = Number(extras.actual);
      }
    });
    return actuales;
  }

  /** Restaura las "Base" de gastos de tratamiento ya guardadas/sobrescritas
   *  (extras.base de cada fila de `calculos`), indexadas por id del
   *  catálogo. Si la valorización todavía no tiene nada guardado,
   *  gastoBase() cae de todos modos al `extras.base` del catálogo. */
  private resolverBasesGastoInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const bases: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as { actual?: number; base?: number } | undefined;
      // extras.actual solo existe en gastos de tratamiento, no en
      // penalidades (ver resolverLeyesPenalidadInicial): sirve para no
      // confundir ambos tipos de fila de `calculos`.
      if (!Number.isNaN(id) && extras?.actual != null && extras?.base != null) {
        bases[id] = Number(extras.base);
      }
    });
    return bases;
  }

  private recalcularFilaLeyEstandar(fila: AbstractControl): void {
    const idMineral = fila.get('idMineral')?.value;
    const cotizacion = this.cotizacionUSDMineral(idMineral);
    const factorConversion = this.factorConversionMineral(idMineral);
    const ley = Number(fila.get('ley')?.value ?? 0);
    const descuentoCotizacion = Number(
      fila.get('porcentajeCotizacion')?.value ?? 0,
    );
    const tipoCambio = Number(this.form.get('tipoCambio')?.value ?? 0);
    const factorPrecio = this.factorPrecio(fila.get('precio')?.value);

    const cotizacionAplicada = this.redondear(
      cotizacion - descuentoCotizacion,
      4,
    );
    const leyPagable = this.redondear(
      (cotizacionAplicada / factorConversion) * ley * factorPrecio,
      8,
    );
    const precioPorKilo = this.redondear(leyPagable * 1000 * tipoCambio, 2);
    const pKl = Math.floor(precioPorKilo);

    fila.patchValue(
      { cotizacionAplicada, leyPagable, precioPorKilo, pKl },
      { emitEvent: false },
    );
  }

  /** ley ajustada = ley − ajuste de puntos (el entero tecleado siempre se
   *  resta; para sumar puntos el liquidador teclea un valor negativo)
   *  tramo = fila de la tabla de Escala de Precio vigente del mineral cuyo
   *  bracket contiene a la ley ajustada, es decir la de mayor ley tabulada
   *  que no la supere (ver buscarTramoEscalaPrecio)
   *  USD/TM = ley ajustada (recortada al rango de la tabla) × USD/Punto del
   *  tramo encontrado — no el USD/TM tabulado tal cual, porque ese valor
   *  solo es exacto cuando la ley cae justo en un tramo entero; con
   *  decimales hay que recalcular con la ley real.
   *  precio por kilo = (USD/TM recalculado ÷ 1000) × tipo de cambio
   *  P/KL = precio por kilo redondeado hacia abajo (truncado) */
  private recalcularFilaLeyRam(fila: AbstractControl): void {
    const idMineral = fila.get('idMineral')?.value;
    const ley = Number(fila.get('ley')?.value ?? 0);
    const ajustePuntos = Number(fila.get('ajustePuntosLey')?.value ?? 0);
    const tipoCambio = Number(this.form.get('tipoCambio')?.value ?? 0);

    const leyAjustada = this.redondear(ley - ajustePuntos, 3);
    const tramo = this.buscarTramoEscalaPrecio(idMineral, leyAjustada);
    const leyParaPrecio = this.clamparLeyARangoDeTabla(idMineral, leyAjustada);

    const precioPuntoEscala = tramo?.precioPunto ?? 0;
    const precioTmEscala = tramo
      ? this.redondear(leyParaPrecio * precioPuntoEscala, 4)
      : 0;
    const precioPorKilo = this.redondear((precioTmEscala / 1000) * tipoCambio, 2);
    const pKl = Math.floor(precioPorKilo);

    fila.patchValue(
      { leyAjustada, precioPuntoEscala, precioTmEscala, precioPorKilo, pKl },
      { emitEvent: false },
    );
  }

  /** Recorta `leyAjustada` al rango [ley mínima, ley máxima] de los tramos
   *  vigentes del mineral, para no extrapolar el precio más allá de la
   *  tabla (ej. tabla hasta ley 22 y el liquidador puso 50: se reconoce
   *  como si fuera 22, la cotización más alta disponible). Si el mineral no
   *  tiene tabla cargada, devuelve la ley tal cual. */
  private clamparLeyARangoDeTabla(
    idMineral: number | string | null | undefined,
    leyAjustada: number,
  ): number {
    if (idMineral == null) return leyAjustada;
    const filas = this.escalaPrecioPorMineral()[Number(idMineral)]?.filas ?? [];
    if (filas.length === 0) return leyAjustada;
    const leyMinima = filas[0].ley;
    const leyMaxima = filas[filas.length - 1].ley;
    return Math.min(Math.max(leyAjustada, leyMinima), leyMaxima);
  }

  /** Tramo de la tabla de Escala de Precio vigente del mineral que le
   *  corresponde a `leyAjustada`: lookup por "bracket", el tramo tabulado
   *  con la mayor ley que no supere la ley ajustada (ya recortada al rango
   *  de la tabla). Ej. tramos 2 y 3: una ley de 2.2, 2.5 o 2.9 toma el
   *  tramo 2 (no redondea al más cercano); recién con ley 3 pasa al tramo
   *  3. `filas` viene ordenada ascendente por ley (ver
   *  verificarEscalaPrecioMineral), así que alcanza con recorrerla una vez.
   *  Se usa para obtener su USD/Punto (ver recalcularFilaLeyRam, que
   *  recalcula el USD/TM real con la ley exacta) y para resaltar el tramo
   *  activo en la vista previa. null solo si el mineral no tiene ningún
   *  tramo cargado. */
  private buscarTramoEscalaPrecio(
    idMineral: number | string | null | undefined,
    leyAjustada: number,
  ): EscalaPrecio | null {
    if (idMineral == null) return null;
    const filas = this.escalaPrecioPorMineral()[Number(idMineral)]?.filas ?? [];
    if (filas.length === 0) return null;

    const leyClamped = this.clamparLeyARangoDeTabla(idMineral, leyAjustada);

    let tramo = filas[0];
    for (const f of filas) {
      if (f.ley > leyClamped) break;
      tramo = f;
    }
    return tramo;
  }

  /** El liquidador teclea un entero (ej. 45) y se le antepone "0.0000" para
   *  formar el factor real que usa la fórmula de Ley Pagable (0.000045). */
  private factorPrecio(precio: unknown): number {
    const entero = Number(precio ?? 0);
    if (!entero || entero < 0) return 0;
    return Number(`0.0000${Math.trunc(entero)}`);
  }

  /** líquido pagable, estándar = peso neto seco × suma de P/KL de todas las
   *  filas; RAM = peso neto seco × Valor Tonelada (Bs) × 1000 (ver
   *  totalUsdTmRam/valorToneladaBsRam). El saldo a pagar se recalcula
   *  después, dentro de recalcularTotalesAportes() (depende también del
   *  total de aportes). */
  private recalcularTotales(): void {
    const pesoNetoSeco = Number(
      this.form.get('pesoNetoSecoKilogramos')?.value ?? 0,
    );
    const tipoCambio = Number(this.form.get('tipoCambio')?.value ?? 0);

    const sumaUsdTm = this.detallesMineralesArray.controls.reduce(
      (acc, c) => acc + Number(c.get('precioTmEscala')?.value ?? 0),
      0,
    );
    this.totalUsdTmRam.set(this.redondear(sumaUsdTm, 4));

    // Sin redondeo: se muestra tal cual sale el cálculo (a diferencia del
    // resto de totales, que sí se redondean).
    const valorToneladaBs = (sumaUsdTm * tipoCambio) / 1000;
    this.valorToneladaBsRam.set(valorToneladaBs);

    let liquido: number;
    if (this.esCodificacionRam()) {
      liquido = this.redondear(pesoNetoSeco * valorToneladaBs * 1000, 2);
    } else if (this.esCodificacionBcl()) {
      // BCL no usa "Precio por kilo"/"P/KL": Valor Neto TM (Total USD/TM −
      // Gastos de Tratamiento y Penalidades, ver valorNetoTmBcl) × peso
      // neto seco (TMS), tal cual "VALORACIÓN DEL LOTE" del contrato de
      // fundición de referencia.
      const sumaUsdTmBcl = this.detallesMineralesArray.controls.reduce(
        (acc, c) => acc + Number(c.get('totalUsdTm')?.value ?? 0),
        0,
      );
      this.totalUsdTmBcl.set(this.redondear(sumaUsdTmBcl, 4));
      liquido = this.redondear(
        this.valorNetoTmBcl() * (pesoNetoSeco / 1000),
        2,
      );
    } else {
      const sumaPKl = this.detallesMineralesArray.controls.reduce(
        (acc, c) => acc + Number(c.get('pKl')?.value ?? 0),
        0,
      );
      liquido = this.redondear(pesoNetoSeco * sumaPKl, 2);
    }
    this.valorBrutoVenta.set(liquido);

    this.recalcularTodosLosAportes();
  }

  recalcularTodasLasFilasLey(): void {
    this.detallesMineralesArray.controls.forEach((_, i) =>
      this.recalcularFilaLey(i),
    );
  }

  /** Opciones del select "Mineral" para una fila: catálogo completo si es RAM,
   *  o solo los minerales de la codificación si no. En ambos casos se excluyen
   *  los minerales ya elegidos en OTRAS filas (pero no el de la fila actual). */
  opcionesMineral(indiceFila: number): (Mineral | MineralResumen)[] {
    const usados = new Set(
      this.detallesMineralesArray.controls
        .map((c, idx) =>
          idx === indiceFila ? null : c.get('idMineral')?.value,
        )
        .filter((id) => id != null)
        .map((id) => String(id)),
    );

    const base: (Mineral | MineralResumen)[] = this.esCodificacionRam()
      ? this.mineralesCatalogo()
      : (this.valorizacion()?.recepcionMineral?.codificacion?.minerales ?? []);

    return base.filter((m) => !usados.has(String(m.id)));
  }

  /** compareWith del <mat-select> de mineral: el id puede llegar como string
   *  desde el backend en algunos endpoints y como number en otros, así que
   *  se normaliza antes de comparar (si no, el value del FormControl nunca
   *  matchea con ninguna <mat-option> y el select queda vacío). */
  compararIds = (a: unknown, b: unknown): boolean =>
    a != null && b != null && Number(a) === Number(b);

  /** Solo disponible en RAM: agrega una fila en blanco con el mineral editable. */
  agregarMineralLey(): void {
    this.agregarFilaLey(
      { idMineral: null, ley: null, leyUnidad: LEY_UNIDAD_POR_DEFECTO },
      false,
    );
  }

  /** Solo disponible en RAM: quita una fila agregada libremente. */
  quitarMineralLey(i: number): void {
    this.detallesMineralesArray.removeAt(i);
    this.recalcularTotales();
  }

  /** Solo aplica a filas con mineral editable (RAM): al elegir/cambiar el
   *  mineral de una fila hay que verificar SU tabla/cotización vigente y
   *  recalcular con sus propios datos. */
  onMineralFilaChange(i: number): void {
    const idMineral = this.detallesMineralesArray.at(i)?.get('idMineral')
      ?.value;
    if (this.esCodificacionRam()) {
      this.verificarEscalaPrecioMineral(idMineral);
    } else {
      this.verificarCotizacionMineral(idMineral);
    }
    this.recalcularFilaLey(i);
  }

  // ==========================================================
  // COTIZACIÓN VIGENTE (por mineral)
  // ==========================================================

  /** Consulta GET /cotizacion/vigente/:idMineral (compara contra el NOW()
   *  exacto de la base de datos) y guarda el resultado en cotizacionesPorMineral,
   *  indexado por mineral. 404 significa "no tiene cotización vigente ahora". */
  private verificarCotizacionMineral(
    idMineral: number | string | null | undefined,
  ): void {
    if (idMineral == null) return;
    const id = Number(idMineral);
    if (Number.isNaN(id)) return;

    // Ya hay una consulta en curso para este mineral: no duplicar la llamada.
    if (this.cotizacionesPorMineral()[id]?.cargando) return;

    this.actualizarEstadoCotizacion(id, {
      cargando: true,
      sinCotizacion: false,
      cotizacion: this.cotizacionesPorMineral()[id]?.cotizacion ?? null,
    });

    this.parametricasService.obtenerCotizacionVigentePorMineral(id).subscribe({
      next: (cotizacion) => {
        this.actualizarEstadoCotizacion(id, {
          cargando: false,
          sinCotizacion: false,
          cotizacion,
        });
        this.recalcularFilasDelMineral(id);
      },
      error: (err) => {
        const esSinCotizacion = err?.status === 404;
        this.actualizarEstadoCotizacion(id, {
          cargando: false,
          sinCotizacion: esSinCotizacion,
          cotizacion: null,
        });
        if (!esSinCotizacion) {
          this.snackBar.open(
            'No se pudo verificar la cotización vigente del mineral',
            'Cerrar',
            { duration: 4000 },
          );
        }
        this.recalcularFilasDelMineral(id);
      },
    });
  }

  private actualizarEstadoCotizacion(
    id: number,
    estado: CotizacionMineralEstado,
  ): void {
    this.cotizacionesPorMineral.update((actual) => ({
      ...actual,
      [id]: estado,
    }));
  }

  /** Igual que verificarCotizacionMineral pero consulta la tabla de Escala
   *  de Precio vigente (GET .../escala-precio/vigente/:idMineral). 404
   *  significa "este mineral no tiene tabla vigente ahora". Solo se usa en
   *  RAM: ver onMineralFilaChange y agregarFilaLey. */
  private verificarEscalaPrecioMineral(
    idMineral: number | string | null | undefined,
  ): void {
    if (idMineral == null) return;
    const id = Number(idMineral);
    if (Number.isNaN(id)) return;

    if (this.escalaPrecioPorMineral()[id]?.cargando) return;

    this.actualizarEstadoEscalaPrecio(id, {
      cargando: true,
      sinTabla: false,
      filas: this.escalaPrecioPorMineral()[id]?.filas ?? [],
    });

    this.parametricasService.obtenerEscalaPrecioVigente(id).subscribe({
      next: (filas) => {
        this.actualizarEstadoEscalaPrecio(id, {
          cargando: false,
          sinTabla: false,
          filas: [...filas].sort((a, b) => a.ley - b.ley),
        });
        this.recalcularFilasDelMineral(id);
      },
      error: (err) => {
        const esSinTabla = err?.status === 404;
        this.actualizarEstadoEscalaPrecio(id, {
          cargando: false,
          sinTabla: esSinTabla,
          filas: [],
        });
        if (!esSinTabla) {
          this.snackBar.open(
            'No se pudo verificar la tabla de escala de precio del mineral',
            'Cerrar',
            { duration: 4000 },
          );
        }
        this.recalcularFilasDelMineral(id);
      },
    });
  }

  private actualizarEstadoEscalaPrecio(
    id: number,
    estado: EscalaPrecioMineralEstado,
  ): void {
    this.escalaPrecioPorMineral.update((actual) => ({
      ...actual,
      [id]: estado,
    }));
  }

  /** true si el mineral ya elegido en la fila `i` (RAM) no tiene tabla de
   *  Escala de Precio vigente: se usa para ofrecer ahí mismo el botón de
   *  registrarla (ver abrirRegistrarPrecioVigente), sin tener que buscar el
   *  aviso general de arriba. */
  filaSinTablaPrecioVigente(i: number): boolean {
    const idMineral = this.detallesMineralesArray.at(i)?.get('idMineral')?.value;
    if (idMineral == null) return false;
    return this.escalaPrecioPorMineral()[Number(idMineral)]?.sinTabla === true;
  }

  /** Abre el visualizador de solo lectura con la tabla de escala de precio
   *  vigente del mineral de la fila `i`, resaltando el tramo que se está
   *  usando ahora mismo para el cálculo (según la ley ajustada actual). */
  verTablaPrecioVigente(i: number): void {
    const fila = this.detallesMineralesArray.at(i);
    const idMineral = fila?.get('idMineral')?.value;
    if (idMineral == null) return;

    const mineral = this.buscarMineralPorId(idMineral);
    const tieneLey = fila?.get('ley')?.value != null;
    const leyAjustada = Number(fila?.get('leyAjustada')?.value ?? 0);
    const tramo = tieneLey
      ? this.buscarTramoEscalaPrecio(idMineral, leyAjustada)
      : null;

    this.dialog.open(VerTablaPrecioDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        mineral: mineral?.descripcion ?? `Mineral #${idMineral}`,
        leyAjustada: tieneLey ? leyAjustada : null,
        idTramoActivo: tramo?.id ?? null,
        tramos: this.escalaPrecioPorMineral()[Number(idMineral)]?.filas ?? [],
      },
    });
  }

  private recalcularFilasDelMineral(id: number): void {
    this.detallesMineralesArray.controls.forEach((c, i) => {
      if (Number(c.get('idMineral')?.value) === id) this.recalcularFilaLey(i);
    });
  }

  /** Cotización en USD vigente de un mineral (0 si aún no se verificó o no tiene). */
  cotizacionUSDMineral(idMineral: number | string | null | undefined): number {
    if (idMineral == null) return 0;
    return (
      this.cotizacionesPorMineral()[Number(idMineral)]?.cotizacion
        ?.cotizacionMineralDolares ?? 0
    );
  }

  /** Factor de conversión real del mineral, tal como lo devuelve el back en
   *  la cotización vigente (fuente de verdad). Se muestra también en pantalla
   *  para que el usuario lo vea. Si por algún motivo no viene, cae al valor
   *  físico estándar como respaldo. */
  factorConversionMineral(
    idMineral: number | string | null | undefined,
  ): number {
    if (idMineral == null) return GRAMOS_POR_ONZA_TROY;
    const factor =
      this.cotizacionesPorMineral()[Number(idMineral)]?.cotizacion?.mineral
        ?.factorConversion;
    return factor && factor > 0 ? factor : GRAMOS_POR_ONZA_TROY;
  }

  abrirRegistrarCotizacion(idMineral: number): void {
    this.dialog
      .open(CotizacionFormDialogComponent, {
        width: '1000px',
        maxWidth: '95vw',
        autoFocus: false,
        data: { idMineralPreseleccionado: idMineral },
      })
      .afterClosed()
      .subscribe(() => this.verificarCotizacionMineral(idMineral));
  }

  /** Abre el diálogo para registrar el precio vigente que le falta al
   *  mineral: tabla de Escala de Precio en RAM, cotización de mercado en el
   *  resto. Usado desde el aviso "minerales sin precio vigente". */
  abrirRegistrarPrecioVigente(idMineral: number): void {
    if (this.esCodificacionRam()) {
      this.dialog
        .open(EscalaPrecioFormDialogComponent, {
          width: '1100px',
          maxWidth: '95vw',
          autoFocus: false,
          data: { idMineralPreseleccionado: idMineral },
        })
        .afterClosed()
        .subscribe(() => this.verificarEscalaPrecioMineral(idMineral));
    } else {
      this.abrirRegistrarCotizacion(idMineral);
    }
  }

  /** Estados de la recepción con PDF de impresión disponible (mismo criterio
   *  que recepcion-mineral.component.ts): APROBADO, RECHAZADO A TOL, TRANZADO y REMUESTREO. */
  private readonly ESTADOS_RECEPCION_CON_IMPRESION = new Set([2, 3, 5, 6]);

  /** Abre la vista previa (solo lectura) de la recepción de mineral asociada
   *  a esta valorización, con el mismo diálogo que usa la bandeja de recepciones. */
  abrirVistaPreviaRecepcion(): void {
    const registro = this.valorizacion()?.recepcionMineral;
    if (!registro) return;

    this.dialog.open(VerRecepcionDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: {
        registro,
        puedeImprimir: this.ESTADOS_RECEPCION_CON_IMPRESION.has(
          registro.idEstado,
        ),
        autoImprimir: false,
      },
    });
  }

  /** Abre la vista previa de la valorización (formato de ticket, ver
   *  ver-valorizacion-dialog): arma acá todos los datos ya resueltos (leyes
   *  por mineral, descuentos con su descripción de entidad, etc.) a partir
   *  del form y los signals actuales, para que el diálogo sea puramente de
   *  presentación. */
  abrirVisualizador(): void {
    const v = this.valorizacion();
    if (!v) return;

    const leyesYPrecios: LeyPrecioVisualizacion[] =
      this.detallesMineralesArray.controls.map((c) => {
        const idMineral = c.get('idMineral')?.value;
        const mineral = this.buscarMineralPorId(idMineral);
        return {
          simbolo:
            mineral?.simbolo ?? mineral?.descripcion ?? `Mineral #${idMineral}`,
          ley: c.get('ley')?.value ?? null,
          leyUnidad: c.get('leyUnidad')?.value ?? '%',
          precioPorKilo: Number(c.get('precioPorKilo')?.value ?? 0),
        };
      });

    const descuentos: DescuentoVisualizacion[] = this.aportesArray.controls
      .filter(
        (c) =>
          c.get('aplicar')?.value !== false &&
          c.get('idEntidadAporte')?.value != null,
      )
      .map((c) => {
        const idEntidad = c.get('idEntidadAporte')?.value;
        const entidad = this.entidadesAporte().find(
          (e) => Number(e.id) === Number(idEntidad),
        );
        return {
          entidad: entidad?.descripcion ?? `Entidad #${idEntidad}`,
          porcentaje: Number(c.get('porcentajeAporte')?.value ?? 0),
          importe: Number(c.get('importeBolivianos')?.value ?? 0),
        };
      });

    const data: VerValorizacionDialogData = {
      numero: v.id,
      producto: this.productosTexto(v),
      cliente: this.clienteTexto(v),
      numeroDocumento: v.recepcionMineral?.persona?.numeroDocumento ?? '—',
      lote: v.recepcionMineral?.codigoOperacion ?? '—',
      fechaEntrega: this.formatFechaSolo(v.recepcionMineral?.fechaRecepcion),
      fechaTransaccion: this.fechaTransaccionTexto,
      cooperativa:
        v.recepcionMineral?.persona?.actorProductivoMinero?.nombre ?? '—',
      pesoBruto: this.pesoBrutoHumedo(),
      pesoNeto: Number(this.form.get('pesoNetoSecoKilogramos')?.value ?? 0),
      leyesYPrecios,
      totalValorBrutoBolivianos: this.valorBrutoVenta(),
      anticipo: Number(v.anticipo ?? 0),
      otrosAnticipo: Number(this.form.get('otrosAnticipo')?.value ?? 0),
      transporte: Number(this.form.get('ajusteTransporte')?.value ?? 0),
      totalValorLiquidoVentaBolivianos: this.valorLiquidoVentaBs(),
      descuentos,
      descuentoTotal: this.totalImporteAportes(),
      telefonoCliente: v.recepcionMineral?.persona?.celular,
    };

    this.dialog.open(VerValorizacionDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
      data,
    });
  }

  // ==========================================================
  // APORTES / DESCUENTOS DE LEY (dinámico)
  // ==========================================================

  /** Rehidrata los aportes ya guardados del borrador. El back NUNCA guarda
   *  (ni devuelve) un aporte desmarcado: `calculoAportes` solo trae los que
   *  el usuario tenía aplicados (el campo `activo` de cada fila es el flag
   *  genérico de "no borrado" de toda entidad de este backend, no indica si
   *  el checkbox estaba tildado). Por eso la regla es simple: si el id de
   *  la entidad está en `calculoAportes`, va tildada; si no está, va
   *  desmarcada — así se refleja exactamente lo que el back tiene
   *  registrado, sin reinterpretar nada.
   *
   *  Excepción: un borrador recién creado, que TODAVÍA no tuvo ningún
   *  autoguardado (`calculoAportes` viene vacío), sí precarga los 5 por
   *  defecto tildados — es la conveniencia inicial ya existente para no
   *  obligar a tildarlos a mano la primera vez. En cuanto ese borrador
   *  guarda algo (aunque sea un solo aporte), cualquier default que falte
   *  en la respuesta se entiende como desmarcado a propósito por el
   *  usuario y deja de auto-tildarse. */
  private inicializarAportes(v: ValorizacionMineral): void {
    this.aportesArray.clear();

    const guardados = (v.calculoAportes ?? []).filter(
      (a) => a['idEntidadAporte'] != null,
    );

    guardados.forEach((a) => {
      this.agregarAporte({
        id: Number(a['idEntidadAporte']),
        tipoBaseAporte:
          (a['tipoBaseAporte'] as TipoBaseAporteCatalogo) ?? 'VNV',
        porcentajeGuardado:
          a['porcentajeAporte'] != null
            ? Number(a['porcentajeAporte'])
            : undefined,
        aplicar: true,
      });
    });

    const idsGuardados = new Set(
      guardados.map((a) => Number(a['idEntidadAporte'])),
    );
    const borradorNuevoSinGuardar = guardados.length === 0;
    ENTIDADES_APORTE_POR_DEFECTO.filter(
      (preset) => !idsGuardados.has(preset.id),
    ).forEach((preset) =>
      this.agregarAporte({ ...preset, aplicar: borradorNuevoSinGuardar }),
    );
  }

  /** @param preset opcional: entidad+base a precargar (ver
   *  inicializarAportes); `porcentajeGuardado` restaura el % ya editado
   *  previamente (relevante sobre todo para Regalía Minera, cuyo % es
   *  editable a mano); `aplicar` restaura si el checkbox estaba tildado o
   *  no (por defecto true). Sin preset, la fila queda en blanco para que el
   *  usuario elija (botón "Agregar aporte"); la base de aporte ya no es
   *  editable desde la UI, así que siempre queda en VBV (ver
   *  ENTIDADES_APORTE_POR_DEFECTO). */
  agregarAporte(preset?: {
    id: number;
    tipoBaseAporte: TipoBaseAporteCatalogo;
    porcentajeGuardado?: number;
    aplicar?: boolean;
  }): void {
    const fila = this.fb.group({
      idEntidadAporte: [preset?.id ?? (null as number | null), [Validators.required]],
      tipoBaseAporte: [
        preset?.tipoBaseAporte ?? ('VBV' as TipoBaseAporteCatalogo),
        [Validators.required],
      ],
      /** Si está destildado, el aporte no se aplica: no cuenta en los
       *  totales ni se manda al guardar. */
      aplicar: [preset?.aplicar ?? true],
      /** Se precarga con la alícuota calculada (detalleAporte de la entidad,
       *  o suma de alicuotaInterna de los minerales vigentes en Regalía
       *  Minera) pero siempre queda editable: en cuanto el usuario la toca
       *  deja de autoactualizarse (ver recalcularAporte) y esa es la que se
       *  usa en los cálculos y se guarda. */
      porcentajeAporte: [0],
      /** Calculado: siempre es el líquido pagable vigente. */
      baseCalculo: [{ value: this.valorBrutoVenta(), disabled: true }],
      /** Calculado: base de cálculo × (alícuota / 100), 0 si no se aplica. */
      importeBolivianos: [{ value: 0, disabled: true }],
    });
    this.aportesArray.push(fila);

    if (preset?.porcentajeGuardado != null) {
      // Restaura el % ya editado antes: se marca "dirty" para que
      // recalcularAporte no lo pise con la sugerencia automática.
      const control = fila.get('porcentajeAporte')!;
      control.setValue(preset.porcentajeGuardado);
      control.markAsDirty();
    }

    this.recalcularAporte(this.aportesArray.length - 1);
  }

  quitarAporte(index: number): void {
    this.aportesArray.removeAt(index);
    this.recalcularTotalesAportes();
  }

  /** true = todas las filas de aportes tienen el check "Aplicar" tildado;
   *  estado del check maestro del encabezado de la columna. */
  get todosAportesAplicados(): boolean {
    return (
      this.aportesArray.length > 0 &&
      this.aportesArray.controls.every((c) => c.get('aplicar')?.value !== false)
    );
  }

  /** true = solo algunas filas están tildadas (ni todas ni ninguna): estado
   *  "indeterminate" del check maestro. */
  get algunosAportesAplicados(): boolean {
    const aplicadas = this.aportesArray.controls.filter(
      (c) => c.get('aplicar')?.value !== false,
    ).length;
    return aplicadas > 0 && aplicadas < this.aportesArray.length;
  }

  /** Check maestro del encabezado "Aplicar": tilda o destilda todas las
   *  filas de aportes de una sola vez. */
  toggleTodosLosAportes(aplicar: boolean): void {
    this.aportesArray.controls.forEach((c) =>
      c.get('aplicar')?.setValue(aplicar),
    );
    this.recalcularTodosLosAportes();
  }

  /** Opciones de "Base" para una fila de aporte: solo las bases (VBV/VNV) que la
   *  entidad elegida tiene configuradas en su detalleAporte; si aún no eligió
   *  entidad, o esta no restringe (caso Regalía Minera), se muestran ambas. */
  opcionesBaseAporte(indiceFila: number): TipoBaseAporteCatalogo[] {
    const idEntidad = this.aportesArray
      .at(indiceFila)
      ?.get('idEntidadAporte')?.value;
    const entidad = this.entidadesAporte().find((e) => e.id === idEntidad);
    const bases = entidad?.detalleAporte?.map((d) => d.tipoBaseAporte) ?? [];
    const basesUnicas = Array.from(new Set(bases));
    return basesUnicas.length > 0 ? basesUnicas : this.basesAporte;
  }

  /** alícuota sugerida = la del detalleAporte de la entidad (VBV/VNV
   *  elegida), o en Regalía Minera la suma de alicuotaInterna de los
   *  minerales vigentes; se autoactualiza mientras el usuario no la haya
   *  editado a mano (control "pristine"). En cuanto la toca, esa es la que
   *  se usa en los cálculos y la que queda, sin volver a pisarla.
   *  base de cálculo = líquido pagable vigente
   *  importe = aplicar ? base de cálculo × (alícuota / 100) : 0 */
  recalcularAporte(i: number): void {
    const fila = this.aportesArray.at(i);
    if (!fila) return;

    const idEntidad = fila.get('idEntidadAporte')?.value;
    const base = fila.get('tipoBaseAporte')?.value;
    const controlPorcentaje = fila.get('porcentajeAporte')!;

    let alicuota: number;
    if (controlPorcentaje.pristine) {
      alicuota =
        idEntidad === ID_REGALIA_MINERA
          ? this.sumaAlicuotaInternaMinerales()
          : this.buscarAlicuotaAporte(idEntidad, base);
      controlPorcentaje.setValue(alicuota, { emitEvent: false });
    } else {
      alicuota = Number(controlPorcentaje.value ?? 0);
    }

    const aplicar = fila.get('aplicar')?.value !== false;
    const baseCalculo = this.valorBrutoVenta();
    const importe = aplicar
      ? this.redondear(baseCalculo * (alicuota / 100), 2)
      : 0;

    fila.patchValue(
      { baseCalculo, importeBolivianos: importe },
      { emitEvent: false },
    );

    this.recalcularTotalesAportes();
  }

  recalcularTodosLosAportes(): void {
    this.aportesArray.controls.forEach((_, i) => this.recalcularAporte(i));
  }

  /** Suma de alicuotaInterna de la cotización vigente de cada mineral que
   *  interviene en la tabla de ley (0 para los que aún no resolvieron
   *  cotización). Es la base de la sugerencia de Regalía Minera. */
  private sumaAlicuotaInternaMinerales(): number {
    const estados = this.cotizacionesPorMineral();
    return this.idsMineralesEnFilas().reduce(
      (acc, id) => acc + Number(estados[id]?.cotizacion?.alicuotaInterna ?? 0),
      0,
    );
  }

  private buscarAlicuotaAporte(
    idEntidad: number | null | undefined,
    base: TipoBaseAporteCatalogo | null | undefined,
  ): number {
    if (idEntidad == null || !base) return 0;
    const entidad = this.entidadesAporte().find((e) => e.id === idEntidad);
    const detalle = entidad?.detalleAporte?.find(
      (d) => d.tipoBaseAporte === base,
    );
    return detalle?.alicuota ?? 0;
  }

  /** Recalcula los totales de aportes (alícuota e importe) y, con ellos, el
   *  saldo a pagar (líquido pagable − anticipo − otros anticipos − total
   *  aportes ± transporte). Se llama tanto en cascada desde
   *  recalcularTotales() (cambios de peso/ley) como al tocar una fila de
   *  aporte individual (check, %, base) o los campos Transporte/Otros
   *  anticipos, así que es el único lugar que necesita mantener el saldo a
   *  pagar al día. */
  private recalcularTotalesAportes(): void {
    const filasAplicadas = this.aportesArray.controls.filter(
      (c) => c.get('aplicar')?.value !== false,
    );
    const totalAlicuota = filasAplicadas.reduce(
      (acc, c) => acc + Number(c.get('porcentajeAporte')?.value ?? 0),
      0,
    );
    const totalImporte = filasAplicadas.reduce(
      (acc, c) => acc + Number(c.get('importeBolivianos')?.value ?? 0),
      0,
    );
    this.totalAlicuotas.set(this.redondear(totalAlicuota, 2));
    this.totalImporteAportes.set(this.redondear(totalImporte, 0));

    const anticipo = Number(this.valorizacion()?.anticipo ?? 0);
    const otrosAnticipo = Number(this.form.get('otrosAnticipo')?.value ?? 0);
    const ajusteTransporte = Number(
      this.form.get('ajusteTransporte')?.value ?? 0,
    );
    this.valorLiquidoVentaBs.set(
      this.redondear(
        this.valorBrutoVenta() -
          anticipo -
          otrosAnticipo -
          this.totalImporteAportes() +
          ajusteTransporte,
        2,
      ),
    );

    const tipoCambio = Number(this.form.get('tipoCambio')?.value ?? 0);
    this.saldoAPagarUsd.set(
      tipoCambio > 0 ? this.redondear(this.valorLiquidoVentaBs() / tipoCambio, 2) : 0,
    );
  }

  // ==========================================================
  // GUARDAR (autoguardado de borrador + cierre explícito)
  // ==========================================================

  /** Detalles a mandar en el próximo PATCH: solo filas con mineral y ley
   *  cargados. El back mergea por idMineral (upsert), así que mandar solo
   *  lo que hay ahora mismo no borra minerales que falten en esta llamada.
   *  Los campos derivados de la cotización (idCotizacionMineral,
   *  cotizacionAplicada, leyPagable, precioKilo) solo se incluyen si ya se
   *  resolvió la cotización vigente de ese mineral. */
  private construirDetallesActuales(): DetalleValorizacionRequest[] {
    const estadosCotizacion = this.cotizacionesPorMineral();
    const esRam = this.esCodificacionRam();
    const esBcl = this.esCodificacionBcl();
    return this.detallesMineralesArray.controls
      .map((c) => c.getRawValue())
      .filter((d) => d.idMineral != null && d.ley != null)
      .map((d) => {
        const idMineral = Number(d.idMineral);
        const detalle: DetalleValorizacionRequest = {
          idMineral,
          ley: d.ley,
          leyUnidad: d.leyUnidad,
        };

        if (esRam) {
          detalle.ajustePuntosLey = Number(d.ajustePuntosLey ?? 0);
          const tramo = this.buscarTramoEscalaPrecio(idMineral, Number(d.leyAjustada ?? d.ley));
          if (tramo) {
            detalle.idEscalaPrecio = tramo.id;
            detalle.leyAjustada = d.leyAjustada;
            detalle.precioUsdTm = d.precioTmEscala;
          }
        } else if (esBcl) {
          detalle.descuentoLey = Number(d.descuentoLey ?? 0);
          detalle.porcentajeAdicion = Number(d.porcentajeAdicion ?? 100);
          detalle.leyAplicada = Number(d.leyAplicada ?? 0);
          const cotizacion = estadosCotizacion[idMineral]?.cotizacion;
          if (cotizacion) detalle.idCotizacionMineral = Number(cotizacion.id);
          // BCL no descuenta la cotización ni calcula "Precio por kilo"
          // (ver recalcularFilaLeyBcl): se manda el USD/TM tal cual,
          // igual que RAM.
          detalle.precioUsdTm = d.totalUsdTm;
        } else {
          if (d.precio != null) detalle.precio = Number(d.precio);
          const cotizacion = estadosCotizacion[idMineral]?.cotizacion;
          if (cotizacion) {
            detalle.idCotizacionMineral = Number(cotizacion.id);
            detalle.porcentajeCotizacion = d.porcentajeCotizacion;
            detalle.cotizacionAplicada = d.cotizacionAplicada;
            detalle.leyPagable = d.leyPagable;
            detalle.precioKilo = d.precioPorKilo;
          }
        }
        return detalle;
      });
  }

  /** Solo se mandan los aportes con el check "aplicar" activado y que ya
   *  tengan algo calculado (importe > 0). Un aporte desmarcado NUNCA se
   *  manda: el back no tiene forma de guardar "desmarcado" (no soporta
   *  desactivar un calculoAportes ya existente vía este endpoint), así que
   *  la única forma de que no quede registrado es no enviarlo. Ver
   *  inicializarAportes: al recargar, "no está en calculoAportes" es
   *  justamente lo que el form interpreta como desmarcado. */
  private construirAportesActuales(): AporteValorizacionRequest[] {
    return this.aportesArray.controls
      .map((c) => c.getRawValue())
      .filter(
        (a) =>
          a.idEntidadAporte != null &&
          a.tipoBaseAporte != null &&
          a.aplicar !== false &&
          Number(a.importeBolivianos ?? 0) > 0,
      )
      .map((a) => ({
        idEntidadAporte: a.idEntidadAporte,
        tipoBaseAporte: a.tipoBaseAporte,
        porcentajeAporte: a.porcentajeAporte,
        baseCalculo: a.baseCalculo,
        importeBolivianos: a.importeBolivianos,
      }));
  }

  /** Arma el body del PATCH con el estado actual del form. No incluye
   *  idEstadoValorizacion: eso lo agrega quien llama (el autoguardado nunca
   *  lo manda, así que la valorización se queda en BORRADOR hasta que el
   *  usuario presione alguno de los botones de cierre). */
  private construirPayloadActual(): ActualizarValorizacionRequest {
    const v = this.form.getRawValue();

    const payload: ActualizarValorizacionRequest = {
      fechaValorizacion: this.formatFecha(v.fechaValorizacion),
      pesoBrutoHumedoKilogramos: this.pesoBrutoHumedo(),
     // pesoNetoHumedoKilogramos: v.pesoNetoHumedoKilogramos ?? undefined,
      pesoBrutoSecoKilogramos: v.pesoBrutoSecoKilogramos ?? undefined,
      pesoNetoSecoKilogramos: v.pesoNetoSecoKilogramos ?? undefined,
      taraKilogramos: v.taraKilogramos ?? undefined,
      humedadPorcentaje: v.humedadPorcentaje ?? undefined,
      mermaPorcentaje: v.mermaPorcentaje ?? undefined,
      mermaKilogramos: v.mermaKilogramos ?? undefined,
      cotizacionDolar: v.tipoCambio ?? undefined,
      ajusteTransporte: v.ajusteTransporte ?? 0,
      otrosAnticipo: v.otrosAnticipo ?? 0,
      totalValorLiquidoVentaBolivianos: this.valorLiquidoVentaBs(),
      totalValorLiquidoVentaUsd: this.saldoAPagarUsd(),
    };

    if (this.esCodificacionRam()) {
      payload.totalValorToneladaUsd = this.totalUsdTmRam();
      payload.totalValorToneladaBolivianos = this.valorToneladaBsRam();
      payload.totalValorBrutoBolivianos = this.valorBrutoVenta();
      payload.totalAportesBolivianos = this.totalImporteAportes();
    } else {
      // TODO: cuando se implementen los descuentos de ley (fase 2), separar
      // totalValorBrutoBolivianos (antes de descuentos) de
      // totalValorLiquidoVentaBolivianos (después). Por ahora son el mismo valor.
      payload.totalValorBrutoBolivianos = this.valorBrutoVenta();
      payload.totalAportesBolivianos = this.totalImporteAportes();
    }

    if (this.esCodificacionBcl()) {
      payload.calculos = this.construirCalculosBcl();
    }

    if (v.idLaboratorio != null) payload.idLaboratorio = v.idLaboratorio;

    const detalles = this.construirDetallesActuales();
    if (detalles.length > 0) payload.detalles = detalles;

    // "aportes" el back lo trata como lote completo: si viene con
    // contenido, compara contra los aportes activos actuales y, ante
    // cualquier diferencia, desactiva TODOS los anteriores y crea desde
    // cero solo los que vinieron en esta llamada. Pero mandar `aportes: []`
    // NO hace nada (el back solo actúa si el array trae contenido O si
    // viene `limpiarAportes`), así que si el usuario desmarcó todo hay que
    // pedir la limpieza explícitamente con ese flag.
    const aportes = this.construirAportesActuales();
    if (aportes.length > 0) {
      payload.aportes = aportes;
    } else if ((this.valorizacion()?.calculoAportes?.length ?? 0) > 0) {
      payload.limpiarAportes = true;
    }

    return payload;
  }

  /** (Re)programa el autoguardado 1.5s después del último cambio del
   *  usuario, cancelando cualquier temporizador pendiente anterior — así un
   *  cambio nuevo siempre reinicia la espera en vez de acumular llamadas. */
  private programarAutoguardado(): void {
    if (this.autoguardadoTimeout) clearTimeout(this.autoguardadoTimeout);
    this.autoguardadoTimeout = setTimeout(
      () => this.autoguardarBorrador(),
      1500,
    );
  }

  /** Autoguardado silencioso: se dispara solo, con debounce, ante cualquier
   *  cambio del usuario. Nunca cambia idEstadoValorizacion (se queda en
   *  BORRADOR) y no bloquea la UI ni usa el spinner de los botones. */
  private autoguardarBorrador(): void {
    if (!this.esEditable || this.cargandoInicial) return;

    // Ya hay un guardado (auto o explícito) en vuelo: no lanzar otro PATCH
    // en paralelo — evita que dos respuestas lleguen desordenadas y una
    // vieja pise a una más nueva. Se reintenta apenas termine el actual.
    if (this.guardadoEnCurso) {
      this.programarAutoguardado();
      return;
    }

    const payload = this.construirPayloadActual();
    console.log('[autoguardado] PATCH valorizacion_mineral', this.valorizacionId, payload);

    this.guardadoEnCurso = true;
    this.estadoAutoguardado.set('guardando');
    this.valorizacionMineralService
      .actualizarValorizacion(this.valorizacionId, payload)
      .subscribe({
        next: (actualizado) => {
          console.log('[autoguardado] respuesta OK', actualizado);
          this.guardadoEnCurso = false;
          this.valorizacion.set(actualizado);
          this.estadoAutoguardado.set('guardado');
          this.resaltarAutoguardadoTemporalmente();
        },
        error: (err) => {
          console.log('[autoguardado] error', err);
          this.guardadoEnCurso = false;
          this.estadoAutoguardado.set('error');
        },
      });
  }

  /** Pinta de verde el indicador de autoguardado por unos segundos cada vez
   *  que se confirma un guardado exitoso, y luego lo vuelve a su color
   *  normal solo. */
  private resaltarAutoguardadoTemporalmente(): void {
    this.autoguardadoResaltado.set(true);
    if (this.timeoutResaltado) clearTimeout(this.timeoutResaltado);
    this.timeoutResaltado = setTimeout(
      () => this.autoguardadoResaltado.set(false),
      3000,
    );
  }

  /** Se dispara al avanzar/retroceder de paso o al hacer clic directo en el
   *  encabezado de otro paso del stepper: guarda el borrador de inmediato
   *  (sin esperar el debounce del autoguardado) para no perder lo tecleado
   *  en el paso que se abandona. */
  onCambioStep(_event: StepperSelectionEvent): void {
    // Cancela el debounce pendiente: si no, además de este guardado
    // inmediato, el temporizador original igual dispararía otro PATCH
    // redundante ~1.5s después.
    if (this.autoguardadoTimeout) {
      clearTimeout(this.autoguardadoTimeout);
      this.autoguardadoTimeout = undefined;
    }
    this.autoguardarBorrador();
  }

  /** Guarda y pasa a PRE-VALORIZADO (id 2): un paso intermedio, sigue
   *  pudiendo revisarse antes del cierre definitivo. */
  guardarComoPrevalorizado(): void {
    this.confirmarYGuardarConEstado(ESTADO_VALORIZACION_PREVALORIZADO_ID);
  }

  /** Cierra la valorización como VALORIZADO (id 3): a partir de ahí queda
   *  bloqueada para edición. */
  finalizarValorizacion(): void {
    this.confirmarYGuardarConEstado(ESTADO_VALORIZACION_VALORIZADO_ID);
  }

  private confirmarYGuardarConEstado(idEstadoValorizacion: number): void {
    if (!this.puedeValorizar) return;

    if (
      this.form.invalid ||
      this.aportesArray.length === 0 ||
      this.detallesMineralesArray.invalid ||
      this.detallesMineralesArray.length === 0
    ) {
      this.form.markAllAsTouched();
      const mensaje =
        this.detallesMineralesArray.length === 0
          ? 'Agrega al menos un mineral con su ley'
          : this.aportesArray.length === 0
            ? 'Agrega al menos un aporte antes de guardar'
            : 'Revisa los campos marcados en rojo';
      this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
      return;
    }

    // Cancela cualquier autoguardado programado: el guardado explícito de
    // acá abajo ya manda el estado más reciente del form, así que ese
    // temporizador quedaría redundante (y podría disparar un PATCH en
    // paralelo con el de más abajo).
    if (this.autoguardadoTimeout) {
      clearTimeout(this.autoguardadoTimeout);
      this.autoguardadoTimeout = undefined;
    }
    // Si hay un autoguardado en vuelo justo ahora, se espera a que termine
    // en vez de lanzar un segundo PATCH en paralelo sobre el mismo recurso.
    if (this.guardadoEnCurso) {
      this.snackBar.open(
        'Espera un momento, se está guardando el borrador...',
        'Cerrar',
        { duration: 3000 },
      );
      return;
    }

    // El cambio de estado usa el endpoint dedicado (PATCH .../estado), que
    // valida contra lo YA guardado en el back (totalValorLiquidoVentaBolivianos > 0,
    // detalle de mineral registrado). Por eso primero se persiste el estado
    // actual del form con el PATCH normal (sin idEstadoValorizacion, para no
    // pisar el endpoint de estado) y recién después se dispara el cambio de
    // estado propiamente dicho.
    const payload = this.construirPayloadActual();
    console.log('[guardar] PATCH datos', payload);

    this.guardando.set(true);
    this.guardadoEnCurso = true;
    this.valorizacionMineralService
      .actualizarValorizacion(this.valorizacionId, payload)
      .pipe(
        switchMap(() =>
          this.valorizacionMineralService.cambiarEstadoValorizacion(
            this.valorizacionId,
            idEstadoValorizacion,
          ),
        ),
      )
      .subscribe({
        next: (actualizado) => {
          console.log('[guardar] respuesta OK', actualizado);
          this.guardadoEnCurso = false;
          this.guardando.set(false);
          this.valorizacion.set(actualizado);
          this.snackBar.open(
            idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO_ID
              ? 'Valorización finalizada correctamente'
              : 'Valorización guardada como pre-valorizado',
            'Cerrar',
            { duration: 3000 },
          );
          this.router.navigate(['/ui-components/valorizacion']);
        },
        error: (err) => {
          console.log('[guardar] error', err);
          this.guardadoEnCurso = false;
          this.guardando.set(false);
          const mensaje =
            err?.error?.message ??
            'Ocurrió un error al guardar la valorización';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 5000 });
        },
      });
  }

  /** Cambia la balanza usada para el peso bruto húmedo (L/T) y recalcula
   *  en cascada el peso neto seco y los totales. */
  onCambioBalanza(usarT: boolean): void {
    this.usarBalanzaT.set(usarT);
    this.recalcularPesoNetoSeco();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** peso neto seco = peso bruto húmedo − (peso bruto húmedo × humedad%).
   *  RAM/estándar no aplican merma (por eso no hay peso bruto seco acá): la
   *  cadena con merma es propia de BCL (ver recalcularPesoNetoSecoBcl), para
   *  no tocar este cálculo ya probado en el resto de codificaciones. */
  private recalcularPesoNetoSeco(): void {
    if (this.esCodificacionBcl()) {
      this.recalcularPesoNetoSecoBcl();
      return;
    }
    const bruto = this.pesoBrutoHumedo();
    const humedad = Number(this.form.get('humedadPorcentaje')?.value ?? 0);
    const neto = bruto - (bruto * humedad) / 100;
    this.form
      .get('pesoNetoSecoKilogramos')
      ?.setValue(this.redondear(neto), { emitEvent: false });
    this.recalcularTotales();
  }

  /** Solo BCL, tal cual la sección "PESOS" del contrato de fundición:
   *  agua = peso bruto húmedo × humedad%
   *  peso bruto seco (PSB) = peso bruto húmedo − agua
   *  merma (kg) = peso bruto seco × merma%
   *  peso neto seco (PNS) = peso bruto seco − merma */
  private recalcularPesoNetoSecoBcl(): void {
    const bruto = this.pesoBrutoHumedo();
    const humedad = Number(this.form.get('humedadPorcentaje')?.value ?? 0);
    const mermaPorcentaje = Number(
      this.form.get('mermaPorcentaje')?.value ?? 0,
    );

    const pesoBrutoSeco = this.redondear(bruto - (bruto * humedad) / 100);
    const mermaKilogramos = this.redondear(
      (pesoBrutoSeco * mermaPorcentaje) / 100,
    );
    const pesoNetoSeco = this.redondear(pesoBrutoSeco - mermaKilogramos);

    this.form.patchValue(
      {
        pesoBrutoSecoKilogramos: pesoBrutoSeco,
        mermaKilogramos,
        pesoNetoSecoKilogramos: pesoNetoSeco,
      },
      { emitEvent: false },
    );
    this.recalcularTotales();
  }

  private redondear(valor: number, decimales = 3): number {
    const factor = Math.pow(10, decimales);
    return Math.round((valor + Number.EPSILON) * factor) / factor;
  }

  /** Trunca (no redondea) a `decimales` posiciones. Solo se usa para
   *  mostrar Valor Tonelada (Bs): el cálculo se guarda sin redondeo, pero en
   *  pantalla se limita a 4 decimales cortando el resto, sin ajustar el
   *  último dígito hacia arriba. */
  truncarDecimales(valor: number, decimales = 4): number {
    const factor = Math.pow(10, decimales);
    return Math.trunc(valor * factor) / factor;
  }

  private formatFecha(fecha: Date | string): string {
    const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private formatFechaHoraLocal(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${horas}:${minutos} - ${dia}-${mes}-${anio}`;
  }

  /** Igual que en el listado: extrae la fecha directo del ISO string para no
   *  depender del huso horario del navegador. */
  formatFechaSolo(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia] = match;
    return `${dia}-${mes}-${anio}`;
  }

  productosTexto(v: ValorizacionMineral): string {
    const minerales = v.recepcionMineral?.codificacion?.minerales ?? [];
    return minerales.map((m) => m.descripcion).join(', ') || '—';
  }

  clienteTexto(v: ValorizacionMineral): string {
    const p = v.recepcionMineral?.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  volver(): void {
    this.router.navigate(['/ui-components/valorizacion']);
  }
}
