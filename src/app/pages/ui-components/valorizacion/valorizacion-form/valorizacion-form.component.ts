// src/app/pages/ui-components/valorizacion/valorizacion-form/valorizacion-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { CotizacionFormDialogComponent } from 'src/app/pages/configurations/parametricas/cotizacion/cotizacion-form-dialog.component';
import {
  Cotizacion,
  Laboratorio,
  Mineral,
} from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import {
  LeyUnidad,
  MineralResumen,
} from '../../models/registro-mineral.models';
import {
  ActualizarValorizacionRequest,
  AporteValorizacionRequest,
  DetalleValorizacionRequest,
  ESTADO_VALORIZACION_BORRADOR_ID,
  ESTADO_VALORIZACION_PREVALORIZADO_ID,
  ESTADO_VALORIZACION_VALORIZADO_ID,
  EntidadAporte,
  TipoBaseAporteCatalogo,
  ValorizacionMineral,
} from '../../models/valorizacion-mineral.models';
import { ValorizacionMineralService } from '../../services/valorizacion-mineral.service';

/** Unidades disponibles para expresar la ley de un mineral */
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
  { id: ID_REGALIA_MINERA, tipoBaseAporte: 'VNV' }, // Regalía minera
  { id: 2, tipoBaseAporte: 'VNV' }, // Caja Nacional de Salud
  { id: 1, tipoBaseAporte: 'VNV' }, // CORPORACION MINERA DE BOLIVIA - COMIBOL
  { id: 9, tipoBaseAporte: 'VNV' }, // FEDECOMIN - POTOSI R.L.
  { id: 12, tipoBaseAporte: 'VNV' }, // FENCOMIN TRADICIONAL R.L.
];

interface FilaLeyMineral {
  idMineral: number | null;
  ley: number | null;
  leyUnidad: LeyUnidad;
  /** % de la cotización que se reconoce; si no viene guardado, se asume 100. */
  porcentajeCotizacion?: number;
  /** Entero tecleado por el liquidador (ver DetalleValorizacionRequest.precio). */
  precio?: number | null;
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
    MatTooltipModule,
  ],
  templateUrl: './valorizacion-form.component.html',
  styleUrl: './valorizacion-form.component.scss',
})
export class ValorizacionFormComponent implements OnInit {
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
  /** true mientras se hidratan los datos iniciales: evita que el primer
   *  patchValue dispare un autoguardado innecesario. */
  private cargandoInicial = true;
  private readonly autoguardar$ = new Subject<void>();

  /** Primer mineral de la codificación de la recepción: solo se usa para el
   *  encabezado. La ley/cotización real se maneja por fila (ver
   *  cotizacionesPorMineral), ya que una codificación puede traer varios. */
  readonly mineral = signal<MineralResumen | null>(null);

  /** Peso bruto húmedo: viene fijo de la balanza registrada en la recepción (balanzaL). */
  readonly pesoBrutoHumedo = computed(() =>
    Number(this.valorizacion()?.recepcionMineral?.balanzaL ?? 0),
  );

  /** Cotización vigente de cada mineral usado en las filas de ley, indexada
   *  por idMineral. Se verifica mineral por mineral (no uno global) porque
   *  una misma codificación puede mezclar varios (BZL, BCL) o cualquiera
   *  (RAM). */
  readonly cotizacionesPorMineral = signal<Record<number, CotizacionMineralEstado>>({});

  /** Líquido pagable = peso neto seco × suma de P/KL de todas las filas de ley. */
  readonly liquidoPagable = signal(0);
  /** Saldo a pagar = líquido pagable − anticipo. */
  readonly saldoAPagar = signal(0);

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
      !this.verificandoCotizacion &&
      this.mineralesSinCotizacion.length === 0
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
    pesoNetoHumedoKilogramos: [
      null as number | null,
      [Validators.required, Validators.min(0)],
    ],
    taraKilogramos: [0, [Validators.min(0)]],
    humedadPorcentaje: [0, [Validators.min(0)]],
    mermaPorcentaje: [0, [Validators.min(0)]],
    mermaKilogramos: [0, [Validators.min(0)]],
    /** Calculado: peso bruto húmedo − (peso bruto húmedo × humedad%). */
    pesoNetoSecoKilogramos: [null as number | null],
    /** El liquidador lo teclea manualmente (no viene de ningún catálogo). */
    tipoCambio: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    /** Precio final que realmente se usa para pagar: decisión del liquidador,
     *  se sugiere a partir del calculado pero es 100% editable. */
    precioKiloFinal: [
      null as number | null,
      [Validators.required, Validators.min(0)],
    ],
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
    this.form
      .get('humedadPorcentaje')!
      .valueChanges.subscribe(() => this.recalcularPesoNetoSeco());
    this.form
      .get('tipoCambio')!
      .valueChanges.subscribe(() => this.recalcularTodasLasFilasLey());

