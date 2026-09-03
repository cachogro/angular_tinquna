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
import { finalize, forkJoin, switchMap } from 'rxjs';
import { CotizacionFormDialogComponent } from 'src/app/pages/configurations/parametricas/cotizacion/cotizacion-form-dialog.component';
import { EscalaPrecioFormDialogComponent } from 'src/app/pages/configurations/parametricas/escala-precio/escala-precio-form-dialog.component';
import {
  Cotizacion,
  EscalaPrecio,
  ExtrasGastoTratamiento,
  ExtrasOtros,
  ExtrasPenalidad,
  Laboratorio,
  Mineral,
  TipoCalculoValorizacion,
} from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { formatNumeroConMiles } from 'src/app/shared/utils/numero.util';
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
 *  ley (no de cotización) y, en Plata (ley "g/TM"), un % pagable aplicado
 *  después de recalcular la ley con el factor de conversión. */
const ID_CODIFICACION_BCL = '2';
const CLAVE_CODIFICACION_BCL = 'BCL';

/** BZL (Plata + Zinc) es la misma mecánica de cálculo que BCL (contrato de
 *  fundición de concentrados), solo cambia el metal base (Zinc en vez de
 *  Plomo). No hay un id de codificación conocido/confirmado todavía, así
 *  que se detecta solo por texto (código/nombre), igual que el fallback de
 *  BCL. */
const CLAVE_CODIFICACION_BZL = 'BZL';

/** AC (Plata + Estaño; una recepción AC puede traer solo Estaño). El layout
 *  de las filas de ley es el estándar/ICC, NO el de RAM. La fila cuyo mineral
 *  es Estaño toma el precio de la tabla de Escala de Precio del mineral (igual
 *  que RAM); la fila de Plata sigue con cotización de mercado. La fórmula
 *  "precio por kilo" propia del estaño la define el usuario en un paso
 *  posterior: por ahora solo se agrega la tabla + el control de vigencia. */
const ID_CODIFICACION_AC = '4';
const CLAVE_CODIFICACION_AC = 'AC';

