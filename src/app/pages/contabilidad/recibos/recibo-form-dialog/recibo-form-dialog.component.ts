// src/app/pages/contabilidad/recibos/recibo-form-dialog/recibo-form-dialog.component.ts
//
// Diálogo único para los dos caminos que llevan a un recibo:
//  - modo 'GENERAR'  → solo cabecera (fecha, forma de pago, monto total,
//    concepto, contraparte). POST sin `detalles` → recibo en BORRADOR.
//  - modo 'PROCESAR' → cabecera completa + reparto a kardex + efectivo resto.
//      · sin `data.recibo`  → alta directa: POST con `detalles` (one-shot,
//        queda PROCESADO sin pasar por BORRADOR).
//      · con `data.recibo`  → procesa ese BORRADOR: la cabecera básica
//        (fecha, monto, concepto, contraparte) va bloqueada; PATCH
//        /:id/procesar con `detalles` + forma de pago / banco / tipo mov.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  montoDosDecimales,
  tipoCambioCuatroDecimales,
} from '../../../../shared/utils/numero.util';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, forkJoin, map, Observable, startWith } from 'rxjs';
import {
  ActorProductivoMinero,
  PersonaCI,
} from '../../../configurations/models/persona.models';
import {
  Cliente,
  CuentaFinanciera,
  DestinoGasto,
  EntidadFinanciera,
  FormaPago,
  MonedaCuenta,
  SIMBOLO_MONEDA,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { PersonaService } from '../../../configurations/services/persona.service';
import {
  ContraparteReciboRequest,
  DestinoDetalleRecibo,
  DetalleReciboRequest,
  GenerarReciboRequest,
  ProcesarReciboRequest,
  Recibo,
  TipoRecibo,
} from '../../models/recibo.models';
import { KardexService } from '../../services/kardex.service';
import { ReciboService } from '../../services/recibo.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

export type ReciboFormModo = 'GENERAR' | 'PROCESAR';

export interface ReciboFormDialogData {
  tipo: TipoRecibo;
  modo: ReciboFormModo;
  /** Solo en modo 'PROCESAR': el BORRADOR que se está procesando. */
  recibo?: Recibo;
  /** Solo en modo 'GENERAR': datos ya conocidos (ej. anticipo de una recepción). */
  prefill?: ReciboPrefill;
}

/** Datos precargados del recibo. Con `idRecepcionMineral` o
 *  `idValorizacionMineral` el monto queda bloqueado (el back exige que
 *  coincida con el anticipo o con el líquido pagable, en Bs). */
export interface ReciboPrefill {
  /** YYYY-MM-DD */
  fecha: string;
  /** null = lo teclea el usuario (ej. anticipo de venta de lote). */
  montoTotal: number | null;
  concepto: string;
  idPersona?: string;
  idRecepcionMineral?: string;
  idValorizacionMineral?: string;
  /** Cobro (anticipo/pago) de una venta de lote: contraparte fija = cliente
   *  comprador y TODO el monto va a su kardex (una sola línea CLIENTE, sin
   *  efectivo suelto); entra a caja o, con forma de pago bancaria, a la
   *  libreta. Moneda y tipo de cambio editables. */
  idVentaLote?: string;
  idCliente?: string;
  /** Código de lote que se estampa en la línea del kardex. */
  lote?: string;
  moneda?: MonedaCuenta;
  tipoCambio?: number | null;
}

/** El control puede tener una PersonaCI recién elegida del autocomplete,
 *  texto suelto tecleado (inválido al guardar), o nada. */
type PersonaControlValue = PersonaCI | string | null;

type ContraparteTipo = 'PERSONA' | 'ACTOR' | 'CLIENTE' | 'TEXTO';

/** El autocomplete de destino de gasto guarda el objeto elegido, o el texto
 *  suelto mientras se escribe (se ignora al guardar si no coincide). */
type DestinoGastoControlValue = DestinoGasto | string | null;

/** Las filas del formulario son solo reparto a kardex; el efectivo es el
 *  resto calculado (monto total − suma de filas) y no se teclea. */
type DestinoFila = Exclude<DestinoDetalleRecibo, 'EFECTIVO'>;

/** Opción del desplegable combinado de reparto: persona o actor, ambos con
 *  kardex ABIERTO. */
interface DestinatarioKardex {
  tipo: DestinoFila;
  id: string;
  label: string;
  buscar: string;
}

type DestinatarioControlValue = DestinatarioKardex | string | null;

@Component({
  selector: 'app-recibo-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './recibo-form-dialog.component.html',
  styleUrl: './recibo-form-dialog.component.scss',
})
export class ReciboFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ReciboFormDialogComponent>);
  readonly data = inject<ReciboFormDialogData>(MAT_DIALOG_DATA);
  private readonly reciboService = inject(ReciboService);
  private readonly kardexService = inject(KardexService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly formasPago = signal<FormaPago[]>([]);
  readonly destinosGasto = signal<DestinoGasto[]>([]);
  readonly personas = signal<PersonaCI[]>([]);
  readonly actores = signal<ActorProductivoMinero[]>([]);
  readonly clientes = signal<Cliente[]>([]);
  readonly entidadesFinancieras = signal<EntidadFinanciera[]>([]);
  readonly personasAutorizadas = signal<PersonaCI[]>([]);

  /** Códigos de forma de pago que NO usan cuenta bancaria (efectivo). El resto
   *  (QR, transferencia, cheque, depósito…) exige cuenta + n° de comprobante. */
  private readonly CODIGOS_SIN_BANCO = new Set(['EFECTIVO']);

  /** true en 'GENERAR': solo se guarda la cabecera mínima (BORRADOR). */
  get esGenerar(): boolean {
    return this.data.modo === 'GENERAR';
  }

  /** true cuando se está procesando un BORRADOR existente: la cabecera básica
   *  va de solo lectura y el submit es PATCH /:id/procesar. */
  get esBorrador(): boolean {
    return this.data.modo === 'PROCESAR' && !!this.data.recibo;
  }

  /** 'PROCESAR' (directo o sobre borrador) pide el reparto a kardex. */
  get pideDetalles(): boolean {
    return this.data.modo === 'PROCESAR';
  }

  get esIngreso(): boolean {
    return this.data.tipo === 'INGRESO';
  }

  get labelContraparte(): string {
    return this.esIngreso ? 'Recibí de' : 'Entregué a';
  }

  get labelDestinoGasto(): string {
    return this.esIngreso ? 'Origen del ingreso' : 'Destino del gasto';
  }

  get titulo(): string {
    const t = this.esIngreso ? 'ingreso' : 'egreso';
    if (this.esGenerar) return `Generar ${t}`;
    if (this.esBorrador) {
      return `Procesar recibo ${this.codigoRecibo(this.data.recibo!)}`;
    }
    return `Procesar ${t}`;
  }

  readonly form = new FormGroup({
    // Arranca con la fecha actual; al procesar un borrador o precargar desde
    // recepción se reemplaza por la fecha que ya trae el recibo.
    fecha: new FormControl<Date | null>(this.hoy(), [Validators.required]),
    montoTotal: new FormControl<number | string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    // Moneda del recibo: montoTotal y reparto van en esta moneda. Se fija al
    // crear el borrador; un anticipo de recepción solo puede ser BS.
    moneda: new FormControl<MonedaCuenta>('BS', { nonNullable: true }),
    // Bs por 1 USD; validadores dinámicos (obligatorio solo en USD).
    tipoCambio: new FormControl<number | string | null>(null),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    // Quién autorizó el recibo: obligatoria, debe salir del catálogo de
    // personas autorizadas. Fija desde que se crea el recibo.
    idPersonaAutorizo: new FormControl<string | null>(null, [
      Validators.required,
    ]),
    // Forma de pago: obligatoria en los dos modos.
    idFormaPago: new FormControl<number | null>(null, [Validators.required]),
    // Solo aplican con forma de pago bancaria; validadores dinámicos.
    idCuentaBancaria: new FormControl<number | null>(null),
    nroComprobante: new FormControl<string | null>(null),
    // Destino del gasto de la porción EFECTIVO (el de cada fila de reparto va
    // dentro de su propio FormGroup). Obligatorio solo si hay efectivo > 0.
    destinoGastoEfectivo: new FormControl<DestinoGastoControlValue>(null),
    // Contraparte "Recibí de / Entregué a": una de las tres.
    contraparteTipo: new FormControl<ContraparteTipo>('PERSONA'),
    personaContraparte: new FormControl<PersonaControlValue>(null),
    idActorContraparte: new FormControl<string | null>(null),
    idClienteContraparte: new FormControl<string | null>(null),
    textoContraparte: new FormControl<string | null>(null),
    // Reparto a kardex; el resto (montoTotal − suma) va a efectivo.
    detalles: new FormArray<FormGroup>([]),
  });

  get f() {
    return this.form.controls;
  }

  get detalles(): FormArray {
    return this.form.controls.detalles;
  }

  get filas(): FormGroup[] {
    return this.detalles.controls as FormGroup[];
  }

  get contraparteTipo(): ContraparteTipo {
    return this.f.contraparteTipo.value ?? 'PERSONA';
  }

  /** Autocomplete de la persona contraparte del recibo. */
  readonly personasContraparte$: Observable<PersonaCI[]> = combineLatest([
    this.form.controls.personaContraparte.valueChanges.pipe(startWith('')),
    toObservable(this.personas),
  ]).pipe(map(([valor, lista]) => this.filtrarPersonas(valor, lista)));

  ngOnInit(): void {
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });
    this.f.nroComprobante.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.nroComprobante.setValue(up, { emitEvent: false });
    });
    this.f.textoContraparte.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.textoContraparte.setValue(up, { emitEvent: false });
    });

    // Al cambiar la forma de pago, se prende/apaga cuenta bancaria + comprobante.
    this.f.idFormaPago.valueChanges.subscribe(() => this.sincronizarCamposBanco());
    // Al cambiar la moneda: T.C. obligatorio solo en USD y la cuenta elegida
    // se limpia (la lista de cuentas se filtra por moneda).
    this.f.moneda.valueChanges.subscribe(() => {
      this.f.idCuentaBancaria.setValue(null, { emitEvent: false });
      this.sincronizarTipoCambio();
    });
    // Al cambiar el tipo de contraparte, se limpia lo que ya no aplica.
    this.f.contraparteTipo.valueChanges.subscribe(() => {
      this.f.personaContraparte.setValue(null, { emitEvent: false });
      this.f.idActorContraparte.setValue(null, { emitEvent: false });
      this.f.idClienteContraparte.setValue(null, { emitEvent: false });
      this.f.textoContraparte.setValue(null, { emitEvent: false });
    });

    forkJoin({
      formasPago: this.parametricasService.obtenerFormasPago(),
      destinosGasto: this.parametricasService.obtenerDestinosGasto(),
      personas: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      }),
      actores: this.personaService.getAllActoresMineros(),
      clientes: this.parametricasService.getAllClientes(),
      entidadesFinancieras:
        this.parametricasService.obtenerEntidadesFinancieras(),
      personasAutorizadas: this.personaService.listarPersonasAutorizadas(),
      // Solo personas/actores/clientes con un kardex ABIERTO son elegibles en el recibo.
      // El kardex de personas se partió en dos tipos (PERSONAL = personal
      // interno de TINKURIKUNA, ASOCIADO = el resto), pero para el recibo
      // ambos siguen siendo "destino: PERSONAL" — hay que juntar los dos
      // listados para no perder a los asociados con kardex abierto.
      kardexPersonal: this.kardexService.listar({
        tipo: 'PERSONAL',
        estado: 'ABIERTO',
        limit: 1000,
      }),
      kardexAsociado: this.kardexService.listar({
        tipo: 'ASOCIADO',
        estado: 'ABIERTO',
        limit: 1000,
      }),
      kardexActor: this.kardexService.listar({
        tipo: 'ACTOR',
        estado: 'ABIERTO',
        limit: 1000,
      }),
      kardexCliente: this.kardexService.listar({
        tipo: 'CLIENTE',
        estado: 'ABIERTO',
        limit: 1000,
      }),
    }).subscribe({
      next: ({
        formasPago,
        destinosGasto,
        personas,
        actores,
        clientes,
        entidadesFinancieras,
        personasAutorizadas,
        kardexPersonal,
        kardexAsociado,
        kardexActor,
        kardexCliente,
      }) => {
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
        this.destinosGasto.set(
          destinosGasto.filter((d) => d.activo !== false),
        );

        const idsPersonaConKardex = new Set(
          [...(kardexPersonal.data ?? []), ...(kardexAsociado.data ?? [])]
            .map((k) => String(k.idPersona ?? k.persona?.id ?? ''))
            .filter(Boolean),
        );
        const idsActorConKardex = new Set(
          (kardexActor.data ?? [])
            .map((k) =>
              String(k.idActorProductivoMinero ?? k.actorProductivoMinero?.id ?? ''),
            )
            .filter(Boolean),
        );
        const idsClienteConKardex = new Set(
          (kardexCliente.data ?? [])
            .map((k) => String(k.idCliente ?? k.cliente?.id ?? ''))
            .filter(Boolean),
        );
        this.personas.set(
          (personas.data ?? []).filter((p) =>
            idsPersonaConKardex.has(String(p.id)),
          ),
        );
        this.actores.set(
          (actores ?? []).filter((a) => idsActorConKardex.has(String(a.id))),
        );
        this.clientes.set(
          (clientes ?? []).filter((c) => idsClienteConKardex.has(String(c.id))),
        );

        this.entidadesFinancieras.set(
          (entidadesFinancieras ?? []).filter((e) => e.activo !== false),
        );
        this.personasAutorizadas.set(
          (personasAutorizadas ?? []).filter(
            (p) => p.autorizado !== false && p.activo !== false,
          ),
        );
        this.cargandoCatalogos.set(false);
        if (this.data.recibo) this.prefillDesdeBorrador(this.data.recibo);
        else if (this.data.prefill) this.aplicarPrefill(this.data.prefill);
        this.sincronizarCamposBanco();
        this.sincronizarTipoCambio();
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  /** Precarga la cabecera con datos ya conocidos; el usuario completa el resto. */
  private aplicarPrefill(p: ReciboPrefill): void {
    this.form.patchValue({
      fecha: this.parseFecha(p.fecha) ?? this.hoy(),
      montoTotal: p.montoTotal,
      concepto: p.concepto,
    });
    if (p.idPersona) {
      const persona = this.personas().find(
        (x) => String(x.id) === String(p.idPersona),
      );
      if (persona) {
        this.f.contraparteTipo.setValue('PERSONA', { emitEvent: false });
        this.f.personaContraparte.setValue(persona, { emitEvent: false });
      }
    }
    // El monto debe coincidir con el anticipo de la recepción (o el líquido
    // pagable de la valorización) vinculada, y ambos se registran en Bs.
    if (this.montoVinculado) {
      this.f.montoTotal.disable({ emitEvent: false });
      this.f.moneda.setValue('BS', { emitEvent: false });
      this.f.moneda.disable({ emitEvent: false });
    }
    if (p.idVentaLote) this.aplicarCobroVentaLote(p);
  }

  /** Cobro de venta de lote (ver ReciboPrefill.idVentaLote). */
  get esCobroVentaLote(): boolean {
    return !!this.data.prefill?.idVentaLote;
  }

  private aplicarCobroVentaLote(p: ReciboPrefill): void {
    if (p.moneda) this.f.moneda.setValue(p.moneda, { emitEvent: false });
    if (p.moneda === 'USD' && p.tipoCambio) {
      this.f.tipoCambio.setValue(p.tipoCambio, { emitEvent: false });
    }
    // Contraparte: el cliente comprador, fija.
    this.f.contraparteTipo.setValue('CLIENTE', { emitEvent: false });
    this.f.idClienteContraparte.setValue(p.idCliente ?? null, { emitEvent: false });
    this.f.contraparteTipo.disable({ emitEvent: false });
    this.f.idClienteContraparte.disable({ emitEvent: false });

    // Una sola línea CLIENTE por el monto total: HABER en su kardex.
    const destinatario = this.destinatariosKardex().find(
      (d) => d.tipo === 'CLIENTE' && d.id === String(p.idCliente),
    );
    const fila = this.crearFilaDetalle();
    fila.controls['destinatario'].setValue(destinatario ?? null);
    fila.controls['destinatario'].disable({ emitEvent: false });
    fila.controls['monto'].disable({ emitEvent: false });
    this.detalles.push(fila);
    const sincronizar = () =>
      fila.controls['monto'].setValue(this.montoTotal() || null, {
        emitEvent: false,
      });
    sincronizar();
    this.f.montoTotal.valueChanges.subscribe(sincronizar);
    if (!destinatario) {
      this.snackBar.open(
        'El cliente no tiene un kardex abierto: ábrelo antes de registrar el cobro.',
        'Cerrar',
        { duration: 6000 },
      );
    }
  }

  /** Carga la cabecera del BORRADOR y bloquea los campos que no se pueden
   *  corregir al procesar (fecha, monto, concepto, contraparte). */
  private prefillDesdeBorrador(r: Recibo): void {
    this.form.patchValue({
      fecha: this.parseFecha(r.fecha),
      montoTotal: Number(r.montoTotal),
      moneda: r.moneda ?? 'BS',
      tipoCambio: r.tipoCambio != null ? Number(r.tipoCambio) : null,
      concepto: r.concepto ?? '',
      idPersonaAutorizo: r.idPersonaAutorizo ?? null,
      idFormaPago: r.idFormaPago ?? null,
      idCuentaBancaria: r.idCuentaBancaria ?? null,
      nroComprobante: r.nroComprobante ?? null,
    });
    for (const nombre of [
      'fecha',
      'montoTotal',
      'moneda',
      'tipoCambio',
      'concepto',
      'idPersonaAutorizo',
      'contraparteTipo',
      'personaContraparte',
      'idActorContraparte',
      'idClienteContraparte',
      'textoContraparte',
    ] as const) {
      this.f[nombre].disable({ emitEvent: false });
    }
  }

  /** Contraparte de un recibo ya creado, en texto (para mostrar bloqueada). */
  contraparteTexto(r: Recibo): string {
    if (r.persona) {
      return `${r.persona.nombres} ${r.persona.apellidoPaterno} ${
        r.persona.apellidoMaterno ?? ''
      }`
        .trim()
        .replace(/\s+/g, ' ');
    }
    if (r.actorProductivoMinero) {
      return `${r.actorProductivoMinero.nombre} (actor productivo)`;
    }
    if (r.cliente) {
      return `${r.cliente.nombre} (cliente)`;
    }
    return r.nombresApellidos || '—';
  }

  /** Quién autorizó un recibo ya creado, en texto (para mostrar bloqueada). */
  nombrePersonaAutorizo(r: Recibo): string {
    const p = r.personaAutorizo;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  codigoRecibo(r: Recibo): string {
    return `${r.serie}-${String(r.numero).padStart(4, '0')}`;
  }

  num(v: string | number | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Destinos de gasto de la porción de EFECTIVO: `esEgreso` según el tipo de
   *  recibo (un egreso saca plata de caja; un ingreso la mete). */
  get destinosGastoFiltrados(): DestinoGasto[] {
    const quiero = this.data.tipo === 'EGRESO';
    return this.destinosGasto().filter((d) => d.esEgreso === quiero);
  }

  /** Destinos de gasto de las filas de reparto a kardex: siempre "de ingreso"
   *  (`esEgreso === false`), porque esas porciones generan un INGRESO en caja
   *  (valor recuperado), sin importar el tipo del recibo. */
  private get destinosGastoIngreso(): DestinoGasto[] {
    return this.destinosGasto().filter((d) => !d.esEgreso);
  }

  displayDestinoGasto = (v: DestinoGastoControlValue): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.nombre;
  };

  private filtrarDestinosGasto(
    lista: DestinoGasto[],
    valor: DestinoGastoControlValue,
  ): DestinoGasto[] {
    const texto = (
      typeof valor === 'string' ? valor : valor ? valor.nombre : ''
    )
      .trim()
      .toLowerCase();
    return texto
      ? lista.filter((d) => d.nombre.toLowerCase().includes(texto))
      : lista;
  }

  /** Opciones del destino de gasto de una fila de reparto (solo ingresos). */
  destinoGastoFilaOpciones(fila: AbstractControl): DestinoGasto[] {
    return this.filtrarDestinosGasto(
      this.destinosGastoIngreso,
      (fila as FormGroup).controls['destinoGasto'].value as DestinoGastoControlValue,
    );
  }

  /** Opciones del destino de gasto de la porción de efectivo. */
  destinoGastoEfectivoOpciones(): DestinoGasto[] {
    return this.filtrarDestinosGasto(
      this.destinosGastoFiltrados,
      this.f.destinoGastoEfectivo.value,
    );
  }

  // ---------- Desplegable combinado de reparto (persona / actor con kardex) ----------

  /** Personas + actores con kardex ABIERTO, en una sola lista para el
   *  autocomplete de cada fila de reparto. */
  destinatariosKardex(): DestinatarioKardex[] {
    const dePersonas: DestinatarioKardex[] = this.personas().map((p) => {
      const nombre = this.nombreCompleto(p);
      return {
        tipo: 'PERSONAL',
        id: String(p.id),
        label: `${nombre} — ${p.numeroDocumento}`,
        buscar: `${nombre} ${p.numeroDocumento}`.toLowerCase(),
      };
    });
    const deActores: DestinatarioKardex[] = this.actores().map((a) => ({
      tipo: 'ACTOR',
      id: String(a.id),
      label: `${a.nombre} · actor productivo`,
      buscar: `${a.nombre} actor productivo`.toLowerCase(),
    }));
    const deClientes: DestinatarioKardex[] = this.clientes().map((c) => ({
      tipo: 'CLIENTE',
      id: String(c.id),
      label: `${c.nombre} · cliente`,
      buscar: `${c.nombre} cliente`.toLowerCase(),
    }));
    return [...dePersonas, ...deActores, ...deClientes];
  }

  displayDestinatario = (v: DestinatarioControlValue): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.label;
  };

  destinatariosFiltrados(fila: AbstractControl): DestinatarioKardex[] {
    const v = (fila as FormGroup).controls['destinatario']
      .value as DestinatarioControlValue;
    const texto = (typeof v === 'string' ? v : v ? v.label : '')
      .trim()
      .toLowerCase();
    const lista = this.destinatariosKardex();
    if (!texto) return lista.slice(0, 50);
    return lista.filter((d) => d.buscar.includes(texto)).slice(0, 50);
  }

  // ---------- Forma de pago bancaria ----------

  private formaPagoSeleccionada(): FormaPago | undefined {
    const id = this.f.idFormaPago.value;
    return id == null ? undefined : this.formasPago().find((fp) => fp.id === id);
  }

  /** true cuando la forma de pago elegida exige cuenta bancaria + comprobante
   *  (todo lo que no sea efectivo ni un movimiento interno). */
  get requiereCuentaBancaria(): boolean {
    const fp = this.formaPagoSeleccionada();
    return (
      !!fp &&
      fp.afectaFondo !== false &&
      !this.CODIGOS_SIN_BANCO.has((fp.codigo ?? '').toUpperCase())
    );
  }

  /** Los campos de banco se piden apenas se elige una forma de pago bancaria,
   *  en cualquier modo — el back ya exige idCuentaBancaria/nroComprobante
   *  desde el BORRADOR (GENERAR), no solo al procesar. */
  get mostrarCamposBanco(): boolean {
    return this.requiereCuentaBancaria;
  }

  private sincronizarCamposBanco(): void {
    const { idCuentaBancaria, nroComprobante } = this.f;
    if (this.mostrarCamposBanco) {
      idCuentaBancaria.setValidators([Validators.required]);
      nroComprobante.setValidators([
        Validators.required,
        Validators.maxLength(30),
      ]);
    } else {
      idCuentaBancaria.clearValidators();
      nroComprobante.clearValidators();
      if (!this.requiereCuentaBancaria) {
        idCuentaBancaria.setValue(null, { emitEvent: false });
        nroComprobante.setValue(null, { emitEvent: false });
      }
    }
    idCuentaBancaria.updateValueAndValidity({ emitEvent: false });
    nroComprobante.updateValueAndValidity({ emitEvent: false });
  }

  /** Cuentas activas del banco en la moneda del recibo (el back rechaza una
   *  cuenta de otra moneda). */
  cuentasDe(e: EntidadFinanciera): CuentaFinanciera[] {
    const moneda = this.moneda;
    return (e.cuentas ?? []).filter(
      (c) => c.activo !== false && c.moneda === moneda,
    );
  }

  /** Bancos con al menos una cuenta en la moneda del recibo. */
  entidadesConCuentas(): EntidadFinanciera[] {
    return this.entidadesFinancieras().filter(
      (e) => this.cuentasDe(e).length > 0,
    );
  }

  etiquetaCuenta(c: CuentaFinanciera): string {
    return `${c.numeroCuenta} · ${SIMBOLO_MONEDA[c.moneda]}${c.alias ? ` · ${c.alias}` : ''}`;
  }

  // ---------- Moneda y tipo de cambio ----------

  get moneda(): MonedaCuenta {
    return this.f.moneda.value;
  }

  get esUsd(): boolean {
    return this.moneda === 'USD';
  }

  /** "Bs" o "$us", para las etiquetas de montos del formulario. */
  get simbolo(): string {
    return SIMBOLO_MONEDA[this.moneda];
  }

  /** Recibo atado a una recepción (anticipo) o a una valorización (pago del
   *  saldo): monto fijo y solo en Bs. */
  private get montoVinculado(): boolean {
    const p = this.data.prefill;
    return !!(p?.idRecepcionMineral || p?.idValorizacionMineral);
  }

  /** Un anticipo de recepción o pago de valorización solo puede ser en Bs:
   *  sin selector de moneda. */
  get monedaBloqueada(): boolean {
    return this.montoVinculado;
  }

  private sincronizarTipoCambio(): void {
    const tc = this.f.tipoCambio;
    if (this.esUsd) {
      tc.setValidators([
        Validators.required,
        tipoCambioCuatroDecimales,
        Validators.min(0.0001),
      ]);
    } else {
      tc.clearValidators();
      if (tc.enabled) tc.setValue(null, { emitEvent: false });
    }
    tc.updateValueAndValidity({ emitEvent: false });
  }

  tipoCambio(): number {
    const v = Number(this.f.tipoCambio.value);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  /** Equivalente en Bs del monto total (solo USD con T.C. válido). */
  equivalenteBs(): number {
    return this.redondear(this.montoTotal() * this.tipoCambio());
  }

  // ---------- Filas de detalle ----------

  private crearFilaDetalle(): FormGroup {
    return new FormGroup({
      destinatario: new FormControl<DestinatarioControlValue>(null, [
        Validators.required,
      ]),
      destinoGasto: new FormControl<DestinoGastoControlValue>(null, [
        Validators.required,
      ]),
      monto: new FormControl<number | null>(null, [
        Validators.required,
        montoDosDecimales,
        Validators.min(0.01),
      ]),
    });
  }

  agregarFila(): void {
    this.detalles.push(this.crearFilaDetalle());
  }

  quitarFila(index: number): void {
    this.detalles.removeAt(index);
  }

  montoTotal(): number {
    const v = Number(this.form.controls.montoTotal.value);
    return Number.isFinite(v) && v > 0 ? this.redondear(v) : 0;
  }

  sumaKardex(): number {
    return this.redondear(
      this.detalles.controls.reduce((acc, fila) => {
        const monto = Number((fila as FormGroup).getRawValue().monto);
        return acc + (Number.isFinite(monto) ? monto : 0);
      }, 0),
    );
  }

  /** Resto que va como efectivo a caja: monto total − reparto a kardex. */
  montoEfectivo(): number {
    return this.redondear(this.montoTotal() - this.sumaKardex());
  }

  excedeTotal(): boolean {
    return this.sumaKardex() - this.montoTotal() > 0.005;
  }

  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // ---------- Autocomplete de personas ----------

  nombreCompleto(p: PersonaCI): string {
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  displayPersona = (valor: PersonaControlValue): string => {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    return `${this.nombreCompleto(valor)} — ${valor.numeroDocumento}`;
  };

  private filtrarPersonas(
    valor: PersonaControlValue,
    lista: PersonaCI[],
  ): PersonaCI[] {
    const texto = (
      typeof valor === 'string' ? valor : valor ? this.nombreCompleto(valor) : ''
    )
      .trim()
      .toLowerCase();
    if (!texto) return lista.slice(0, 50);
    return lista
      .filter(
        (p) =>
          this.nombreCompleto(p).toLowerCase().includes(texto) ||
          p.numeroDocumento.toLowerCase().includes(texto),
      )
      .slice(0, 50);
  }

  // ---------- Guardar ----------

  cancelar(): void {
    this.dialogRef.close();
  }

  restringirEntradaNumerica(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
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
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  /** Resuelve la contraparte del formulario o devuelve un mensaje de error. */
  private resolverContraparte(): ContraparteReciboRequest | string {
    const v = this.form.getRawValue();
    switch (v.contraparteTipo) {
      case 'ACTOR':
        return v.idActorContraparte
          ? { idActorProductivoMinero: v.idActorContraparte }
          : `Elige el actor productivo (${this.labelContraparte.toLowerCase()})`;
      case 'CLIENTE':
        return v.idClienteContraparte
          ? { idCliente: v.idClienteContraparte }
          : `Elige el cliente (${this.labelContraparte.toLowerCase()})`;
      case 'TEXTO': {
        const texto = (v.textoContraparte ?? '').trim();
        return texto
          ? { nombresApellidos: texto }
          : `Escribe a nombre de quién va el recibo (${this.labelContraparte.toLowerCase()})`;
      }
      default: {
        const p = v.personaContraparte;
        return p && typeof p === 'object'
          ? { idPersona: String(p.id) }
          : `Elige una persona registrada (${this.labelContraparte.toLowerCase()})`;
      }
    }
  }

  private validarDetalles(): string | null {
    const dg = this.labelDestinoGasto.toLowerCase();
    for (const fila of this.filas) {
      const v = fila.getRawValue() as {
        destinatario: DestinatarioControlValue;
        destinoGasto: DestinoGastoControlValue;
        monto: number | null;
      };
      if (!v.monto || v.monto <= 0) {
        return 'Cada fila de reparto necesita un monto mayor a 0';
      }
      if (!(v.destinatario && typeof v.destinatario === 'object')) {
        return 'Elige el destinatario (persona o actor con kardex) en cada fila';
      }
      if (!(v.destinoGasto && typeof v.destinoGasto === 'object')) {
        return `Elige ${dg} en cada fila de reparto`;
      }
    }
    if (this.excedeTotal()) {
      return 'El reparto a kardex supera el monto total';
    }
    if (this.montoEfectivo() > 0) {
      const e = this.f.destinoGastoEfectivo.value;
      if (!(e && typeof e === 'object')) {
        return `Elige ${dg} para la porción de efectivo`;
      }
    }
    return null;
  }

  /** Contraparte registrada del recibo (persona o actor), para estampar en la
   *  línea EFECTIVO: es a quién se le entrega / de quién se recibe el efectivo.
   *  En borrador viene fija del recibo; en alta directa, del `contraparte` ya
   *  resuelto. Vacío si la contraparte es texto libre. */
  private contraparteEfectivo(contraparte?: ContraparteReciboRequest): {
    idPersona?: string;
    idActorProductivoMinero?: string;
    idCliente?: string;
  } {
    const src: ContraparteReciboRequest = this.esBorrador
      ? {
          idPersona: this.data.recibo!.idPersona ?? undefined,
          idActorProductivoMinero:
            this.data.recibo!.idActorProductivoMinero ?? undefined,
          idCliente: this.data.recibo!.idCliente ?? undefined,
        }
      : (contraparte ?? {});
    if (src.idPersona) return { idPersona: String(src.idPersona) };
    if (src.idActorProductivoMinero) {
      return { idActorProductivoMinero: String(src.idActorProductivoMinero) };
    }
    if (src.idCliente) return { idCliente: String(src.idCliente) };
    return {};
  }

  /** Filas de reparto + fila EFECTIVO por el resto (si > 0). El destino del
   *  gasto viaja dentro de cada línea (`idDestinoGasto`); la línea EFECTIVO
   *  además lleva la contraparte (a quién se le entrega el efectivo). */
  private construirDetalles(
    cpEfectivo: {
      idPersona?: string;
      idActorProductivoMinero?: string;
      idCliente?: string;
    } = {},
  ): DetalleReciboRequest[] {
    const detalles: DetalleReciboRequest[] = this.filas.map((fila) => {
      const fv = fila.getRawValue() as {
        destinatario: DestinatarioKardex;
        destinoGasto: DestinoGasto;
        monto: number | null;
      };
      const linea: DetalleReciboRequest = {
        destino: fv.destinatario.tipo,
        monto: this.redondear(Number(fv.monto)),
        idDestinoGasto: fv.destinoGasto.id,
      };
      if (fv.destinatario.tipo === 'PERSONAL') linea.idPersona = fv.destinatario.id;
      else if (fv.destinatario.tipo === 'ACTOR') linea.idActorProductivoMinero = fv.destinatario.id;
      else linea.idCliente = fv.destinatario.id;
      if (this.data.prefill?.lote) linea.lote = this.data.prefill.lote;
      return linea;
    });
    const efectivo = this.montoEfectivo();
    if (efectivo > 0) {
      const linea: DetalleReciboRequest = {
        destino: 'EFECTIVO',
        monto: efectivo,
        ...cpEfectivo,
      };
      const e = this.f.destinoGastoEfectivo.value;
      if (e && typeof e === 'object') linea.idDestinoGasto = e.id;
      detalles.push(linea);
    }
    return detalles;
  }





  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.filas.forEach((fila) => fila.markAllAsTouched());
      return;
    }
    if (this.pideDetalles) {
      const errorDetalles = this.validarDetalles();
      if (errorDetalles) {
        this.snackBar.open(errorDetalles, 'Cerrar', { duration: 4000 });
        return;
      }
    }


    

    const v = this.form.getRawValue();
    let request: GenerarReciboRequest | ProcesarReciboRequest;

    if (this.esBorrador) {
      const proc: ProcesarReciboRequest = {
        detalles: this.construirDetalles(this.contraparteEfectivo()),
      };
      if (v.idFormaPago) proc.idFormaPago = v.idFormaPago;
      if (this.mostrarCamposBanco) {
        proc.idCuentaBancaria = v.idCuentaBancaria!;
        proc.nroComprobante = (v.nroComprobante ?? '').trim();
      }
      request = proc;
    } else {
      const contraparte = this.resolverContraparte();
      if (typeof contraparte === 'string') {
        this.snackBar.open(contraparte, 'Cerrar', { duration: 5000 });
        return;
      }
      const gen: GenerarReciboRequest = {
        tipo: this.data.tipo,
        fecha: this.formatFecha(v.fecha!),
        montoTotal: this.montoTotal(),
        concepto: v.concepto!.trim(),
        idPersonaAutorizo: v.idPersonaAutorizo!,
        idFormaPago: v.idFormaPago!,
        moneda: v.moneda,
        ...contraparte,
      };
      if (v.moneda === 'USD') gen.tipoCambio = Number(v.tipoCambio);
      if (this.data.prefill?.idRecepcionMineral) {
        gen.idRecepcionMineral = this.data.prefill.idRecepcionMineral;
      }
      if (this.data.prefill?.idValorizacionMineral) {
        gen.idValorizacionMineral = this.data.prefill.idValorizacionMineral;
      }
      if (this.data.prefill?.idVentaLote) {
        gen.idVentaLote = this.data.prefill.idVentaLote;
      }
      if (this.mostrarCamposBanco) {
        gen.idCuentaBancaria = v.idCuentaBancaria!;
        gen.nroComprobante = (v.nroComprobante ?? '').trim();
      }
      // 'PROCESAR' directo → one-shot con detalles (queda PROCESADO).
      if (this.pideDetalles) {
        gen.detalles = this.construirDetalles(
          this.contraparteEfectivo(contraparte),
        );
      }
      request = gen;
    }

    // DEBUG: payload que se envía al backend en cada caso.
    console.log('[recibo] guardar', {
      modo: this.data.modo,
      esBorrador: this.esBorrador,
      pideDetalles: this.pideDetalles,
      endpoint: this.esBorrador
        ? `PATCH /contabilidad/recibo/${this.data.recibo!.id}/procesar`
        : 'POST /contabilidad/recibo',
      request,
    });
    console.log('[recibo] request JSON', JSON.stringify(request, null, 2));

    this.guardando.set(true);
    const envio = this.esBorrador
      ? this.reciboService.procesar(
          this.data.recibo!.id,
          request as ProcesarReciboRequest,
        )
      : this.reciboService.generar(request as GenerarReciboRequest);
    envio.subscribe({
      next: (recibo) => {
        this.guardando.set(false);
        this.snackBar.open(this.mensajeExito(), 'Cerrar', { duration: 3000 });
        this.dialogRef.close(recibo ?? true);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo guardar el recibo',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  private mensajeExito(): string {
    if (this.esGenerar) return 'Recibo generado (borrador)';
    return this.esIngreso ? 'Ingreso procesado' : 'Egreso procesado';
  }

  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /** Hoy a medianoche (fecha contable, sin hora). */
  private hoy(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }
}