    // Autoguardado de borrador: cualquier cambio del usuario en el form
    // (pesos, merma, filas de ley, aportes, etc.) dispara, con debounce, un
    // PATCH parcial. Mientras se hidratan los datos iniciales (cargandoInicial)
    // se ignora para no autoguardar apenas se abre el formulario.
    this.form.valueChanges.subscribe(() => {
      if (!this.cargandoInicial) this.autoguardar$.next();
    });
    this.autoguardar$
      .pipe(debounceTime(1500))
      .subscribe(() => this.autoguardarBorrador());

    this.parametricasService.obtenerLaboratorios().subscribe((data) => {
      this.laboratorios.set(data);
    });
    this.parametricasService
      .obtenerAllEntidadesAporte()
      .subscribe((data: EntidadAporte[]) => this.entidadesAporte.set(data));
    this.parametricasService
      .obtenerMinerales()
      .subscribe((data) => this.mineralesCatalogo.set(data));

    this.cargarValorizacion();
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

    // Se usa solo para el encabezado (nombre a mostrar); la codificación
    // puede traer varios minerales (ej. BZL -> Plata + Zinc), cada uno se
    // valoriza con su propia cotización vigente y factorConversion.
    const mineral = v.recepcionMineral?.codificacion?.minerales?.[0] ?? null;
    this.mineral.set(mineral);

    this.form.patchValue({
      pesoNetoHumedoKilogramos:
        Number(v.recepcionMineral?.balanzaL ?? 0) || null,
      humedadPorcentaje: this.resolverHumedadInicial(v),
    });
    this.recalcularPesoNetoSeco();
    // Cada fila que se agrega aquí dispara su propia verificación de
    // cotización vigente por mineral (ver agregarFilaLey).
    this.inicializarDetallesMinerales(v);

    // Recién ahora se considera "hidratado": los patchValue de arriba no
    // deben disparar un autoguardado apenas se abre el formulario.
    this.cargandoInicial = false;