/** Regalía minera no tiene alícuota configurada en su detalleAporte (a
 *  diferencia del resto de entidades de aporte): la suya sale de la suma de
 *  alicuotaInterna (estática, registrada por mineral) de los minerales que
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
  /** Entero que se resta a la ley (negativo para sumar). En RAM sirve para
   *  buscar el tramo en la tabla de Escala de Precio; en BCL es el mismo
   *  concepto, restado antes de aplicar el factor (%) (ver
   *  DetalleValorizacionRequest.ajustePuntosLey). */
  ajustePuntosLey?: number | null;
  /** Solo BCL: Factor (%) que multiplica a la ley aplicada antes de la
   *  cotización. Se teclea como porcentaje (ej. 83 = 83%), no como
   *  fracción. */
  factorPorsentaje?: number | null;
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
  /** Solo BCL/BZL: true una vez que el liquidador llega al step "Gastos de
   *  Tratamiento y Penalidades" (ver onCambioStep) — antes de eso
   *  `construirPayloadActual` no manda `calculos`, para no guardar valores
   *  calculados con el catálogo por defecto (Base/Escalador) sin que el
   *  usuario haya tecleado nada. Se precarga en true si la valorización ya
   *  traía `calculos` guardados al abrir (ver cargarValorizacion), para no
   *  dejar de mandar (y así recalcular) datos ya existentes solo por no
   *  haber revisitado el step en esta sesión de edición. */
  private llegoAlStepGastosBcl = false;
  /** Solo BCL/BZL: true una vez que el liquidador tecleó algo en AL/ROLLBACK
   *  en esta sesión de edición (ver valueChanges de factorAlPorcentaje/
   *  rollback) — construirCalculosBcl solo manda esa fila si está en true.
   *  Se precargan en true si ya había un valor guardado al abrir la
   *  valorización (ver inicializarConValorizacion/resolverOtroCalculoInicial),
   *  para no dejar de mandar (y recalcular) un dato ya existente solo por no
   *  haber vuelto a tocar el campo en esta sesión. */
  private alTocado = false;
  private rollbackTocado = false;
  private fleteTransporteTocado = false;

  /** Versiones SIN redondear de AL/Rollback/Flete Transporte (ver
   *  recalcularTotales) — montoAlBcl/rollbackResultadoBcl/
   *  fleteTransporteResultadoBcl ya vienen redondeados a 2 decimales para
   *  mostrarse en su propia fila, pero sumar/restar varios valores YA
   *  redondeados (en vez de redondear recién el resultado final) es el
   *  mismo bug que tenía valorNetoTmBcl: el error se amplifica. Solo
   *  formatTotalLiquidacion() usa estos tres campos — confirmado por el
   *  usuario 2026-08-26 tras detectar un desfase de 0.01 contra el Excel
   *  de referencia. */
  private montoAlRawBcl = 0;
  private rollbackResultadoRawBcl = 0;
  private fleteTransporteResultadoRawBcl = 0;

  /** Snapshot (JSON) de detalles/calculos/aportes del último PATCH exitoso
   *  — ver construirPayloadActual: cada array solo se manda de nuevo si su
   *  contenido cambió desde acá. El backend no upsertea de forma limpia
   *  estos tres arrays (aportes reemplaza todo y desactiva lo anterior;
   *  detalles/calculos no confirmaron tener merge por id), así que
   *  reenviarlos sin cambios ante CUALQUIER edición del form (ej. tocar
   *  algo del paso 1) iba creando registros duplicados en la base — ver
   *  reporte del usuario 2026-08-21. null = todavía no se mandó nada. */
  private ultimoDetallesEnviados: string | null = null;
  private ultimoCalculosEnviados: string | null = null;
  private ultimoAportesEnviados: string | null = null;
  /** Lo que decidió mandar (o no) el último construirPayloadActual(),
   *  pendiente de confirmarse como "enviado" recién cuando el PATCH
   *  responda OK (ver confirmarSnapshotsEnviados). Si el PATCH falla, no se
   *  confirma: el próximo cambio del usuario vuelve a intentar mandarlo. */
  private pendienteDetalles: string | null = null;
  private pendienteCalculos: string | null = null;
  private pendienteAportes: string | null = null;

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
  readonly cotizacionesPorMineral = signal<
    Record<number, CotizacionMineralEstado>
  >({});

  /** Igual que cotizacionesPorMineral pero para la tabla de Escala de
   *  Precio: solo se usa/verifica cuando la codificación es RAM. */
  readonly escalaPrecioPorMineral = signal<
    Record<number, EscalaPrecioMineralEstado>
  >({});

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
  /** Solo BCL/BZL: suma del "Total (USD/TM)" de todas las filas de ley
   *  (Plata + metal base) — es la misma suma que ya usa recalcularTotales
   *  para el líquido bruto de ley, expuesta acá para mostrarla. */
  readonly totalUsdTmBcl = signal(0);
  /** Solo BCL/BZL: "VALORACIÓN DEL LOTE" del contrato de fundición, ANTES
   *  de aplicar "AL" (ver factorAlPorcentaje) — Valor Neto TM × peso neto
   *  seco (TMS). */
  readonly valoracionLoteBcl = signal(0);
  /** Solo BCL/BZL: resultado de aplicar "AL" a la Valoración del Lote
   *  (Valoración del Lote × AL%), ANTES de restar Rollback. */
  readonly montoAlBcl = signal(0);
  /** Solo BCL/BZL: resultado de "ROLLBACK" (rollback × peso bruto húmedo ÷
   *  1000, tal cual el contrato de fundición de referencia) — se resta del
   *  monto AL para dar "Líquido Pagable" (ver valorBrutoVenta). */
  readonly rollbackResultadoBcl = signal(0);
  /** Solo BCL/BZL: resultado de "FLETE TRANSPORTE" (misma fórmula que
   *  Rollback: tasa × peso bruto húmedo ÷ 1000). Por ahora solo
   *  informativo — el usuario confirmó 2026-08-26 que todavía NO se resta
   *  de ningún total (a diferencia de Rollback); eso queda para un ajuste
   *  posterior. */
  readonly fleteTransporteResultadoBcl = signal(0);
  /** Solo BCL/BZL: ley de la fila de Plata convertida a onzas troy, tal
   *  cual B21 del Excel de referencia: redondear(ley ÷ factorConversion ×
   *  100, 3), con factorConversion = gramos por onza troy. Informativo, NO
   *  alimenta ningún otro cálculo. */
  readonly onzasTroyPlataBcl = signal(0);

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

  /** Solo BCL/BZL: "Escalador" de cada Gasto de Tratamiento, indexado por id
   *  del catálogo. Se precarga con `extras.escalador` pero el liquidador
   *  puede sobreescribirlo por valorización (ver gastoEscalador) — igual
   *  patrón que basesGastoBcl. */
  readonly escaladoresGastoBcl = signal<Record<number, number>>({});

  /** Solo BCL/BZL: "Importe (Bs)" tecleado directo por el liquidador para
   *  gastos "simples" (sin escalador configurado en el catálogo, ej.
   *  Maquila): no tienen Actual/Base/Escalador, es un monto plano — ver
   *  esGastoSimple. */
  readonly importesGastoSimpleBcl = signal<Record<number, number>>({});
  /** Texto tal cual tecleado para el Importe (Bs) de un gasto "simple" (ver
   *  gastoImporteSimpleTexto) — separado del valor numérico para no perder
   *  el "-" a mitad de tecleo cuando el gasto admite negativo (ej. Maquila,
   *  ver onGastoImporteSimpleChange). */
  readonly textosGastoSimpleBcl = signal<Record<number, string>>({});

  /** Solo BCL/BZL: "Ley libre" de cada Penalidad, indexada por id del
   *  catálogo. Se precarga con `extras.leyLibre` pero el liquidador puede
   *  sobreescribirla por valorización (ver penalidadLeyLibre) — mismo
   *  patrón que basesGastoBcl. */
  readonly leyesLibrePenalidadBcl = signal<Record<number, number>>({});
  /** Solo BCL/BZL: "Cargo" de cada Penalidad, indexado por id del catálogo.
   *  Se precarga con `extras.cargo` pero es editable por valorización (ver
   *  penalidadCargo). */
  readonly cargosPenalidadBcl = signal<Record<number, number>>({});
  /** Solo BCL/BZL: "Cada" de cada Penalidad, indexado por id del catálogo.
   *  Se precarga con `extras.cada` pero es editable por valorización (ver
   *  penalidadCada). */
  readonly cadaPenalidadBcl = signal<Record<number, number>>({});
  /** Solo BCL/BZL: "Importe (Bs)" de una Penalidad tecleado directo por el
   *  liquidador, pisando el resultado de la fórmula (ver
   *  calcularPenalidadBcl/onPenalidadImporteChange). La fórmula sigue
   *  siendo el valor por defecto; esto es una excepción puntual por fila. */
  readonly importesManualesPenalidadBcl = signal<Record<number, number>>({});

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

  /** BZL (Plata + Zinc): mismo contrato de fundición que BCL, ver
   *  recalcularFilaLeyBcl. */
  readonly esCodificacionBzl = computed(() => {
    const cod = this.valorizacion()?.recepcionMineral?.codificacion;
    if (!cod) return false;
    const texto = `${cod.codigo ?? ''} ${cod.nombre ?? ''}`.toUpperCase();
    return texto.includes(CLAVE_CODIFICACION_BZL);
  });

  /** BCL y BZL comparten exactamente la misma mecánica de cálculo y de UI
   *  (contrato de fundición de concentrados: Plata + un metal base). Se usa
   *  este helper combinado para todo el ruteo (qué fórmula/sección aplica);
   *  esCodificacionBcl()/esCodificacionBzl() quedan solo para lo puntual que
   *  necesite distinguir cuál de las dos es (hoy, nada además de detectarla). */
  readonly esCodificacionConcentrado = computed(
    () => this.esCodificacionBcl() || this.esCodificacionBzl(),
  );

  /** AC (Plata + Estaño): layout de ley estándar/ICC; la fila de Estaño toma
   *  el precio de la tabla de Escala de Precio, la de Plata de la cotización.
   *  "AC" es demasiado corto para un texto.includes() seguro (colisiones con
   *  otros nombres): se exige id === '4' o el CÓDIGO exacto "AC". */
  readonly esCodificacionAc = computed(() => {
    const cod = this.valorizacion()?.recepcionMineral?.codificacion;
    if (!cod) return false;
    return (
      String(cod.id) === ID_CODIFICACION_AC ||
      (cod.codigo ?? '').trim().toUpperCase() === CLAVE_CODIFICACION_AC
    );
  });

  private valorizacionId!: string;

  /** BORRADOR y PRE-VALORIZADO se pueden seguir editando (campos y
   *  cálculos); solo VALORIZADO queda cerrado de forma definitiva. */
  get esEditable(): boolean {
    return (
      this.valorizacion()?.idEstadoValorizacion !==
      ESTADO_VALORIZACION_VALORIZADO_ID
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
   *  el resto de codificaciones, tabla de Escala de Precio en RAM. En AC se
   *  decide por mineral: el Estaño se controla con la tabla de Escala de
   *  Precio, la Plata con la cotización (ver mineralUsaEscalaPrecio). */
  get verificandoPrecioVigente(): boolean {
    if (this.esCodificacionRam()) return this.verificandoEscalaPrecio;
    if (this.esCodificacionAc()) {
      const escalas = this.escalaPrecioPorMineral();
      const cotis = this.cotizacionesPorMineral();
      return this.idsMineralesEnFilas().some((id) =>
        this.mineralUsaEscalaPrecio(id)
          ? escalas[id]?.cargando
          : cotis[id]?.cargando,
      );
    }
    return this.verificandoCotizacion;
  }

  get mineralesSinPrecioVigente(): Array<{
    id: number;
    descripcion: string;
    simbolo?: string;
  }> {
    if (this.esCodificacionRam()) return this.mineralesSinEscalaPrecio;
    if (this.esCodificacionAc()) {
      const escalas = this.escalaPrecioPorMineral();
      const cotis = this.cotizacionesPorMineral();
      return this.idsMineralesEnFilas()
        .filter((id) =>
          this.mineralUsaEscalaPrecio(id)
            ? escalas[id]?.sinTabla
            : cotis[id]?.sinCotizacion,
        )
        .map((id) => {
          const mineral = this.buscarMineralPorId(id);
          return {
            id,
            descripcion: mineral?.descripcion ?? `Mineral #${id}`,
            simbolo: mineral?.simbolo,
          };
        });
    }
    return this.mineralesSinCotizacion;
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

  /** true si el mineral de la fila es Plomo (por nombre o símbolo del
   *  catálogo): en BCL determina la fórmula de USD/TM (ver
   *  recalcularFilaLeyBcl) — Plomo y Zinc comparten la misma fórmula de
   *  metal base (ver esMineralZinc). */
  esMineralPlomo(idMineral: number | string | null | undefined): boolean {
    if (idMineral == null) return false;
    const mineral = this.buscarMineralPorId(Number(idMineral));
    if (!mineral) return false;
    const descripcion = (mineral.descripcion ?? '').toUpperCase();
    const simbolo = (mineral.simbolo ?? '').toUpperCase();
    return descripcion.includes('PLOMO') || simbolo === 'PB';
  }

  /** true si el mineral de la fila es Zinc (por nombre o símbolo del
   *  catálogo): en BZL determina la fórmula de USD/TM (ver
   *  recalcularFilaLeyBcl) — misma fórmula que Plomo, confirmada por el
   *  usuario 2026-08-25. */
  esMineralZinc(idMineral: number | string | null | undefined): boolean {
    if (idMineral == null) return false;
    const mineral = this.buscarMineralPorId(Number(idMineral));
    if (!mineral) return false;
    const descripcion = (mineral.descripcion ?? '').toUpperCase();
    const simbolo = (mineral.simbolo ?? '').toUpperCase();
    return descripcion.includes('ZINC') || simbolo === 'ZN';
  }

  /** true si el mineral de la fila es Estaño (por nombre o símbolo del
   *  catálogo). En AC, la fila de Estaño toma el precio de la tabla de Escala
   *  de Precio (ver mineralUsaEscalaPrecio); la de Plata sigue con cotización. */
  esMineralEstano(idMineral: number | string | null | undefined): boolean {
    if (idMineral == null) return false;
    const mineral = this.buscarMineralPorId(Number(idMineral));
    if (!mineral) return false;
    const descripcion = (mineral.descripcion ?? '').toUpperCase();
    const simbolo = (mineral.simbolo ?? '').toUpperCase();
    return (
      descripcion.includes('ESTAÑO') ||
      descripcion.includes('ESTANO') ||
      simbolo === 'SN'
    );
  }

  /** true si, en la codificación actual, el precio de ESE mineral sale de la
   *  tabla de Escala de Precio y no de la cotización de mercado: siempre en
   *  RAM; en AC solo el Estaño. Ruteo único para gating / diálogos /
   *  verificación de vigencia. */
  private mineralUsaEscalaPrecio(
    idMineral: number | string | null | undefined,
  ): boolean {
    if (this.esCodificacionRam()) return true;
    if (this.esCodificacionAc()) return this.esMineralEstano(idMineral);
    return false;
  }

  /** Igual que mineralUsaEscalaPrecio pero indexado por fila (para el .html). */
  filaUsaEscalaPrecio(i: number): boolean {
    const idMineral = this.detallesMineralesArray.at(i)?.get('idMineral')?.value;
    return this.mineralUsaEscalaPrecio(idMineral);
  }

  /** true para la fila de Estaño dentro de la codificación AC: su precio por
   *  kilo se interpola de la tabla de Escala de Precio (ver
   *  recalcularFilaLeyAcEstano), no de una cotización de mercado. A diferencia
   *  de RAM, el resto de campos de la fila siguen el layout estándar/ICC. */
  private esFilaAcEstano(idMineral: number | string | null | undefined): boolean {
    return this.esCodificacionAc() && this.esMineralEstano(idMineral);
  }

  /** Etiqueta del botón "Registrar ..." del aviso de precio faltante: tabla de
   *  escala de precio o cotización, según de dónde salga el precio del mineral. */
  etiquetaRegistrarPrecioVigente(idMineral: number): string {
    return this.mineralUsaEscalaPrecio(idMineral)
      ? 'Registrar tabla'
      : 'Registrar cotización';
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
    /** Solo BCL/BZL ("AL" del contrato de fundición): % que se aplica a
     *  "Valoración del Lote" para obtener el Valor Bruto de Venta (pago
     *  provisional, ej. 85 = 85%). 100 = sin descuento. */
    factorAlPorcentaje: [100 as number | null, [Validators.min(0)]],
    /** Solo BCL/BZL ("ROLLBACK" del contrato de fundición): tasa (NO monto
     *  fijo) que se multiplica por peso bruto húmedo ÷ 1000 y se resta del
     *  monto AL para dar "Líquido Pagable" (ver recalcularTotales). */
    rollback: [0 as number | null, [Validators.min(0)]],
    /** Solo BCL/BZL ("FLETE TRANSPORTE", catálogo Otros id 12): misma
     *  fórmula que "rollback" (tasa × peso bruto húmedo ÷ 1000). Por ahora
     *  solo se calcula y se guarda, sin restar de ningún total (ver
     *  fleteTransporteResultadoBcl). */
    fleteTransporte: [0 as number | null, [Validators.min(0)]],
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
    // Solo tienen efecto en BCL/BZL, ambos dentro de recalcularTotales (ver
    // ahí: AL y Rollback alimentan "Líquido Pagable"/valorBrutoVenta).
    // También marcan "tocado" (ver alTocado/rollbackTocado) para que
    // construirCalculosBcl solo mande esa fila si el usuario realmente
    // tecleó algo acá — cargandoInicial=true durante el patchValue inicial,
    // así que ese primer set no cuenta como "tocado".
    this.form.get('factorAlPorcentaje')!.valueChanges.subscribe(() => {
      if (!this.cargandoInicial) this.alTocado = true;
      this.recalcularTotales();
    });
    this.form.get('rollback')!.valueChanges.subscribe(() => {
      if (!this.cargandoInicial) this.rollbackTocado = true;
      this.recalcularTotales();
    });
    this.form.get('fleteTransporte')!.valueChanges.subscribe(() => {
      if (!this.cargandoInicial) this.fleteTransporteTocado = true;
      this.recalcularTotales();
    });

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
    // El catálogo de minerales y el de "tipo de cálculo" (Gastos de
    // Tratamiento/Penalidades/Otros) tienen que estar cargados ANTES de
    // armar las filas de ley y de restaurar AL/ROLLBACK desde `calculos`
    // (ver inicializarDetallesMinerales/opcionesMineral y
    // buscarOtroCalculoBcl): si se disparan en paralelo con
    // cargarValorizacion() pueden ganar la carrera y quedar sin datos al
    // recargar la página (select de mineral en blanco, AL/ROLLBACK en 0).
    forkJoin({
      minerales: this.parametricasService.obtenerMinerales(),
      tipoCalculo:
        this.parametricasService.obtenerTipoCalculoValorizacionAgrupado(),
    })
      .pipe(finalize(() => this.cargarValorizacion()))
      .subscribe({
        next: ({ minerales, tipoCalculo }) => {
          this.mineralesCatalogo.set(minerales);
          this.parametricasService.gastosTratamiento.set(tipoCalculo.gastos);
          this.parametricasService.penalidadesValorizacion.set(
            tipoCalculo.penalidades,
          );
          this.parametricasService.otrosCalculoValorizacion.set(
            tipoCalculo.otros,
          );
        },
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
    // Ver comentario de llegoAlStepGastosBcl: si ya había calculos
    // guardados de una sesión anterior, no hace falta revisitar el step
    // para que sigan mandándose (recalculados) en cada autoguardado.
    this.llegoAlStepGastosBcl = (v.calculos?.length ?? 0) > 0;
    // Antes de cualquier recalcularTotales() (que ya arranca con el
    // patchValue de abajo): si no están cargadas todavía, los totales de
    // gastos/penalidades BCL salen en 0 y se corrigen recién con la
    // primera edición manual.
    this.leyesPenalidad.set(this.resolverLeyesPenalidadInicial(v));
    this.leyesLibrePenalidadBcl.set(this.resolverLeyesLibrePenalidadInicial(v));
    this.cargosPenalidadBcl.set(this.resolverCargosPenalidadInicial(v));
    this.cadaPenalidadBcl.set(this.resolverCadaPenalidadInicial(v));
    this.importesManualesPenalidadBcl.set(
      this.resolverImportesManualesPenalidadInicial(v),
    );
    this.actualesGastoBcl.set(this.resolverActualesGastoInicial(v));
    this.basesGastoBcl.set(this.resolverBasesGastoInicial(v));
    this.escaladoresGastoBcl.set(this.resolverEscaladoresGastoInicial(v));
    this.importesGastoSimpleBcl.set(this.resolverImportesGastoSimpleInicial(v));

    // Se usa solo para el encabezado (nombre a mostrar); la codificación
    // puede traer varios minerales (ej. BZL -> Plata + Zinc), cada uno se
    // valoriza con su propia cotización vigente y factorConversion.
    const mineral = v.recepcionMineral?.codificacion?.minerales?.[0] ?? null;
    this.mineral.set(mineral);

    // Ver comentario de alTocado/rollbackTocado: si ya había algo guardado,
    // arrancan "tocados" para que sigan mandándose sin necesidad de que el
    // usuario vuelva a escribir en el campo en esta sesión.
    const alGuardado = this.resolverOtroCalculoInicial(v, 'AL');
    const rollbackGuardado = this.resolverOtroCalculoInicial(v, 'ROLLBACK');
    const fleteTransporteGuardado = this.resolverOtroCalculoInicial(
      v,
      'FLETE TRANSPORTE',
    );
    this.alTocado = alGuardado != null;
    this.rollbackTocado = rollbackGuardado != null;
    this.fleteTransporteTocado = fleteTransporteGuardado != null;

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
      otrosAnticipo: v.otrosAnticipo != null ? Number(v.otrosAnticipo) : 0,
      // "AL" por defecto en 85% para BCL/BZL nuevos (ver Excel de
      // referencia); si ya hay algo guardado, se respeta. No aplica en
      // RAM/estándar (el campo no se usa en su cálculo). Ya no se guardan
      // como columnas propias de la valorización (ver
      // ID_TIPO_CALCULO_OTROS/construirCalculosBcl): se restauran desde su
      // fila en `calculos` (baseCalculo). alTocado/rollbackTocado arrancan
      // en true acá si ya había algo guardado (ver su comentario arriba).
      factorAlPorcentaje: alGuardado ?? (this.esCodificacionConcentrado() ? 85 : 100),
      rollback: rollbackGuardado ?? 0,
      fleteTransporte: fleteTransporteGuardado ?? 0,
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

    // Sembrar los snapshots con el estado recién cargado: si no, el primer
    // autoguardado de la sesión los vería como "cambiados" (snapshot en
    // null) y reenviaría al back algo que ya está guardado tal cual,
    // duplicándolo (ver comentario de ultimoDetallesEnviados).
    this.ultimoDetallesEnviados = JSON.stringify(
      this.construirDetallesActuales(),
    );
    this.ultimoCalculosEnviados =
      this.esCodificacionConcentrado() && this.llegoAlStepGastosBcl
        ? JSON.stringify(this.construirCalculosBcl())
        : null;
    this.ultimoAportesEnviados = JSON.stringify(
      this.construirAportesActuales(),
    );

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

    const esRam = this.esCodificacionRam();
    // BCL/BZL: el metal base (Pb/Zn) siempre va primero, Plata después, sin
    // importar el orden en que vengan guardados o en el catálogo de la
    // codificación.
    const esConcentrado = this.esCodificacionConcentrado();
    const ordenBaseAntesQuePlata = (idMineral: unknown): number =>
      this.esMineralPlata(Number(idMineral)) ? 1 : 0;

    const detallesGuardados = esConcentrado
      ? [...(v.detalles ?? [])].sort(
          (a, b) =>
            ordenBaseAntesQuePlata(a['idMineral']) -
            ordenBaseAntesQuePlata(b['idMineral']),
        )
      : (v.detalles ?? []);

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
          factorPorsentaje:
            d['factorPorsentaje'] != null
              ? Number(d['factorPorsentaje'])
              : null,
        },
        !esRam,
      );
    });

    if (!esRam) {
      const idsGuardados = new Set(
        detallesGuardados.map((d) => String(d['idMineral'])),
      );
      let mineralesCodificacion =
        v.recepcionMineral?.codificacion?.minerales ?? [];
      if (esConcentrado) {
        mineralesCodificacion = [...mineralesCodificacion].sort(
          (a, b) => ordenBaseAntesQuePlata(a.id) - ordenBaseAntesQuePlata(b.id),
        );
      }

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
    const esBcl = this.esCodificacionConcentrado();
    /** Fila de Estaño dentro de AC: se precia por la tabla de Escala de
     *  Precio, así que no lleva "precio" ni se verifica su cotización de
     *  mercado. La fila de Plata en AC sigue siendo ICC. */
    const esAcEstano = this.esFilaAcEstano(valor.idMineral);
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
       *  (ver recalcularFilaLeyBcl). En AC (Estaño) va bloqueado: el precio
       *  sale de la tabla de Escala de Precio, no de la cotización. */
      porcentajeCotizacion: [
        { value: valor.porcentajeCotizacion ?? 0, disabled: esAcEstano },
        [Validators.required, Validators.min(0)],
      ],
      /** Calculado: cotización vigente − descuento cotización. No aplica en RAM. */
      cotizacionAplicada: [{ value: 0, disabled: true }],
      /** Entero tecleado por el liquidador; se antepone "0.0000" para formar
       *  el factor que usa Ley Pagable (ej. 45 → 0.000045). Se persiste en el
       *  detalle guardado para poder retomar el borrador sin perderlo.
       *  No se usa en RAM ni en BCL (por eso no es requerido en esos casos). */
      precio: [
        { value: valor.precio ?? (null as number | null), disabled: esAcEstano },
        esRam || esBcl || esAcEstano
          ? []
          : [Validators.required, Validators.min(1)],
      ],
      /** Calculado: cotización vigente / factorConversion del mineral × ley × factor de "precio". No aplica en RAM ni en BCL. */
      leyPagable: [{ value: 0, disabled: true }],
      /** Solo BCL: Factor (%) que multiplica a la ley aplicada; se teclea
       *  como porcentaje (ej. 83), 100 = se reconoce el 100%. */
      factorPorsentaje: [valor.factorPorsentaje ?? 100],
      /** Solo BCL: USD/TM antes de convertir a precio por kilo (ver
       *  recalcularFilaLeyBcl). */
      precioUsdTm: [{ value: 0, disabled: true }],
      /** Entero que el liquidador resta a la ley (negativo para sumar). En
       *  RAM busca el tramo en la tabla de Escala de Precio; en BCL se
       *  resta antes de aplicar el Factor (%) (ver recalcularFilaLeyBcl). */
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
    if (esRam || esAcEstano) {
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
    } else if (this.esCodificacionConcentrado()) {
      this.recalcularFilaLeyBcl(fila);
    } else if (this.esFilaAcEstano(fila.get('idMineral')?.value)) {
      this.recalcularFilaLeyAcEstano(fila);
    } else {
      this.recalcularFilaLeyEstandar(fila);
    }

    this.recalcularTotales();
  }

  /** Fórmula propia de BCL/BZL (Plata + Plomo o Plata + Zinc), tal cual el
   *  contrato de fundición de referencia — distinta de la estándar.
   *  cotización vigente = la de mercado tal cual (sin descuento)
   *  factor pagable = Factor (%) ÷ 100 (se teclea como porcentaje, ej. 83 = 83%)
   *
   *  USD/TM — sección "PAGOS POR TM" del contrato de fundición:
   *   - Plata en BCL: ((ley ÷ factorConversion × 1000) − ajustePuntosLey) ×
   *     factor pagable × cotización vigente.
   *   - Plata en BZL: mismo cálculo pero ×100 en vez de ×1000 — corregido
   *     por el usuario 2026-08-25 (antes era al revés: BCL ×100/BZL ×1000).
   *   - Plomo (BCL) y Zinc (BZL): a = MIN(ley − ajustePuntosLey, ley ×
   *     factor pagable) ÷ 100; b = cotización vigente × factorConversion ×
   *     1000; USD/TM = a × b — fórmula del Excel de referencia, confirmada
   *     por el usuario 2026-08-24 (Plomo) y 2026-08-25 (Zinc, misma
   *     fórmula; reemplaza la anterior sin factorConversion/1000). El MIN
   *     topea el pagable entre "ley con ajuste" y "ley × factor pagable".
   *   - Cualquier otro metal base sin fórmula propia confirmada todavía: R
   *     = MIN(ley − ajustePuntosLey, ley × factor pagable) ÷ 100; Total = R
   *     × cotización vigente — fórmula original 2026-08-20, ahora solo de
   *     respaldo. ("Cotización ajustada" y "ley aplicada" existieron como
   *     campos intermedios pero se quitaron 2026-08-20/21: no se usaban en
   *     ningún cálculo final ni se guardan en la base de datos.)
   *
   *  BCL/BZL no calculan "Precio por kilo" ni "P/KL" (no aplican en estas
   *  codificaciones): "Valoración del Lote" sale directo de Valor Neto TM ×
   *  peso neto seco (TMS), y de ahí "AL" (% de pago provisional) da el
   *  Valor Bruto de Venta — ver recalcularTotales. */
  private recalcularFilaLeyBcl(fila: AbstractControl): void {
    const idMineral = fila.get('idMineral')?.value;
    const ley = Number(fila.get('ley')?.value ?? 0);
    const ajustePuntosLey = Number(fila.get('ajustePuntosLey')?.value ?? 0);
    // Se teclea como porcentaje (ej. 83 = 83%), no como fracción — por eso
    // se divide entre 100 antes de multiplicar.
    const factorPagable =
      Number(fila.get('factorPorsentaje')?.value ?? 100) / 100;

    const factorConversion = this.factorConversionMineral(idMineral);

    // Se muestra tal cual, con todos sus decimales (sin redondear).
    const cotizacionAplicada = this.cotizacionUSDMineral(idMineral);

    const esPlata = this.esMineralPlata(idMineral);
    const esPlomo = this.esMineralPlomo(idMineral);
    const esZinc = this.esMineralZinc(idMineral);

    // Solo Plata, exclusivo del USD/TM: ley ÷ factorConversion × 1000 (BCL)
    // o ×100 (BZL) − ajustePuntosLey (ver comentario de la fórmula, arriba).
    const factorPlata = this.esCodificacionBzl() ? 100 : 1000;
    const leyPagableAgExacta =
      (ley / factorConversion) * factorPlata - ajustePuntosLey;

    let precioTm: number;
    if (esPlata) {
      precioTm = this.redondear(
        leyPagableAgExacta * factorPagable * cotizacionAplicada,
        4,
      );
    } else if (esPlomo || esZinc) {
      const a = Math.min(ley - ajustePuntosLey, ley * factorPagable) / 100;
      const b = cotizacionAplicada * factorConversion * 1000;
      precioTm = this.redondear(a * b, 4);
    } else {
      precioTm = this.redondear(
        (Math.min(ley - ajustePuntosLey, ley * factorPagable) / 100) *
          cotizacionAplicada,
        4,
      );
    }

    fila.patchValue(
      {
        cotizacionAplicada,
        precioUsdTm: precioTm,
      },
      { emitEvent: false },
    );
  }

  // ==========================================================
  // GASTOS DE TRATAMIENTO Y PENALIDADES (solo BCL)
  // ==========================================================

  /** Gastos de tratamiento activos del catálogo (Maquila, Ajuste de
   *  maquila, Gastos de refinación Ag...). Los que tienen escalador
   *  configurado muestran Actual/Base/Escalador editables (ver
   *  esGastoSimple); Maquila (sin escalador en el catálogo) es un Importe
   *  (Bs) directo. */
  get gastosActivosBcl(): TipoCalculoValorizacion<ExtrasGastoTratamiento>[] {
    return this.parametricasService
      .gastosTratamiento()
      .filter((g) => g.activo)
      .sort((a, b) => a.id - b.id);
  }

  /** true = el catálogo no le configuró escalador a este gasto (ej.
   *  Maquila, extras: {}): no se calcula con Actual/Base/Escalador, es un
   *  Importe (Bs) que el liquidador teclea directo (ver gastoImporteSimple). */
  esGastoSimple(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): boolean {
    return gasto.extras?.escalador == null;
  }

  /** Penalidades activas del catálogo (As, Sb, Bi, Sn, Fe, SiO2). La única
   *  entrada del liquidador es la ley de cada una (ver leyPenalidad). */
  get penalidadesActivasBcl(): TipoCalculoValorizacion<ExtrasPenalidad>[] {
    return this.parametricasService
      .penalidadesValorizacion()
      .filter((p) => p.activo)
      .sort((a, b) => a.id - b.id);
  }

  /** Catálogo "Otros" (idTipoCalculo=3): AL, ROLLBACK y FLETE TRANSPORTE
   *  (id 12, misma fórmula que ROLLBACK). Se identifican por descripción
   *  exacta (mayúsculas), tal como se cargaron en la base de datos. */
  private buscarOtroCalculoBcl(
    descripcion: 'AL' | 'ROLLBACK' | 'FLETE TRANSPORTE',
  ): TipoCalculoValorizacion<ExtrasOtros> | undefined {
    return this.parametricasService
      .otrosCalculoValorizacion()
      .find((o) => o.activo && o.descripcion?.toUpperCase() === descripcion);
  }

  /** Restaura el input de AL/ROLLBACK/FLETE TRANSPORTE ya guardado
   *  (baseCalculo de su fila en `calculos`, ver construirCalculosBcl) — ya
   *  no viven como columna propia de la valorización. null si todavía no
   *  hay nada guardado (fila nueva) o el catálogo no está cargado. */
  private resolverOtroCalculoInicial(
    v: ValorizacionMineral,
    descripcion: 'AL' | 'ROLLBACK' | 'FLETE TRANSPORTE',
  ): number | null {
    const catalogo = this.buscarOtroCalculoBcl(descripcion);
    if (!catalogo) return null;
    const fila = (v.calculos ?? []).find(
      (c) => Number(c['idTipoCalculoValorizacion']) === catalogo.id,
    );
    return fila?.['baseCalculo'] != null ? Number(fila['baseCalculo']) : null;
  }

  /** Unidad de "Ley libre"/"Cargo" para mostrar una sola vez en el
   *  encabezado de la tabla (ej. "Ley libre (%)") en vez de repetirla en
   *  cada fila — se toma de la primera penalidad activa, asumiendo que
   *  todas comparten unidad (igual que en el catálogo de referencia). */
  get unidadLeyPenalidadesBcl(): string {
    return this.penalidadesActivasBcl[0]?.extras?.unidadLey ?? '';
  }

  get unidadCargoPenalidadesBcl(): string {
    return this.penalidadesActivasBcl[0]?.extras?.unidadCargo ?? '';
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
   *  valorización (ver onGastoBaseChange). Escalador tiene el mismo patrón
   *  (ver gastoEscalador). */
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

  /** Escalador de un Gasto de Tratamiento: se precarga con el del catálogo
   *  (`extras.escalador`) pero el liquidador puede sobreescribirlo por
   *  valorización (ver onGastoEscaladorChange) — mismo patrón que gastoBase. */
  gastoEscalador(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): number {
    const sobrescrito = this.escaladoresGastoBcl()[gasto.id];
    return sobrescrito ?? Number(gasto.extras?.escalador ?? 0);
  }

  onGastoEscaladorChange(id: number, valor: string): void {
    const escalador = Number(valor) || 0;
    this.escaladoresGastoBcl.update((actuales) => ({
      ...actuales,
      [id]: escalador,
    }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** Importe (Bs) de un gasto "simple" (ver esGastoSimple), tecleado
   *  directo por el liquidador. */
  gastoImporteSimple(id: number): number {
    return this.importesGastoSimpleBcl()[id] ?? 0;
  }

  /** Texto tal cual lo tipeó el liquidador para el Importe (Bs) de un gasto
   *  "simple" (ej. Maquila, que admite negativo — ver
   *  onGastoImporteSimpleChange). El input NO se bindea al número
   *  (gastoImporteSimple) sino a este texto: bindear directo al número
   *  reescribe el <input> en cada tecla (Angular re-evalúa [value] en cada
   *  change detection) y eso borra el "-" antes de que el liquidador
   *  termine de escribir, porque "-" solo parsea a 0. */
  gastoImporteSimpleTexto(id: number): string {
    const texto = this.textosGastoSimpleBcl()[id];
    return texto ?? String(this.gastoImporteSimple(id));
  }

  onGastoImporteSimpleChange(id: number, valor: string): void {
    this.textosGastoSimpleBcl.update((actuales) => ({
      ...actuales,
      [id]: valor,
    }));
    const importe = Number(valor);
    // Mientras el texto no sea un número completo (ej. "-", "-1.", vacío) no
    // se toca el importe numérico: se sigue calculando con el último válido,
    // sin forzar un 0 a mitad de tecleo que además reescribiría el input.
    if (!Number.isNaN(importe)) {
      this.importesGastoSimpleBcl.update((actuales) => ({
        ...actuales,
        [id]: importe,
      }));
      this.recalcularTotales();
    }
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** Peso neto seco en toneladas métricas secas (TMS): base de cálculo de
   *  Penalidades. */
  private pesoNetoSecoTms(): number {
    return Number(this.form.get('pesoNetoSecoKilogramos')?.value ?? 0) / 1000;
  }

  /** Gasto de tratamiento, tal cual la sección "GASTOS DE TRATAMIENTO" del
   *  contrato de fundición de referencia:
   *  - Simple (sin escalador en el catálogo, ej. Maquila): Importe (Bs)
   *    tecleado directo, sin Actual/Base/Escalador.
   *  - Con escalador (ej. Ajuste de maquila, Gastos de refinación Ag):
   *    diferencia = Actual − Base (ambos tecleados por el liquidador,
   *    precargados con el catálogo); Importe (Bs) = Escalador (precargado
   *    con el catálogo, también editable) × diferencia — directo, sin tipo
   *    de cambio ni ninguna cantidad (TMS/oz) de por medio. */
  calcularGastoBcl(gasto: TipoCalculoValorizacion<ExtrasGastoTratamiento>): {
    actual: number;
    base: number;
    diferencia: number;
    escalador: number;
    importeBs: number;
  } {
    if (this.esGastoSimple(gasto)) {
      const importeBs = this.redondear(this.gastoImporteSimple(gasto.id), 2);
      return { actual: 0, base: 0, diferencia: 0, escalador: 0, importeBs };
    }
    const actual = this.gastoActual(gasto.id);
    const base = this.gastoBase(gasto);
    const escalador = this.gastoEscalador(gasto);
    const diferencia = this.redondear(actual - base, 4);
    const importeBs = this.redondear(escalador * diferencia, 2);
    return { actual, base, diferencia, escalador, importeBs };
  }

  /** "Ley libre" de una Penalidad: se precarga con la del catálogo
   *  (`extras.leyLibre`) pero el liquidador puede sobreescribirla por
   *  valorización (ver onPenalidadLeyLibreChange). */
  penalidadLeyLibre(p: TipoCalculoValorizacion<ExtrasPenalidad>): number {
    const sobrescrita = this.leyesLibrePenalidadBcl()[p.id];
    return sobrescrita ?? Number(p.extras?.leyLibre ?? 0);
  }

  onPenalidadLeyLibreChange(id: number, valor: string): void {
    const leyLibre = Number(valor) || 0;
    this.leyesLibrePenalidadBcl.update((actuales) => ({
      ...actuales,
      [id]: leyLibre,
    }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** "Cargo" de una Penalidad: se precarga con el del catálogo
   *  (`extras.cargo`) pero el liquidador puede sobreescribirlo por
   *  valorización (ver onPenalidadCargoChange). */
  penalidadCargo(p: TipoCalculoValorizacion<ExtrasPenalidad>): number {
    const sobrescrito = this.cargosPenalidadBcl()[p.id];
    return sobrescrito ?? Number(p.extras?.cargo ?? 0);
  }

  onPenalidadCargoChange(id: number, valor: string): void {
    const cargo = Number(valor) || 0;
    this.cargosPenalidadBcl.update((actuales) => ({ ...actuales, [id]: cargo }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** "Cada" de una Penalidad: se precarga con la del catálogo
   *  (`extras.cada`) pero el liquidador puede sobreescribirla por
   *  valorización (ver onPenalidadCadaChange). */
  penalidadCada(p: TipoCalculoValorizacion<ExtrasPenalidad>): number {
    const sobrescrita = this.cadaPenalidadBcl()[p.id];
    return sobrescrita ?? Number(p.extras?.cada ?? 0);
  }

  onPenalidadCadaChange(id: number, valor: string): void {
    const cada = Number(valor) || 0;
    this.cadaPenalidadBcl.update((actuales) => ({ ...actuales, [id]: cada }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** "Importe (Bs)" de una Penalidad tecleado directo por el liquidador:
   *  pisa el resultado de la fórmula (ver calcularPenalidadBcl). `undefined`
   *  si nunca se tocó — en ese caso se usa la fórmula. */
  penalidadImporteManual(id: number): number | undefined {
    return this.importesManualesPenalidadBcl()[id];
  }

  onPenalidadImporteChange(id: number, valor: string): void {
    const importe = Number(valor) || 0;
    this.importesManualesPenalidadBcl.update((actuales) => ({
      ...actuales,
      [id]: importe,
    }));
    this.recalcularTotales();
    if (!this.cargandoInicial) this.programarAutoguardado();
  }

  /** Penalidad, tal cual la sección "PENALIDADES" del contrato de fundición
   *  de referencia:
   *  Importe (Bs) = SI(ley > leyLibre, ((ley − leyLibre) × cargo) ÷ cada, 0)
   *  — directo, sin multiplicar por peso neto seco ni tipo de cambio (igual
   *  que Gastos de Tratamiento, ver calcularGastoBcl). "cada" se guarda tal
   *  cual se ve en el catálogo (ej. 0.10 para "0.10%"), no como fracción
   *  (0.001). Redondeado a 2 decimales (ley general de redondeo: ≥5 sube).
   *  Ley libre, cargo y cada se precargan del catálogo pero son editables
   *  por valorización (ver penalidadLeyLibre/penalidadCargo/penalidadCada).
   *  El propio Importe (Bs) también es editable — si el liquidador lo
   *  tecleó directo (ver penalidadImporteManual), ese valor pisa el de la
   *  fórmula. */
  calcularPenalidadBcl(penalidad: TipoCalculoValorizacion<ExtrasPenalidad>): {
    ley: number;
    importeBs: number;
  } {
    const ley = this.leyPenalidad(penalidad.id);
    const importeManual = this.penalidadImporteManual(penalidad.id);
    if (importeManual != null) {
      return { ley, importeBs: importeManual };
    }
    const leyLibre = this.penalidadLeyLibre(penalidad);
    const cada = this.penalidadCada(penalidad) || 1;
    const cargo = this.penalidadCargo(penalidad);
    const importeBs =
      ley > leyLibre ? this.redondear(((ley - leyLibre) * cargo) / cada, 2) : 0;
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
   *  SIN redondear: se usa para calcular "Valoración del Lote" (× peso neto
   *  seco en TMS, ver recalcularTotales) y redondear acá antes de esa
   *  multiplicación amplificaba el error hasta ±0.5 Bs — confirmado por el
   *  usuario 2026-08-25 comparando contra el Excel de referencia. Para
   *  pantalla se redondea recién en el template (ver
   *  valorNetoTmBclMostrado). */
  valorNetoTmBcl(): number {
    return this.totalUsdTmBcl() - this.totalGastosYPenalidadesBcl();
  }

  /** "Valor Neto TM" redondeado a 2 decimales, solo para mostrar en
   *  pantalla — el cálculo de "Valoración del Lote" usa el valor sin
   *  redondear de valorNetoTmBcl() directamente. */
  valorNetoTmBclMostrado(): number {
    return this.redondear(this.valorNetoTmBcl(), 2);
  }

  /** Arma las filas de `calculos` para el PATCH: snapshot de lo que se usó
   *  en el cálculo (no solo el resultado), para que la valorización
   *  guardada no cambie si el catálogo se edita después. */
  /** true = el liquidador tecleó algo para este gasto (Actual, o Importe
   *  (Bs) si es "simple") — si nunca lo tocó, `gastoActual`/
   *  `gastoImporteSimple` caen a 0 y el catálogo igual precarga Base con un
   *  valor propio, dando una "diferencia"/importe distinto de cero sin que
   *  el usuario haya ingresado nada. Se usa para no mandar esa fila. */
  private gastoTieneDatoIngresado(
    g: TipoCalculoValorizacion<ExtrasGastoTratamiento>,
  ): boolean {
    return this.esGastoSimple(g)
      ? g.id in this.importesGastoSimpleBcl()
      : g.id in this.actualesGastoBcl();
  }

  private construirCalculosBcl(): CalculoValorizacionRequest[] {
    const gastos: CalculoValorizacionRequest[] = this.gastosActivosBcl
      .filter((g) => this.gastoTieneDatoIngresado(g))
      .map((g) => {
        const { actual, base, diferencia, escalador, importeBs } =
          this.calcularGastoBcl(g);
        const esSimple = this.esGastoSimple(g);
        return {
          idTipoCalculoValorizacion: g.id,
          // "Base sobre la que se aplicó la tasa" (escalador) es la
          // diferencia Actual−Base; los gastos de tratamiento ya no usan
          // TMS/oz (ver calcularGastoBcl).
          baseCalculo: diferencia,
          importeBolivianos: importeBs,
          valorAplicado: actual,
          extras: {
            actual,
            base,
            diferencia,
            escalador,
            // Solo gastos "simples" (ej. Maquila): el Importe (Bs) tecleado
            // directo, para poder restaurarlo (ver
            // resolverImportesGastoSimpleInicial).
            importeManual: esSimple ? importeBs : undefined,
          },
        };
      });
    // Solo penalidades con ley realmente tecleada (leyesPenalidad) O con un
    // Importe (Bs) manual tecleado directo (importesManualesPenalidadBcl):
    // sin ninguna de las dos no hay nada que el liquidador haya tocado, y
    // mandarla igual ensuciaría `calculos` con filas en 0 que nunca llegó a
    // ver/completar. Antes solo miraba `leyesPenalidad`, así que un Importe
    // (Bs) manual sin tocar la Ley se perdía al guardar — bug reportado por
    // el usuario 2026-08-25.
    const penalidades: CalculoValorizacionRequest[] = this.penalidadesActivasBcl
      .filter(
        (p) =>
          p.id in this.leyesPenalidad() ||
          p.id in this.importesManualesPenalidadBcl(),
      )
      .map((p) => {
        const { ley, importeBs } = this.calcularPenalidadBcl(p);
        return {
          idTipoCalculoValorizacion: p.id,
          baseCalculo: this.redondear(this.pesoNetoSecoTms(), 4),
          importeBolivianos: importeBs,
          extras: {
            ley,
            leyLibre: this.penalidadLeyLibre(p),
            cargo: this.penalidadCargo(p),
            cada: this.penalidadCada(p),
            // Solo si el liquidador tecleó el Importe (Bs) directo, pisando
            // la fórmula (ver penalidadImporteManual/resolverImportesManualesPenalidadInicial).
            importeManual: this.penalidadImporteManual(p.id),
          },
        };
      });

    // "Otros" (idTipoCalculo=3): AL y ROLLBACK ya NO tienen columna propia
    // en la valorización (alPorcentaje/rollback se dieron de baja
    // 2026-08-21) — viven acá, igual que gastos/penalidades: input tecleado
    // en baseCalculo, resultado (montoAlBcl/rollbackResultadoBcl) en
    // importeBolivianos. Se restauran al cargar vía resolverOtroCalculoInicial.
    // Solo se mandan si el usuario los tocó (ver alTocado/rollbackTocado):
    // ambos arrancan con un valor por defecto (85%/0) que no implica que el
    // liquidador haya trabajado esa fila.
    const otros: CalculoValorizacionRequest[] = [];
    const alCatalogo = this.buscarOtroCalculoBcl('AL');
    if (alCatalogo && this.alTocado) {
      otros.push({
        idTipoCalculoValorizacion: alCatalogo.id,
        baseCalculo: Number(this.form.get('factorAlPorcentaje')?.value ?? 100),
        importeBolivianos: this.montoAlBcl(),
      });
    }
    const rollbackCatalogo = this.buscarOtroCalculoBcl('ROLLBACK');
    if (rollbackCatalogo && this.rollbackTocado) {
      otros.push({
        idTipoCalculoValorizacion: rollbackCatalogo.id,
        baseCalculo: Number(this.form.get('rollback')?.value ?? 0),
        importeBolivianos: this.rollbackResultadoBcl(),
      });
    }
    const fleteTransporteCatalogo = this.buscarOtroCalculoBcl('FLETE TRANSPORTE');
    if (fleteTransporteCatalogo && this.fleteTransporteTocado) {
      otros.push({
        idTipoCalculoValorizacion: fleteTransporteCatalogo.id,
        baseCalculo: Number(this.form.get('fleteTransporte')?.value ?? 0),
        importeBolivianos: this.fleteTransporteResultadoBcl(),
      });
    }

    return [...gastos, ...penalidades, ...otros];
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

  /** Restaura "Ley libre"/"Cargo"/"Cada" de penalidad ya guardados
   *  (extras.ley identifica una fila de penalidad, ver
   *  resolverLeyesPenalidadInicial), indexados por id del catálogo. */
  private resolverLeyesLibrePenalidadInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const valores: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as
        | { ley?: number; leyLibre?: number }
        | undefined;
      if (!Number.isNaN(id) && extras?.ley != null && extras?.leyLibre != null) {
        valores[id] = Number(extras.leyLibre);
      }
    });
    return valores;
  }

  private resolverCargosPenalidadInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const valores: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as
        | { ley?: number; cargo?: number }
        | undefined;
      if (!Number.isNaN(id) && extras?.ley != null && extras?.cargo != null) {
        valores[id] = Number(extras.cargo);
      }
    });
    return valores;
  }

  private resolverCadaPenalidadInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const valores: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as { ley?: number; cada?: number } | undefined;
      if (!Number.isNaN(id) && extras?.ley != null && extras?.cada != null) {
        valores[id] = Number(extras.cada);
      }
    });
    return valores;
  }

  /** Restaura el "Importe (Bs)" manual de penalidad ya guardado (ver
   *  importesManualesPenalidadBcl/onPenalidadImporteChange), indexado por
   *  id del catálogo. Mismo campo `extras.importeManual` que usan los
   *  gastos "simples" (ver resolverImportesGastoSimpleInicial). */
  private resolverImportesManualesPenalidadInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const valores: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as
        | { ley?: number; importeManual?: number }
        | undefined;
      if (
        !Number.isNaN(id) &&
        extras?.ley != null &&
        extras?.importeManual != null
      ) {
        valores[id] = Number(extras.importeManual);
      }
    });
    return valores;
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
      const extras = c['extras'] as
        | { actual?: number; base?: number }
        | undefined;
      // extras.actual solo existe en gastos de tratamiento, no en
      // penalidades (ver resolverLeyesPenalidadInicial): sirve para no
      // confundir ambos tipos de fila de `calculos`.
      if (!Number.isNaN(id) && extras?.actual != null && extras?.base != null) {
        bases[id] = Number(extras.base);
      }
    });
    return bases;
  }

  /** Restaura los "Escalador" de gastos de tratamiento ya guardados/
   *  sobrescritos (extras.escalador de cada fila de `calculos`), indexados
   *  por id del catálogo. Mismo patrón que resolverBasesGastoInicial. */
  private resolverEscaladoresGastoInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const escaladores: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as
        | { actual?: number; escalador?: number }
        | undefined;
      if (
        !Number.isNaN(id) &&
        extras?.actual != null &&
        extras?.escalador != null
      ) {
        escaladores[id] = Number(extras.escalador);
      }
    });
    return escaladores;
  }

  /** Restaura los "Importe (Bs)" de gastos "simples" ya guardados
   *  (extras.importeManual de cada fila de `calculos`, ver esGastoSimple),
   *  indexados por id del catálogo. */
  private resolverImportesGastoSimpleInicial(
    v: ValorizacionMineral,
  ): Record<number, number> {
    const importes: Record<number, number> = {};
    (v.calculos ?? []).forEach((c) => {
      const id = Number(c['idTipoCalculoValorizacion']);
      const extras = c['extras'] as { importeManual?: number } | undefined;
      if (!Number.isNaN(id) && extras?.importeManual != null) {
        importes[id] = Number(extras.importeManual);
      }
    });
    return importes;
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

  /** AC – fila de Estaño: el "precio por kilo" NO sale de una cotización de
   *  mercado, se interpola de la tabla de Escala de Precio del mineral
   *  (columna Bs/Kg, guardada en `precioTm`). Fórmula confirmada por el
   *  usuario 2026-08-27:
   *   - Ley que cae justo en un tramo tabulado → precio por kilo = su Bs/Kg
   *     (ej. ley 15 ⇒ 42).
   *   - Ley entre dos tramos [inferior, superior]:
   *       paso  = ENTERO( Bs/Kg del tramo superior ÷ (ley sup − ley inf) )
   *       precio por kilo = paso × (ley tecleada − ley inf) + Bs/Kg del inf
   *     (ej. ley 18 con tramos 15→42 y 20→69 ⇒ ENTERO(69/5)=13;
   *      13×(18−15)=39; 39+42 = 81).
   *   - Ley fuera del rango de la tabla → se recorta al tramo extremo.
   *  El valor de la tabla ya está en Bs/Kg: no interviene el tipo de cambio.
   *  El resto de campos de la fila (cotización, ley pagable) quedan en 0. */
  private recalcularFilaLeyAcEstano(fila: AbstractControl): void {
    const idMineral = fila.get('idMineral')?.value;
    const ley = Number(fila.get('ley')?.value ?? 0);

    const precioPorKilo = this.precioPorKiloEscalaEstano(idMineral, ley);
    const pKl = Math.floor(precioPorKilo);

    fila.patchValue(
      { cotizacionAplicada: 0, leyPagable: 0, precioPorKilo, pKl },
      { emitEvent: false },
    );
  }

  /** Interpola la tabla de Escala de Precio del estaño para una ley dada
   *  (ver recalcularFilaLeyAcEstano). 0 si el mineral no tiene tramos. */
  private precioPorKiloEscalaEstano(
    idMineral: number | string | null | undefined,
    ley: number,
  ): number {
    if (idMineral == null) return 0;
    const filas = this.escalaPrecioPorMineral()[Number(idMineral)]?.filas ?? [];
    if (filas.length === 0) return 0;

    // Ley fuera del rango de la tabla: se recorta al tramo extremo.
    const leyClamped = this.clamparLeyARangoDeTabla(idMineral, ley);

    // Tramo inferior: el de mayor ley que no supere la ley (ya recortada).
    let indiceInferior = 0;
    for (let i = 0; i < filas.length; i++) {
      if (filas[i].ley > leyClamped) break;
      indiceInferior = i;
    }
    const inferior = filas[indiceInferior];

    // Ley justo sobre un tramo (o recortada a un extremo): su Bs/Kg tal cual.
    if (leyClamped === inferior.ley || indiceInferior === filas.length - 1) {
      return this.redondear(inferior.precioTm, 2);
    }

    const superior = filas[indiceInferior + 1];
    const intervalo = superior.ley - inferior.ley;
    if (intervalo <= 0) return this.redondear(inferior.precioTm, 2);

    const paso = Math.trunc(superior.precioTm / intervalo);
    const resultado = paso * (leyClamped - inferior.ley) + inferior.precioTm;
    return this.redondear(resultado, 2);
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
    const precioPorKilo = this.redondear(
      (precioTmEscala / 1000) * tipoCambio,
      2,
    );
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
   *  filas; RAM = peso neto seco (kg) × Valor Tonelada (Bs) (ver
   *  totalUsdTmRam/valorToneladaBsRam) — sin el ×1000 extra: ese factor ya
   *  se cancela con el ÷1000 que arma valorToneladaBs, así que aplicarlo de
   *  nuevo aquí multiplicaba el resultado por 1000. El saldo a pagar se
   *  recalcula después, dentro de recalcularTotalesAportes() (depende
   *  también del total de aportes). */
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
      liquido = this.redondear(pesoNetoSeco * valorToneladaBs, 2);
    } else if (this.esCodificacionConcentrado()) {
      // BCL/BZL no usan "Precio por kilo"/"P/KL": Valor Neto TM (Total
      // USD/TM − Gastos de Tratamiento y Penalidades, ver valorNetoTmBcl) ×
      // peso neto seco (TMS) = "VALORACIÓN DEL LOTE"; luego se aplica "AL"
      // (% de pago provisional, ej. 85%) para llegar al Valor Bruto de
      // Venta — ambos del contrato de fundición de referencia.
      const sumaUsdTmBcl = this.detallesMineralesArray.controls.reduce(
        (acc, c) => acc + Number(c.get('precioUsdTm')?.value ?? 0),
        0,
      );
      this.totalUsdTmBcl.set(this.redondear(sumaUsdTmBcl, 4));
      // Sin redondear, para no amplificar el error al combinarlo con AL más
      // abajo (ver montoAlRawBcl/formatTotalLiquidacion); valoracionLoteBcl
      // (mostrado y usado como base de aportes) sigue redondeado a 2 como
      // antes.
      const valoracionLoteRaw = this.valorNetoTmBcl() * (pesoNetoSeco / 1000);
      const valoracionLote = this.redondear(valoracionLoteRaw, 2);
      this.valoracionLoteBcl.set(valoracionLote);
      const factorAl =
        Number(this.form.get('factorAlPorcentaje')?.value ?? 100) / 100;
      const montoAlRaw = valoracionLoteRaw * factorAl;
      const montoAl = this.redondear(montoAlRaw, 2);
      this.montoAlBcl.set(montoAl);
      this.montoAlRawBcl = montoAlRaw;
      // ROLLBACK: tal cual el contrato de fundición de referencia (G55 =
      // B55×E11÷1000), rollback × peso bruto húmedo ÷ 1000 — NO es un monto
      // fijo, es una tasa. Se resta del monto AL para dar "Líquido Pagable".
      const rollback = Number(this.form.get('rollback')?.value ?? 0);
      const rollbackResultadoRaw = (rollback * this.pesoBrutoHumedo()) / 1000;
      const rollbackResultado = this.redondear(rollbackResultadoRaw, 2);
      this.rollbackResultadoBcl.set(rollbackResultado);
      this.rollbackResultadoRawBcl = rollbackResultadoRaw;
      liquido = this.redondear(montoAl - rollbackResultado, 2);

      // FLETE TRANSPORTE: misma fórmula que ROLLBACK (tasa × peso bruto
      // húmedo ÷ 1000). Por ahora solo se calcula/muestra/guarda — el
      // usuario confirmó 2026-08-26 que todavía NO se resta de "liquido"
      // (a diferencia de rollback); eso queda para un ajuste posterior.
      const fleteTransporte = Number(
        this.form.get('fleteTransporte')?.value ?? 0,
      );
      const fleteTransporteResultadoRaw =
        (fleteTransporte * this.pesoBrutoHumedo()) / 1000;
      this.fleteTransporteResultadoRawBcl = fleteTransporteResultadoRaw;
      const fleteTransporteResultado = this.redondear(
        fleteTransporteResultadoRaw,
        2,
      );
      this.fleteTransporteResultadoBcl.set(fleteTransporteResultado);

      // Onzas troy de la fila de Plata (ver comentario de onzasTroyPlataBcl):
      // pura conversión de unidad, no alimenta ningún otro cálculo.
      const filaPlata = this.detallesMineralesArray.controls.find((c) =>
        this.esMineralPlata(c.get('idMineral')?.value),
      );
      if (filaPlata) {
        const leyPlata = Number(filaPlata.get('ley')?.value ?? 0);
        const factorPlata = this.factorConversionMineral(
          filaPlata.get('idMineral')?.value,
        );
        this.onzasTroyPlataBcl.set(
          this.redondear((leyPlata / factorPlata) * 100, 3),
        );
      } else {
        this.onzasTroyPlataBcl.set(0);
      }
    } else {
      const sumaPKl = this.detallesMineralesArray.controls.reduce(
        (acc, c) => acc + Number(c.get('pKl')?.value ?? 0),
        0,
      );
      // AC (Estaño): el Valor Bruto de Venta toma el peso neto seco SIN
      // decimales (truncado, ej. 2754,4x → 2754), tal cual el Excel de
      // referencia. El resto de codificaciones estándar/ICC lo usa completo.
      const pesoParaVbv = this.esCodificacionAc()
        ? Math.trunc(pesoNetoSeco)
        : pesoNetoSeco;
      liquido = this.redondear(pesoParaVbv * sumaPKl, 2);
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
    const idMineral = this.detallesMineralesArray
      .at(i)
      ?.get('idMineral')?.value;
    if (this.esCodificacionRam() || this.esFilaAcEstano(idMineral)) {
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
    const idMineral = this.detallesMineralesArray
      .at(i)
      ?.get('idMineral')?.value;
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
    // RAM ajusta la ley con "ajuste de puntos" (control leyAjustada); en AC
    // (Estaño) no hay ajuste y la fila usa el layout ICC, cuyo leyAjustada
    // queda siempre en 0, así que ahí se busca el tramo con la ley cruda.
    const leyParaTramo = this.esCodificacionRam()
      ? Number(fila?.get('leyAjustada')?.value ?? 0)
      : Number(fila?.get('ley')?.value ?? 0);
    const tramo = tieneLey
      ? this.buscarTramoEscalaPrecio(idMineral, leyParaTramo)
      : null;

    this.dialog.open(VerTablaPrecioDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        mineral: mineral?.descripcion ?? `Mineral #${idMineral}`,
        leyAjustada: tieneLey ? leyParaTramo : null,
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
   *  mineral: tabla de Escala de Precio cuando el precio del mineral sale de
   *  esa tabla (RAM, o el Estaño en AC), cotización de mercado en el resto.
   *  Usado desde el aviso "minerales sin precio vigente". */
  abrirRegistrarPrecioVigente(idMineral: number): void {
    if (this.mineralUsaEscalaPrecio(idMineral)) {
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

  /** Base de cálculo de "Descuentos de Ley" (columna "Base cálculo VBV."):
   *  en BCL/BZL es "Valorización Lote (VBV)" (valoracionLoteBcl, ANTES de
   *  aplicar AL/Rollback) — confirmado por el usuario 2026-08-26. En
   *  RAM/estándar sigue siendo el líquido pagable vigente
   *  (valorBrutoVenta), sin cambios. */
  baseCalculoAportes(): number {
    return this.esCodificacionConcentrado()
      ? this.valoracionLoteBcl()
      : this.valorBrutoVenta();
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
      idEntidadAporte: [
        preset?.id ?? (null as number | null),
        [Validators.required],
      ],
      tipoBaseAporte: [
        preset?.tipoBaseAporte ?? ('VBV' as TipoBaseAporteCatalogo),
        [Validators.required],
      ],
      /** Si está destildado, el aporte no se aplica: no cuenta en los
       *  totales ni se manda al guardar. */
      aplicar: [preset?.aplicar ?? true],
      /** Se precarga con la alícuota calculada (detalleAporte de la entidad,
       *  o suma de alicuotaInterna de los minerales en Regalía Minera) pero
       *  siempre queda editable: en cuanto el usuario la toca deja de
       *  autoactualizarse (ver recalcularAporte) y esa es la que se usa en
       *  los cálculos y se guarda. */
      porcentajeAporte: [0],
      /** Calculado: ver baseCalculoAportes. */
      baseCalculo: [{ value: this.baseCalculoAportes(), disabled: true }],
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
   *  base de cálculo = ver baseCalculoAportes
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
    const baseCalculo = this.baseCalculoAportes();
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

  /** Minerales de la tabla de ley que tienen alicuotaInterna configurada
   *  (estática en Mineral, ya no en Cotizacion). Base de la sugerencia de
   *  Regalía Minera, tanto para la suma como para el resumen del tooltip. */
  private mineralesConAlicuotaInterna(): Mineral[] {
    const catalogo = this.mineralesCatalogo();
    return this.idsMineralesEnFilas()
      .map((id) => catalogo.find((m) => Number(m.id) === id))
      .filter((m): m is Mineral => !!m && m.alicuotaInterna != null);
  }

  /** Suma de alicuotaInterna de cada mineral que interviene en la tabla de
   *  ley (0 para los que no tienen alícuota configurada). */
  private sumaAlicuotaInternaMinerales(): number {
    return this.mineralesConAlicuotaInterna().reduce(
      (acc, m) => acc + Number(m.alicuotaInterna ?? 0),
      0,
    );
  }

  /** Resumen para el tooltip de Regalía Minera, ej. "AG 6, PB 3". */
  tooltipRegaliaMinera(): string {
    const detalle = this.mineralesConAlicuotaInterna()
      .map((m) => `${(m.simbolo ?? '').toUpperCase()} ${m.alicuotaInterna}`)
      .join(', ');
    return detalle
      ? ` ${detalle}.`
      : 'Sin minerales con alícuota interna configurada. Editable.';
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
    // RAM y BCL/BZL: 2 decimales — en BCL/BZL este total alimenta "Total
    // Liquidación" (ver formatTotalLiquidacion), y redondear a 0 acá antes
    // de esa resta perdía precisión, igual que el bug de valorNetoTmBcl
    // (ver su comentario). Estándar/ICC sigue en 0 decimales, ya
    // confirmado antes para esa codificación — sin cambios ahí.
    this.totalImporteAportes.set(
      this.redondear(
        totalImporte,
        this.esCodificacionRam() || this.esCodificacionConcentrado() ? 2 : 0,
      ),
    );

    const anticipo = Number(this.valorizacion()?.anticipo ?? 0);
    const otrosAnticipo = Number(this.form.get('otrosAnticipo')?.value ?? 0);
    const ajusteTransporte = Number(
      this.form.get('ajusteTransporte')?.value ?? 0,
    );
    // "ROLLBACK" (solo BCL/BZL) ya está restado dentro de valorBrutoVenta
    // ("Líquido Pagable", ver recalcularTotales) — no se vuelve a restar acá.
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
      tipoCambio > 0
        ? this.redondear(this.valorLiquidoVentaBs() / tipoCambio, 2)
        : 0,
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
    const esBcl = this.esCodificacionConcentrado();
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
          const tramo = this.buscarTramoEscalaPrecio(
            idMineral,
            Number(d.leyAjustada ?? d.ley),
          );
          if (tramo) {
            detalle.idEscalaPrecio = tramo.id;
            detalle.leyAjustada = d.leyAjustada;
            detalle.precioUsdTm = d.precioTmEscala;
          }
        } else if (esBcl) {
          detalle.ajustePuntosLey = Number(d.ajustePuntosLey ?? 0);
          detalle.factorPorsentaje = Number(d.factorPorsentaje ?? 100);
          const cotizacion = estadosCotizacion[idMineral]?.cotizacion;
          if (cotizacion) detalle.idCotizacionMineral = Number(cotizacion.id);
          // BCL no descuenta la cotización ni calcula "Precio por kilo"
          // (ver recalcularFilaLeyBcl): se manda el USD/TM tal cual,
          // igual que RAM.
          detalle.precioUsdTm = d.precioUsdTm;
        } else if (this.esFilaAcEstano(idMineral)) {
          // Estaño en AC: el precio por kilo se interpola de la tabla de
          // Escala de Precio (ver recalcularFilaLeyAcEstano), no hay
          // cotización de mercado ni descuento.
          detalle.precioKilo = d.precioPorKilo;
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
      // "Total Liquidación" (VBV − Total aportes): aplica a todas las
      // codificaciones, incluida la variante BCL/BZL (ver totalLiquidacion).
      totalValorNetoVentaBolivianos: this.totalLiquidacion(),
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

    // Ver llegoAlStepGastosBcl y el comentario de ultimoCalculosEnviados:
    // no se manda `calculos` hasta que el liquidador llega a ese step (o ya
    // traía calculos guardados), Y solo si cambió desde el último PATCH
    // exitoso — si no, se reenviaría (y duplicaría en el back) el mismo
    // contenido ante cualquier edición ajena a esta sección.
    if (this.esCodificacionConcentrado() && this.llegoAlStepGastosBcl) {
      const calculos = this.construirCalculosBcl();
      const calculosJson = JSON.stringify(calculos);
      if (calculos.length > 0 && calculosJson !== this.ultimoCalculosEnviados) {
        payload.calculos = calculos;
        this.pendienteCalculos = calculosJson;
      } else {
        this.pendienteCalculos = this.ultimoCalculosEnviados;
      }
    } else {
      this.pendienteCalculos = this.ultimoCalculosEnviados;
    }

    if (v.idLaboratorio != null) payload.idLaboratorio = v.idLaboratorio;

    // Mismo criterio que calculos: solo se manda si cambió desde el último
    // PATCH exitoso (ver ultimoDetallesEnviados).
    const detalles = this.construirDetallesActuales();
    const detallesJson = JSON.stringify(detalles);
    if (detalles.length > 0 && detallesJson !== this.ultimoDetallesEnviados) {
      payload.detalles = detalles;
      this.pendienteDetalles = detallesJson;
    } else {
      this.pendienteDetalles = this.ultimoDetallesEnviados;
    }

    // "aportes" el back lo trata como lote completo: si viene con
    // contenido, compara contra los aportes activos actuales y, ante
    // cualquier diferencia, desactiva TODOS los anteriores y crea desde
    // cero solo los que vinieron en esta llamada. Pero mandar `aportes: []`
    // NO hace nada (el back solo actúa si el array trae contenido O si
    // viene `limpiarAportes`), así que si el usuario desmarcó todo hay que
    // pedir la limpieza explícitamente con ese flag. Igual que
    // detalles/calculos, solo se manda si cambió desde el último PATCH
    // exitoso — si no, cada edición ajena dispara el ciclo completo de
    // "desactivar todo y recrear" del back sin que haya nada nuevo.
    const aportes = this.construirAportesActuales();
    const aportesJson = JSON.stringify(aportes);
    if (aportes.length > 0) {
      if (aportesJson !== this.ultimoAportesEnviados) {
        payload.aportes = aportes;
        this.pendienteAportes = aportesJson;
      } else {
        this.pendienteAportes = this.ultimoAportesEnviados;
      }
    } else if ((this.valorizacion()?.calculoAportes?.length ?? 0) > 0) {
      payload.limpiarAportes = true;
      this.pendienteAportes = aportesJson;
    } else {
      this.pendienteAportes = this.ultimoAportesEnviados;
    }

    return payload;
  }

  /** Confirma como "enviados" los snapshots armados en el último
   *  construirPayloadActual() — llamar SOLO cuando el PATCH respondió OK
   *  (ver autoguardarBorrador/confirmarYGuardarConEstado). Si falla, no se
   *  llama: el próximo cambio del usuario reintenta con el mismo diff. */
  private confirmarSnapshotsEnviados(): void {
    this.ultimoDetallesEnviados = this.pendienteDetalles;
    this.ultimoCalculosEnviados = this.pendienteCalculos;
    this.ultimoAportesEnviados = this.pendienteAportes;
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
    console.log(
      '[autoguardado] PATCH valorizacion_mineral',
      this.valorizacionId,
      payload,
    );

    this.guardadoEnCurso = true;
    this.estadoAutoguardado.set('guardando');
    this.valorizacionMineralService
      .actualizarValorizacion(this.valorizacionId, payload)
      .subscribe({
        next: (actualizado) => {
          console.log('[autoguardado] respuesta OK', actualizado);
          this.guardadoEnCurso = false;
          this.valorizacion.set(actualizado);
          this.confirmarSnapshotsEnviados();
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
  onCambioStep(event: StepperSelectionEvent): void {
    // Se chequea tanto el step de llegada como el de salida: si el
    // liquidador viene DE "Gastos..." hacia el siguiente step, el evento
    // solo trae el step de destino en selectedStep, no el de origen.
    const LABEL_GASTOS_BCL = 'Gastos de Tratamiento y Penalidades';
    if (
      event.selectedStep?.label === LABEL_GASTOS_BCL ||
      event.previouslySelectedStep?.label === LABEL_GASTOS_BCL
    ) {
      this.llegoAlStepGastosBcl = true;
    }

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

    const esValorizacionFinal =
      idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO_ID;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: esValorizacionFinal ? '¿Valorizar?' : '¿Pre-valorizar?',
        message: esValorizacionFinal
          ? 'Al valorizar, esta operación quedará cerrada de forma definitiva y ya no podrás modificar estos datos. ¿Estás seguro de valorizar?'
          : 'Se guardará como pre-valorizado. Podrás seguir editando estos datos hasta que se valorice de forma definitiva. ¿Estás seguro de pre-valorizar?',
        confirmLabel: esValorizacionFinal ? 'Sí, valorizar' : 'Sí, pre-valorizar',
        tone: esValorizacionFinal ? 'danger' : 'default',
        icon: esValorizacionFinal ? 'lock' : 'help_outline',
      },
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (confirmado) this.guardarConEstado(idEstadoValorizacion);
    });
  }

  private guardarConEstado(idEstadoValorizacion: number): void {
    // Cancela cualquier autoguardado programado: el guardado explícito de
    // acá abajo ya manda el estado más reciente del form, así que ese
    // temporizador quedaría redundante (y podría disparar un PATCH en
    // paralelo con el de más abajo).
    if (this.autoguardadoTimeout) {
      clearTimeout(this.autoguardadoTimeout);
      this.autoguardadoTimeout = undefined;
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
          this.confirmarSnapshotsEnviados();
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
   *  no tocar este cálculo ya probado en el resto de codificaciones. RAM
   *  tiene su propia variante (ver recalcularPesoNetoSecoRam) que trunca en
   *  vez de redondear, así que esta rama queda solo para estándar/ICC. */
  private recalcularPesoNetoSeco(): void {
    if (this.esCodificacionConcentrado()) {
      this.recalcularPesoNetoSecoBcl();
      return;
    }
    if (this.esCodificacionRam()) {
      this.recalcularPesoNetoSecoRam();
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

  /** Solo RAM, tal cual el Excel de referencia "valorizacion cargas
   *  RAM.xlsx" (hoja "LIQ.", celda E14): peso neto seco = ROUNDDOWN(peso
   *  bruto húmedo − (peso bruto húmedo × humedad%), 3) — trunca a 3
   *  decimales en vez de redondear (a diferencia de estándar/ICC, ver
   *  recalcularPesoNetoSeco). */
  private recalcularPesoNetoSecoRam(): void {
    const bruto = this.pesoBrutoHumedo();
    const humedad = Number(this.form.get('humedadPorcentaje')?.value ?? 0);
    const neto = bruto - (bruto * humedad) / 100;
    this.form
      .get('pesoNetoSecoKilogramos')
      ?.setValue(this.truncarDecimales(neto, 3), { emitEvent: false });
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

  /** Delegado en el <form> (ver template): bloquea cualquier tecla que no
   *  sea dígito o punto decimal en CUALQUIER input numérico del formulario
   *  — evita notación científica ("e"), signo ("-", "+") y cualquier otro
   *  carácter que "type=number" deja teclear igual. Un solo listener en el
   *  form en vez de uno por input (el keydown burbujea). Deja pasar teclas
   *  de control (Backspace, Delete, flechas, Tab, etc.) y atajos con
   *  Ctrl/Cmd (copiar/pegar/seleccionar todo). No hace nada si la tecla no
   *  vino de un input numérico (ej. un <mat-select>).
   *  Excepción: los inputs marcados con [data-permite-negativo="true"]
   *  (ej. Transporte, que suma si es positivo y resta si es negativo) sí
   *  dejan pasar el "-", pero solo como primer carácter y una sola vez —
   *  igual que el resto del formulario respecto al ".". */
  restringirEntradaNumerica(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') {
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    const teclasControl = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (teclasControl.includes(event.key)) return;
    if (event.key === '.') {
      if (target.value.includes('.')) event.preventDefault();
      return;
    }
    if (event.key === '-') {
      const permiteNegativo = target.dataset['permiteNegativo'] === 'true';
      const yaTieneSigno = target.value.includes('-');
      const cursorAlInicio = (target.selectionStart ?? 0) === 0;
      if (permiteNegativo && !yaTieneSigno && cursorAlInicio) return;
      event.preventDefault();
      return;
    }
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  /** Trunca (no redondea) a `decimales` posiciones. Solo se usa para
   *  mostrar Valor Tonelada (Bs): el cálculo se guarda sin redondeo, pero en
   *  pantalla se limita a 4 decimales cortando el resto, sin ajustar el
   *  último dígito hacia arriba. */
  truncarDecimales(valor: number, decimales = 4): number {
    const factor = Math.pow(10, decimales);
    return Math.trunc(valor * factor) / factor;
  }

  /** Formatea los totales mostrados en el formulario: coma como separador
   *  de miles y punto como separador decimal. */
  formatTotal(valor: number | string | null | undefined): string {
    return formatNumeroConMiles(valor);
  }

  /** Total aportes (descuentos de ley): en RAM y BCL/BZL se muestra siempre
   *  con 2 decimales (fórmula del Excel de referencia); en estándar/ICC se
   *  mantiene el formato sin ceros de relleno, ya confirmado antes para esa
   *  codificación. */
  formatTotalAportes(): string {
    const valor = this.totalImporteAportes();
    if (this.esCodificacionRam() || this.esCodificacionConcentrado()) {
      return valor.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return formatNumeroConMiles(valor);
  }

  /** "Total Liquidación" (numérico, redondeado a 2): Valor Bruto de Venta −
   *  Total aportes (descuentos de ley). NO resta anticipos ni transporte
   *  (eso es el Líquido Pagable / VLV).
   *  - BCL/BZL: AL − Rollback − Flete Transporte − Total deducciones de ley
   *    — confirmado por el usuario 2026-08-26. Usa las versiones SIN
   *    redondear de AL/Rollback/Flete (montoAlRawBcl/
   *    rollbackResultadoRawBcl/fleteTransporteResultadoRawBcl) en vez de
   *    las que se muestran en su propia fila (ya redondeadas a 2
   *    decimales): restar varios valores ya redondeados desfasaba el
   *    resultado hasta 0.01 respecto al Excel de referencia, el mismo
   *    problema que tenía valorNetoTmBcl. A diferencia de valorBrutoVenta()
   *    (que todavía NO resta Flete Transporte), acá sí se resta.
   *  - RAM/estándar/AC: Valorización Lote (VBV) − Total aportes.
   *  Se envía al backend como `totalValorNetoVentaBolivianos` (ver
   *  construirPayloadActual). */
  totalLiquidacion(): number {
    const valor = this.esCodificacionConcentrado()
      ? this.montoAlRawBcl -
        this.rollbackResultadoRawBcl -
        this.fleteTransporteResultadoRawBcl -
        this.totalImporteAportes()
      : this.valorBrutoVenta() - this.totalImporteAportes();
    // El cálculo usa los valores sin redondear (ver comentario de arriba);
    // el redondeo a 2 decimales es una única vez sobre el resultado final —
    // no sobre cada componente por separado.
    return this.redondear(valor, 2);
  }

  formatTotalLiquidacion(): string {
    return formatNumeroConMiles(this.totalLiquidacion());
  }

  /** USD/TM (BCL, por fila y total): siempre 2 decimales, redondeados
   *  normal (≥5 sube) — corregido 2026-08-25: truncar en vez de redondear
   *  daba 1,342.49 en vez de los 1,342.50 del Excel de referencia (el
   *  tercer decimal era 8). Con coma como separador de miles, igual que el
   *  resto de totales. */
  formatUsdTm(valor: number | string | null | undefined): string {
    const num = typeof valor === 'number' ? valor : parseFloat(String(valor ?? 0));
    if (Number.isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
