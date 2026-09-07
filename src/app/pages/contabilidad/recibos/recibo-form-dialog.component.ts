// src/app/pages/contabilidad/recibos/recibo-form-dialog.component.ts
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
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
} from '../../configurations/models/persona.models';
import {
  CuentaFinanciera,
  DestinoGasto,
  EntidadFinanciera,
  FormaPago,
} from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import { PersonaService } from '../../configurations/services/persona.service';
import {
  ContraparteReciboRequest,
  DestinoDetalleRecibo,
  DetalleReciboRequest,
  GenerarReciboRequest,
  ProcesarReciboRequest,
  Recibo,
  TipoRecibo,
} from '../models/recibo.models';
import { ReciboService } from '../services/recibo.service';

export type ReciboFormModo = 'GENERAR' | 'PROCESAR';

export interface ReciboFormDialogData {
  tipo: TipoRecibo;
  modo: ReciboFormModo;
  /** Solo en modo 'PROCESAR': el BORRADOR que se está procesando. */
  recibo?: Recibo;
}

/** El control puede tener una PersonaCI recién elegida del autocomplete,
 *  texto suelto tecleado (inválido al guardar), o nada. */
type PersonaControlValue = PersonaCI | string | null;

type ContraparteTipo = 'PERSONA' | 'ACTOR' | 'TEXTO';

/** El autocomplete de destino de gasto guarda el objeto elegido, o el texto
 *  suelto mientras se escribe (se ignora al guardar si no coincide). */
type DestinoGastoControlValue = DestinoGasto | string | null;

/** Las filas del formulario son solo reparto a kardex; el efectivo es el
 *  resto calculado (monto total − suma de filas) y no se teclea. */
type DestinoFila = Exclude<DestinoDetalleRecibo, 'EFECTIVO'>;

interface FilaDetalleValue {
  destino: DestinoFila;
  persona: PersonaControlValue;
  idActorProductivoMinero: string | null;
  monto: number | null;
}