    // Va después de bajar cargandoInicial a propósito: si hay que agregar
    // alguno de los 5 por defecto porque el borrador no lo tenía, eso SÍ debe
    // disparar el autoguardado en cuanto tenga algo calculado.
    this.inicializarAportes(v);
  }

  /** Humedad inicial: prioriza la ya guardada en la valorización; si no
   *  existe, cae a la registrada en la recepción de mineral asociada. */
  private resolverHumedadInicial(v: ValorizacionMineral): number {
    if (v.humedadPorcentaje != null) return Number(v.humedadPorcentaje);
    if (v.recepcionMineral?.humedad != null)
      return Number(v.recepcionMineral.humedad);
    return 0;
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
    const fila = this.fb.group({
      idMineral: [
        { value: valor.idMineral, disabled: mineralBloqueado },
        [Validators.required],
      ],
      ley: [valor.ley, [Validators.required, Validators.min(0)]],
      leyUnidad: [valor.leyUnidad, [Validators.required]],
      /** % de la cotización vigente que se reconoce; 100 = se reconoce completa. */
      porcentajeCotizacion: [
        valor.porcentajeCotizacion ?? 100,
        [Validators.required, Validators.min(0)],
      ],
      /** Calculado: cotización vigente × (% cotización / 100). */
      cotizacionAplicada: [{ value: 0, disabled: true }],
      /** Entero tecleado por el liquidador; se antepone "0.0000" para formar
       *  el factor que usa Ley Pagable (ej. 45 → 0.000045). Se persiste en el
       *  detalle guardado para poder retomar el borrador sin perderlo. */
      precio: [
        valor.precio ?? (null as number | null),
        [Validators.required, Validators.min(1)],
      ],
      /** Calculado: cotización vigente / factorConversion del mineral × ley × factor de "precio". */
      leyPagable: [{ value: 0, disabled: true }],
      /** Calculado: ley pagable × 1000 × tipo de cambio. */
      precioPorKilo: [{ value: 0, disabled: true }],
      /** Calculado: precio por kilo redondeado. */
      pKl: [{ value: 0, disabled: true }],
    });
    this.detallesMineralesArray.push(fila);
    this.verificarCotizacionMineral(valor.idMineral);
    this.recalcularFilaLey(this.detallesMineralesArray.length - 1);
  }

  /** cotización aplicada = cotización vigente del mineral × (% cotización / 100)
   *  factor de precio = "0.0000" + entero tecleado en "precio" (ej. 45 → 0.000045)
   *  ley pagable = cotización vigente / factorConversion del mineral × ley × factor de precio
   *  precio por kilo = ley pagable × 1000 × tipo de cambio
   *  P/KL = precio por kilo redondeado hacia abajo (truncado) */
  recalcularFilaLey(i: number): void {
    const fila = this.detallesMineralesArray.at(i);
    if (!fila) return;

    const idMineral = fila.get('idMineral')?.value;
    const cotizacion = this.cotizacionUSDMineral(idMineral);
    const factorConversion = this.factorConversionMineral(idMineral);
    const ley = Number(fila.get('ley')?.value ?? 0);
    const porcentajeCotizacion = Number(
      fila.get('porcentajeCotizacion')?.value ?? 0,
    );
    const tipoCambio = Number(this.form.get('tipoCambio')?.value ?? 0);
    const factorPrecio = this.factorPrecio(fila.get('precio')?.value);

    const cotizacionAplicada = this.redondear(
      cotizacion * (porcentajeCotizacion / 100),
      4,
    );
    const leyPagable = this.redondear(
      (cotizacion / factorConversion) * ley * factorPrecio,
      8,
    );
    const precioPorKilo = this.redondear(leyPagable * 1000 * tipoCambio, 2);
    const pKl = Math.floor(precioPorKilo);

    fila.patchValue(
      { cotizacionAplicada, leyPagable, precioPorKilo, pKl },
      { emitEvent: false },
    );

    this.recalcularTotales();
  }

  /** El liquidador teclea un entero (ej. 45) y se le antepone "0.0000" para
   *  formar el factor real que usa la fórmula de Ley Pagable (0.000045). */
  private factorPrecio(precio: unknown): number {
    const entero = Number(precio ?? 0);
    if (!entero || entero < 0) return 0;
    return Number(`0.0000${Math.trunc(entero)}`);
  }

  /** líquido pagable = peso neto seco × suma de P/KL de todas las filas
   *  saldo a pagar = líquido pagable − anticipo */
  private recalcularTotales(): void {
    const pesoNetoSeco = Number(
      this.form.get('pesoNetoSecoKilogramos')?.value ?? 0,
    );
    const sumaPKl = this.detallesMineralesArray.controls.reduce(
      (acc, c) => acc + Number(c.get('pKl')?.value ?? 0),
      0,
    );
    const liquido = this.redondear(pesoNetoSeco * sumaPKl, 2);
    this.liquidoPagable.set(liquido);

    const anticipo = Number(this.valorizacion()?.anticipo ?? 0);
    this.saldoAPagar.set(this.redondear(liquido - anticipo, 2));

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
   *  mineral de una fila hay que verificar SU cotización vigente y
   *  recalcular con su propia cotización/factorConversion. */
  onMineralFilaChange(i: number): void {
    const idMineral = this.detallesMineralesArray.at(i)?.get('idMineral')
      ?.value;
    this.verificarCotizacionMineral(idMineral);
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

  // ==========================================================
  // APORTES / DESCUENTOS DE LEY (dinámico)
  // ==========================================================

  /** Rehidrata los aportes ya guardados del borrador (si la valorización
   *  viene de la bandeja y ya los tenía) y completa con los que falten de
   *  los 5 por defecto. Los que se agregan recién ahora (sin dato guardado)
   *  no se autoguardan hasta tener algo realmente calculado (ver
   *  construirAportesActuales): evita persistir filas en 0. */
  private inicializarAportes(v: ValorizacionMineral): void {
    this.aportesArray.clear();

    // NOTA: se asume que el back devuelve calculoAportes con la misma forma
    // que se manda en el PATCH (idEntidadAporte, tipoBaseAporte,
    // porcentajeAporte, y activo para las desactivadas). Si el nombre real
    // difiere, ajustar los accesos de abajo.
    const guardados = (v.calculoAportes ?? []).filter(
      (a) => a['activo'] !== false && a['idEntidadAporte'] != null,
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
      });
    });

    const idsGuardados = new Set(
      guardados.map((a) => Number(a['idEntidadAporte'])),
    );
    ENTIDADES_APORTE_POR_DEFECTO.filter(
      (preset) => !idsGuardados.has(preset.id),
    ).forEach((preset) => this.agregarAporte(preset));
  }

  /** @param preset opcional: entidad+base a precargar (ver
   *  inicializarAportes); `porcentajeGuardado` restaura el % ya editado
   *  previamente (relevante sobre todo para Regalía Minera, cuyo % es
   *  editable a mano). Sin preset, la fila queda en blanco para que el
   *  usuario elija (botón "Agregar aporte"). */
  agregarAporte(preset?: {
    id: number;
    tipoBaseAporte: TipoBaseAporteCatalogo;
    porcentajeGuardado?: number;
  }): void {
    const esRegaliaMinera = preset?.id === ID_REGALIA_MINERA;
    const fila = this.fb.group({
      idEntidadAporte: [preset?.id ?? (null as number | null), [Validators.required]],
      tipoBaseAporte: [
        preset?.tipoBaseAporte ?? (null as TipoBaseAporteCatalogo | null),
        [Validators.required],
      ],
      /** Si está destildado, el aporte no se aplica: no cuenta en los
       *  totales ni se manda al guardar. */
      aplicar: [true],
      /** Calculado para el resto de entidades (de su detalleAporte).
       *  Para Regalía Minera es una SUGERENCIA editable (suma de
       *  alicuotaInterna de los minerales vigentes): por eso queda habilitado
       *  solo en ese caso, y deja de autoactualizarse en cuanto el usuario
       *  lo toca (ver recalcularAporte). */
      porcentajeAporte: [
        { value: 0, disabled: !esRegaliaMinera },
      ],
      /** Calculado: siempre es el líquido pagable vigente. */
      baseCalculo: [{ value: this.liquidoPagable(), disabled: true }],
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

  /** alícuota = la del detalleAporte de la entidad (VBV/VNV elegida); en
   *  Regalía Minera es la suma de alicuotaInterna de los minerales vigentes,
   *  sugerida solo mientras el usuario no la haya editado a mano.
   *  base de cálculo = líquido pagable vigente
   *  importe = aplicar ? base de cálculo × (alícuota / 100) : 0 */
  recalcularAporte(i: number): void {
    const fila = this.aportesArray.at(i);
    if (!fila) return;

    const idEntidad = fila.get('idEntidadAporte')?.value;
    const base = fila.get('tipoBaseAporte')?.value;
    const controlPorcentaje = fila.get('porcentajeAporte')!;

    let alicuota: number;
    if (idEntidad === ID_REGALIA_MINERA) {
      if (controlPorcentaje.pristine) {
        alicuota = this.sumaAlicuotaInternaMinerales();
        controlPorcentaje.setValue(alicuota, { emitEvent: false });
      } else {
        alicuota = Number(controlPorcentaje.value ?? 0);
      }
    } else {
      alicuota = this.buscarAlicuotaAporte(idEntidad, base);
      controlPorcentaje.setValue(alicuota, { emitEvent: false });
    }

    const aplicar = fila.get('aplicar')?.value !== false;
    const baseCalculo = this.liquidoPagable();
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
    this.totalImporteAportes.set(this.redondear(totalImporte, 2));
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
    const estados = this.cotizacionesPorMineral();
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
        if (d.precio != null) detalle.precio = Number(d.precio);

        const cotizacion = estados[idMineral]?.cotizacion;
        if (cotizacion) {
          detalle.idCotizacionMineral = Number(cotizacion.id);
          detalle.porcentajeCotizacion = d.porcentajeCotizacion;
          detalle.cotizacionAplicada = d.cotizacionAplicada;
          detalle.leyPagable = d.leyPagable;
          detalle.precioKilo = d.precioPorKilo;
        }
        return detalle;
      });
  }

  /** Solo se mandan los aportes con el check "aplicar" activado y que ya
   *  tengan algo calculado (importe > 0): los recién precargados por
   *  defecto que todavía no resolvieron cotización/ley no se guardan hasta
   *  tener un valor real, para no persistir filas en 0. */
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
      pesoNetoHumedoKilogramos: v.pesoNetoHumedoKilogramos ?? undefined,
      pesoNetoSecoKilogramos: v.pesoNetoSecoKilogramos ?? undefined,
      taraKilogramos: v.taraKilogramos ?? undefined,
      humedadPorcentaje: v.humedadPorcentaje ?? undefined,
      mermaPorcentaje: v.mermaPorcentaje ?? undefined,
      mermaKilogramos: v.mermaKilogramos ?? undefined,
      cotizacionDolar: v.tipoCambio ?? undefined,
      // TODO: cuando se implementen los descuentos de ley (fase 2), separar
      // totalValorBrutoBolivianos (antes de descuentos) de
      // liquidoPagableBolivianos (después). Por ahora son el mismo valor.
      totalValorBrutoBolivianos: this.liquidoPagable(),
      totalAportesBolivianos: this.totalImporteAportes(),
      liquidoPagableBolivianos: this.liquidoPagable(),
      saldoPagarBolivianos: this.saldoAPagar(),
    };

    if (v.idLaboratorio != null) payload.idLaboratorio = v.idLaboratorio;

    const detalles = this.construirDetallesActuales();
    if (detalles.length > 0) payload.detalles = detalles;

    const aportes = this.construirAportesActuales();
    if (aportes.length > 0) payload.aportes = aportes;

    return payload;
  }

  /** Autoguardado silencioso: se dispara solo, con debounce, ante cualquier
   *  cambio del usuario. Nunca cambia idEstadoValorizacion (se queda en
   *  BORRADOR) y no bloquea la UI ni usa el spinner de los botones. */
  private autoguardarBorrador(): void {
    if (!this.esEditable || this.cargandoInicial) return;

    const payload = this.construirPayloadActual();
    console.log('[autoguardado] PATCH valorizacion_mineral', this.valorizacionId, payload);

    this.estadoAutoguardado.set('guardando');
    this.valorizacionMineralService
      .actualizarValorizacion(this.valorizacionId, payload)
      .subscribe({
        next: (actualizado) => {
          console.log('[autoguardado] respuesta OK', actualizado);
          this.valorizacion.set(actualizado);
          this.estadoAutoguardado.set('guardado');
        },
        error: (err) => {
          console.log('[autoguardado] error', err);
          this.estadoAutoguardado.set('error');
        },
      });
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

    const request: ActualizarValorizacionRequest = {
      ...this.construirPayloadActual(),
      idEstadoValorizacion,
    };
    console.log('[guardar]', request);

    this.guardando.set(true);
    this.valorizacionMineralService
      .actualizarValorizacion(this.valorizacionId, request)
      .subscribe({
        next: (actualizado) => {
          console.log('[guardar] respuesta OK', actualizado);
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
          this.guardando.set(false);
          const mensaje =
            err?.error?.message ??
            'Ocurrió un error al guardar la valorización';
          this.snackBar.open(mensaje, 'Cerrar', { duration: 5000 });
        },
      });
  }

  /** peso neto seco = peso bruto húmedo − (peso bruto húmedo × humedad%) */
  private recalcularPesoNetoSeco(): void {
    const bruto = this.pesoBrutoHumedo();
    const humedad = Number(this.form.get('humedadPorcentaje')?.value ?? 0);
    const neto = bruto - (bruto * humedad) / 100;
    this.form
      .get('pesoNetoSecoKilogramos')
      ?.setValue(this.redondear(neto), { emitEvent: false });
    this.recalcularTotales();
  }

  private redondear(valor: number, decimales = 3): number {
    const factor = Math.pow(10, decimales);
    return Math.round((valor + Number.EPSILON) * factor) / factor;
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
