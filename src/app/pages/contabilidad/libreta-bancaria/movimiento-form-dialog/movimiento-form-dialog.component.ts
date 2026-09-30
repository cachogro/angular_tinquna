// src/app/pages/contabilidad/libreta-bancaria/movimiento-form-dialog/movimiento-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
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
import { combineLatest, map, Observable, startWith } from 'rxjs';
import {
  ActorProductivoMinero,
  PersonaCI,
} from '../../../configurations/models/persona.models';
import { PersonaService } from '../../../configurations/services/persona.service';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import {
  Cliente,
  FormaPago,
} from '../../../configurations/parametricas/models/parametricas.models';
import {
  GuardarMovimientoBancoRequest,
  MovimientoBanco,
  PersonaMovimientoRef,
  TipoMovimientoBanco,
} from '../../models/libreta-banco.models';
import { LibretaBancoService } from '../../services/libreta-banco.service';
import { ReciboService } from '../../services/recibo.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

export interface MovimientoFormDialogData {
  idCuentaBancaria: number;
  movimiento?: MovimientoBanco | null;
  /** "YYYY-MM-DD" a proponer cuando se crea desde un mes filtrado. */
  fechaSugerida?: string;
}

type Beneficiario = PersonaCI | PersonaMovimientoRef | string | null;

/** Mismo selector de contraparte que "Recibí de / Entregué a" del recibo. */
type ContraparteTipo = 'PERSONA' | 'ACTOR' | 'CLIENTE' | 'TEXTO';