@Component({
  selector: 'app-recibo-form-dialog',
  standalone: true,
  imports: [
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
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ],
  templateUrl: './recibo-form-dialog.component.html',
  styleUrl: './recibo-form-dialog.component.scss',
})
export class ReciboFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ReciboFormDialogComponent>);
  readonly data = inject<ReciboFormDialogData>(MAT_DIALOG_DATA);
  private readonly reciboService = inject(ReciboService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly formasPago = signal<FormaPago[]>([]);
  readonly destinosGasto = signal<DestinoGasto[]>([]);
  readonly personas = signal<PersonaCI[]>([]);
  readonly actores = signal<ActorProductivoMinero[]>([]);
  readonly entidadesFinancieras = signal<EntidadFinanciera[]>([]);

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
    fecha: new FormControl<Date | null>(new Date(), [Validators.required]),
    montoTotal: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    // Forma de pago: obligatoria en los dos modos.
    idFormaPago: new FormControl<number | null>(null, [Validators.required]),
    // Solo aplican con forma de pago bancaria; validadores dinámicos.
    idCuentaBancaria: new FormControl<number | null>(null),
    nroComprobante: new FormControl<string | null>(null),
    destinoGasto: new FormControl<DestinoGastoControlValue>(null),
    // Contraparte "Recibí de / Entregué a": una de las tres.
    contraparteTipo: new FormControl<ContraparteTipo>('PERSONA'),
    personaContraparte: new FormControl<PersonaControlValue>(null),
    idActorContraparte: new FormControl<string | null>(null),
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
    // Al cambiar el tipo de contraparte, se limpia lo que ya no aplica.
    this.f.contraparteTipo.valueChanges.subscribe(() => {
      this.f.personaContraparte.setValue(null, { emitEvent: false });
      this.f.idActorContraparte.setValue(null, { emitEvent: false });
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
      entidadesFinancieras:
        this.parametricasService.obtenerEntidadesFinancieras(),
    }).subscribe({
      next: ({
        formasPago,
        destinosGasto,
        personas,
        actores,
        entidadesFinancieras,
      }) => {
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
        this.destinosGasto.set(
          destinosGasto.filter((d) => d.activo !== false),
        );
        this.personas.set(personas.data ?? []);
        this.actores.set(actores ?? []);
        this.entidadesFinancieras.set(
          (entidadesFinancieras ?? []).filter((e) => e.activo !== false),
        );
        this.cargandoCatalogos.set(false);
        if (this.data.recibo) this.prefillDesdeBorrador(this.data.recibo);
        this.sincronizarCamposBanco();
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  /** Carga la cabecera del BORRADOR y bloquea los campos que no se pueden
   *  corregir al procesar (fecha, monto, concepto, contraparte). */
  private prefillDesdeBorrador(r: Recibo): void {
    const destinoGasto =
      r.destinoGasto ??
      this.destinosGasto().find((d) => d.id === r.idDestinoGasto) ??
      null;
    this.form.patchValue({
      fecha: this.parseFecha(r.fecha),
      montoTotal: Number(r.montoTotal),
      concepto: r.concepto ?? '',
      idFormaPago: r.idFormaPago ?? null,
      idCuentaBancaria: r.idCuentaBancaria ?? null,
      nroComprobante: r.nroComprobante ?? null,
      destinoGasto,
    });
    for (const nombre of [
      'fecha',
      'montoTotal',
      'concepto',
      'contraparteTipo',
      'personaContraparte',
      'idActorContraparte',
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
    return r.nombresApellidos || '—';
  }

  codigoRecibo(r: Recibo): string {
    return `${r.serie}-${String(r.numero).padStart(4, '0')}`;
  }

  num(v: string | number | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Destinos de gasto que aplican a este recibo: `esEgreso` según el tipo. */
  get destinosGastoFiltrados(): DestinoGasto[] {
    const quiero = this.data.tipo === 'EGRESO';
    return this.destinosGasto().filter((d) => d.esEgreso === quiero);
  }

  displayDestinoGasto = (v: DestinoGastoControlValue): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.nombre;
  };

  /** Opciones del autocomplete de destino de gasto según lo tecleado. */
  destinosGastoAutocomplete(): DestinoGasto[] {
    const v = this.f.destinoGasto.value;
    const texto = (typeof v === 'string' ? v : v ? v.nombre : '')
      .trim()
      .toLowerCase();
    const lista = this.destinosGastoFiltrados;
    if (!texto) return lista;
    return lista.filter((d) => d.nombre.toLowerCase().includes(texto));
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

  /** Los campos de banco solo se piden al procesar (en 'GENERAR' es el 2º paso). */
  get mostrarCamposBanco(): boolean {
    return this.pideDetalles && this.requiereCuentaBancaria;
  }

  private sincronizarCamposBanco(): void {
    const { idCuentaBancaria, nroComprobante } = this.f;
    if (this.mostrarCamposBanco) {
      idCuentaBancaria.setValidators([Validators.required]);
      nroComprobante.setValidators([
        Validators.required,
        Validators.maxLength(50),
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

  cuentasDe(e: EntidadFinanciera): CuentaFinanciera[] {
    return (e.cuentas ?? []).filter((c) => c.activo !== false);
  }

  etiquetaCuenta(c: CuentaFinanciera): string {
    return `${c.numeroCuenta} · ${c.moneda}${c.alias ? ` · ${c.alias}` : ''}`;
  }

  // ---------- Filas de detalle ----------

  private crearFilaDetalle(): FormGroup {
    const fila = new FormGroup({
      destino: new FormControl<DestinoFila>('PERSONAL', [Validators.required]),
      persona: new FormControl<PersonaControlValue>(null),
      idActorProductivoMinero: new FormControl<string | null>(null),
      monto: new FormControl<number | null>(null, [
        Validators.required,
        Validators.min(0.01),
      ]),
    });
    fila.controls.destino.valueChanges.subscribe(() => {
      fila.controls.persona.setValue(null, { emitEvent: false });
      fila.controls.idActorProductivoMinero.setValue(null, {
        emitEvent: false,
      });
    });
    return fila;
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

  personasFiltradasFila(fila: AbstractControl): PersonaCI[] {
    const valor = (fila as FormGroup).controls[
      'persona'
    ].value as PersonaControlValue;
    return this.filtrarPersonas(valor, this.personas());
  }

  // ---------- Guardar ----------

  cancelar(): void {
    this.dialogRef.close();
  }

  /** Resuelve la contraparte del formulario o devuelve un mensaje de error. */
  private resolverContraparte(): ContraparteReciboRequest | string {
    const v = this.form.getRawValue();
    switch (v.contraparteTipo) {
      case 'ACTOR':
        return v.idActorContraparte
          ? { idActorProductivoMinero: v.idActorContraparte }
          : `Elige el actor productivo (${this.labelContraparte.toLowerCase()})`;
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
    for (const fila of this.filas) {
      const v = fila.getRawValue() as FilaDetalleValue;
      if (!v.monto || v.monto <= 0) {
        return 'Cada fila de reparto necesita un monto mayor a 0';
      }
      if (
        v.destino === 'PERSONAL' &&
        !(v.persona && typeof v.persona === 'object')
      ) {
        return 'Elige una persona registrada en cada fila con destino Persona';
      }
      if (v.destino === 'ACTOR' && !v.idActorProductivoMinero) {
        return 'Elige un actor productivo en cada fila con destino Actor';
      }
    }
    if (this.excedeTotal()) {
      return 'El reparto a kardex supera el monto total';
    }
    return null;
  }

  /** Filas de reparto + fila EFECTIVO por el resto (si > 0). */
  private construirDetalles(): DetalleReciboRequest[] {
    const detalles: DetalleReciboRequest[] = this.filas.map((fila) => {
      const fv = fila.getRawValue() as FilaDetalleValue;
      if (fv.destino === 'PERSONAL') {
        return {
          destino: 'PERSONAL',
          idPersona: String((fv.persona as PersonaCI).id),
          monto: this.redondear(Number(fv.monto)),
        };
      }
      return {
        destino: 'ACTOR',
        idActorProductivoMinero: fv.idActorProductivoMinero!,
        monto: this.redondear(Number(fv.monto)),
      };
    });
    const efectivo = this.montoEfectivo();
    if (efectivo > 0) detalles.push({ destino: 'EFECTIVO', monto: efectivo });
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
    // Solo se envía el destino de gasto si se eligió una opción del catálogo
    // (texto suelto que no coincide se ignora).
    const idDestinoGasto =
      v.destinoGasto && typeof v.destinoGasto === 'object'
        ? v.destinoGasto.id
        : undefined;
    let request: GenerarReciboRequest | ProcesarReciboRequest;

    if (this.esBorrador) {
      const proc: ProcesarReciboRequest = { detalles: this.construirDetalles() };
      if (v.idFormaPago) proc.idFormaPago = v.idFormaPago;
      if (idDestinoGasto) proc.idDestinoGasto = idDestinoGasto;
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
        idFormaPago: v.idFormaPago!,
        ...contraparte,
      };
      if (idDestinoGasto) gen.idDestinoGasto = idDestinoGasto;
      if (this.mostrarCamposBanco) {
        gen.idCuentaBancaria = v.idCuentaBancaria!;
        gen.nroComprobante = (v.nroComprobante ?? '').trim();
      }
      // 'PROCESAR' directo → one-shot con detalles (queda PROCESADO).
      if (this.pideDetalles) gen.detalles = this.construirDetalles();
      request = gen;
    }

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

  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }
}