@Component({
  selector: 'app-movimiento-form-dialog',
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
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './movimiento-form-dialog.component.html',
  styleUrl: './movimiento-form-dialog.component.scss',
})
export class MovimientoFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<MovimientoFormDialogComponent>,
  );
  private readonly data = inject<MovimientoFormDialogData>(MAT_DIALOG_DATA);
  private readonly libretaService = inject(LibretaBancoService);
  private readonly personaService = inject(PersonaService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly reciboService = inject(ReciboService);
  private readonly snackBar = inject(MatSnackBar);

  readonly guardando = signal(false);
  readonly personas = signal<PersonaCI[]>([]);
  /** Sugerencias de concepto: destinos de gasto + conceptos de recibos procesados. */
  readonly sugerenciasConcepto = signal<string[]>([]);
  /** Mismo catálogo de "Forma de pago" que usa Recibos, reutilizado acá como
   *  "Tipo de transacción" (el back no valida contra ningún catálogo, pero
   *  el front sí ofrece opciones fijas en vez de texto libre). */
  readonly formasPago = signal<FormaPago[]>([]);
  readonly actores = signal<ActorProductivoMinero[]>([]);
  readonly clientes = signal<Cliente[]>([]);

  /** Tipos de transacción del banco: sin EFECTIVO (el efectivo no pasa por
   *  la libreta). Si un movimiento viejo ya lo tenía, se conserva al editar
   *  para no dejar el campo vacío. */
  readonly tiposTransaccion = computed(() => {
    const actual = this.data.movimiento?.tipoTransaccion?.toUpperCase();
    return this.formasPago().filter((fp) => {
      const esEfectivo =
        (fp.codigo ?? '').toUpperCase() === 'EFECTIVO' ||
        (fp.nombre ?? '').toUpperCase() === 'EFECTIVO';
      return !esEfectivo || fp.nombre.toUpperCase() === actual;
    });
  });

  get esEdicion(): boolean {
    return !!this.data.movimiento;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    tipo: new FormControl<TipoMovimientoBanco | null>(null, [
      Validators.required,
    ]),
    monto: new FormControl<number | string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    concepto: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    tipoTransaccion: new FormControl<string | null>(null, [Validators.required]),
    nroTransaccion: new FormControl('', [Validators.maxLength(30)]),
    facturaRecibo: new FormControl('', [Validators.maxLength(30)]),
    // Beneficiario ("Nombres y apellidos"): una de persona / actor / cliente
    // / texto libre, como la contraparte del recibo.
    contraparteTipo: new FormControl<ContraparteTipo>('PERSONA'),
    personaContraparte: new FormControl<Beneficiario>(null),
    idActorContraparte: new FormControl<string | null>(null),
    idClienteContraparte: new FormControl<string | null>(null),
    textoContraparte: new FormControl<string | null>(null, [Validators.maxLength(255)]),
  });

  get f() {
    return this.form.controls;
  }

  get contraparteTipo(): ContraparteTipo {
    return this.f.contraparteTipo.value ?? 'PERSONA';
  }

  /** Lista de personas filtrada según lo tecleado en el autocomplete. */
  readonly personasFiltradas$: Observable<PersonaCI[]> = combineLatest([
    this.form.controls.personaContraparte.valueChanges.pipe(startWith('')),
    toObservable(this.personas),
  ]).pipe(map(([valor, lista]) => this.filtrarPersonas(valor, lista)));

  /** Sugerencias de concepto filtradas según lo tecleado; si no coincide con
   *  ninguna, se guarda el texto libre igual que antes. */
  readonly conceptoSugerido$: Observable<string[]> = combineLatest([
    this.form.controls.concepto.valueChanges.pipe(startWith('')),
    toObservable(this.sugerenciasConcepto),
  ]).pipe(
    map(([valor, lista]) => {
      const texto = (valor ?? '').trim().toLowerCase();
      const filtradas = texto
        ? lista.filter((s) => s.toLowerCase().includes(texto))
        : lista;
      return filtradas.slice(0, 50);
    }),
  );

  ngOnInit(): void {
    // Concepto siempre en mayúsculas.
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });
    // Beneficiario externo (texto libre) siempre en mayúsculas.
    this.f.textoContraparte.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.textoContraparte.setValue(up, { emitEvent: false });
    });
    // Al cambiar el tipo de beneficiario, se limpia lo que ya no aplica.
    this.f.contraparteTipo.valueChanges.subscribe(() => {
      this.f.personaContraparte.setValue(null, { emitEvent: false });
      this.f.idActorContraparte.setValue(null, { emitEvent: false });
      this.f.idClienteContraparte.setValue(null, { emitEvent: false });
      this.f.textoContraparte.setValue(null, { emitEvent: false });
    });

    this.personaService.getAllActoresMineros().subscribe({
      next: (data) => this.actores.set(data ?? []),
      error: () => this.actores.set([]),
    });
    this.parametricasService.getAllClientes().subscribe({
      next: (data) => this.clientes.set(data ?? []),
      error: () => this.clientes.set([]),
    });

    this.personaService
      .listarPersonas({ page: 1, limit: 1000, activo: true })
      .subscribe({
        next: (res) => this.personas.set(res.data ?? []),
        error: () => this.personas.set([]),
      });

    this.cargarSugerenciasConcepto();

    this.parametricasService.obtenerFormasPago().subscribe({
      next: (data) => this.formasPago.set(data.filter((fp) => fp.activo !== false)),
      error: () => this.formasPago.set([]),
    });

    const m = this.data.movimiento;
    if (m) {
      const debe = Number(m.debe);
      this.form.patchValue({
        fecha: this.parseFecha(m.fecha),
        tipo: debe > 0 ? 'DEBE' : 'HABER',
        monto: debe > 0 ? debe : Number(m.haber),
        concepto: m.concepto,
        tipoTransaccion: m.tipoTransaccion ?? null,
        nroTransaccion: m.nroTransaccion ?? '',
        facturaRecibo: m.facturaRecibo ?? '',
      });
      this.precargarContraparte(m);
    } else if (this.data.fechaSugerida) {
      this.form.controls.fecha.setValue(this.parseFecha(this.data.fechaSugerida));
    }
  }

  // ---------- Autocomplete concepto ----------

  /** Junta el catálogo de destino de gasto con los conceptos de recibos ya
   *  procesados, como sugerencias; el campo sigue siendo texto libre. */
  private cargarSugerenciasConcepto(): void {
    combineLatest([
      this.parametricasService.obtenerDestinosGasto(),
      this.reciboService.listar({ estado: 'PROCESADO', limit: 500 }),
    ]).subscribe({
      next: ([destinos, recibos]) => {
        const set = new Set<string>();
        for (const d of destinos) {
          if (d.activo === false) continue;
          const nombre = d.nombre?.trim();
          if (nombre) set.add(nombre);
        }
        for (const r of recibos.data ?? []) {
          const concepto = r.concepto?.trim();
          if (concepto) set.add(concepto);
        }
        this.sugerenciasConcepto.set([...set].sort((a, b) => a.localeCompare(b)));
      },
      error: () => this.sugerenciasConcepto.set([]),
    });
  }

  // ---------- Beneficiario (contraparte) ----------

  /** En edición: elige el tipo según lo que ya tiene el movimiento. */
  private precargarContraparte(m: MovimientoBanco): void {
    const opts = { emitEvent: false };
    if (m.idActorProductivoMinero || m.actorProductivoMinero) {
      this.f.contraparteTipo.setValue('ACTOR', opts);
      this.f.idActorContraparte.setValue(
        String(m.idActorProductivoMinero ?? m.actorProductivoMinero?.id),
        opts,
      );
    } else if (m.idCliente || m.cliente) {
      this.f.contraparteTipo.setValue('CLIENTE', opts);
      this.f.idClienteContraparte.setValue(
        String(m.idCliente ?? m.cliente?.id),
        opts,
      );
    } else if (m.persona) {
      this.f.contraparteTipo.setValue('PERSONA', opts);
      this.f.personaContraparte.setValue(m.persona, opts);
    } else if (m.nombresApellidos) {
      this.f.contraparteTipo.setValue('TEXTO', opts);
      this.f.textoContraparte.setValue(m.nombresApellidos, opts);
    }
  }

  /** Arma la parte de beneficiario del request, o un mensaje de error. Es
   *  opcional: sin nada elegido se guarda sin beneficiario. */
  private resolverContraparte():
    | Pick<
        GuardarMovimientoBancoRequest,
        'idPersona' | 'idActorProductivoMinero' | 'idCliente' | 'nombresApellidos'
      >
    | string {
    const v = this.form.getRawValue();
    switch (v.contraparteTipo) {
      case 'ACTOR': {
        const a = this.actores().find((x) => String(x.id) === String(v.idActorContraparte));
        return v.idActorContraparte
          ? { idActorProductivoMinero: String(v.idActorContraparte), nombresApellidos: a?.nombre?.toUpperCase() }
          : {};
      }
      case 'CLIENTE': {
        const c = this.clientes().find((x) => String(x.id) === String(v.idClienteContraparte));
        return v.idClienteContraparte
          ? { idCliente: String(v.idClienteContraparte), nombresApellidos: c?.nombre?.toUpperCase() }
          : {};
      }
      case 'TEXTO': {
        const texto = (v.textoContraparte ?? '').trim();
        return texto ? { nombresApellidos: texto } : {};
      }
      default: {
        const p = v.personaContraparte;
        if (p && typeof p === 'object' && 'id' in p) {
          return { idPersona: String(p.id), nombresApellidos: this.nombreCompleto(p) };
        }
        if (typeof p === 'string' && p.trim()) {
          return 'Elige la persona de la lista, o usa "Otro (Externo)" para escribir el nombre';
        }
        return {};
      }
    }
  }

  // ---------- Autocomplete persona ----------

  nombreCompleto(
    p: PersonaCI | PersonaMovimientoRef,
  ): string {
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  displayBeneficiario = (valor: Beneficiario): string => {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    const doc = (valor as PersonaCI).numeroDocumento;
    return doc
      ? `${this.nombreCompleto(valor)} — ${doc}`
      : this.nombreCompleto(valor);
  };

  private filtrarPersonas(
    valor: Beneficiario,
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
          (p.numeroDocumento ?? '').toLowerCase().includes(texto),
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

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const contraparte = this.resolverContraparte();
    if (typeof contraparte === 'string') {
      this.snackBar.open(contraparte, 'Cerrar', { duration: 4000 });
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();

    const request: GuardarMovimientoBancoRequest = {
      ...(this.data.movimiento ? { id: this.data.movimiento.id } : {}),
      idCuentaBancaria: this.data.idCuentaBancaria,
      fecha: this.formatFecha(v.fecha!),
      concepto: v.concepto!.trim(),
      tipoTransaccion: v.tipoTransaccion!,
      tipo: v.tipo!,
      monto: Number(v.monto),
    };

    const nroTransaccion = (v.nroTransaccion ?? '').trim();
    if (nroTransaccion) request.nroTransaccion = nroTransaccion;

    // En edición se manda siempre (vacío = borrarla): si se omite, el back
    // conserva la que ya tenía.
    const facturaRecibo = (v.facturaRecibo ?? '').trim();
    if (facturaRecibo || this.esEdicion) request.facturaRecibo = facturaRecibo;

    // Sin vínculo mandado, el back deja persona/actor/cliente en null (en
    // edición eso limpia el vínculo anterior).
    Object.assign(request, contraparte);

    this.libretaService.guardarMovimiento(request).subscribe({
      next: (movimiento) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion ? 'Movimiento actualizado' : 'Movimiento registrado',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(movimiento ?? true);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo guardar el movimiento',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
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
