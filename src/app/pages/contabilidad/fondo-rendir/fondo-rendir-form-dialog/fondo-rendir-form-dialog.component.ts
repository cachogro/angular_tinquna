// src/app/pages/contabilidad/fondo-rendir/fondo-rendir-form-dialog/fondo-rendir-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { combineLatest, forkJoin, map, Observable, startWith } from 'rxjs';
import {
  ActorProductivoMinero,
  PersonaCI,
} from '../../../configurations/models/persona.models';
import {
  DestinoGasto,
  FormaPago,
  MonedaCuentaBancaria,
  etiquetaMonedaCuenta,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { PersonaService } from '../../../configurations/services/persona.service';
import { EntregarFondoRendirRequest } from '../../models/fondo-rendir.models';
import { FondoRendirService } from '../../services/fondo-rendir.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

type DestinatarioTipo = 'PERSONA' | 'ACTOR';

/** Actor de la propia empresa (TINKURIKUNA): no es destinatario de fondos. */
const ID_ACTOR_EMPRESA = '1';

/** N° de comprobante: solo dígitos y . - _ / */type PersonaControlValue = PersonaCI | string | null;

interface CuentaOpcion {
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuentaBancaria;
  nombreEntidad: string;
  activo: boolean;
}

@Component({
  selector: 'app-fondo-rendir-form-dialog',
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
  templateUrl: './fondo-rendir-form-dialog.component.html',
  styleUrl: './fondo-rendir-form-dialog.component.scss',
})
export class FondoRendirFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<FondoRendirFormDialogComponent>,
  );
  private readonly fondoRendirService = inject(FondoRendirService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly personas = signal<PersonaCI[]>([]);
  readonly actores = signal<ActorProductivoMinero[]>([]);
  readonly formasPago = signal<FormaPago[]>([]);
  readonly destinosGasto = signal<DestinoGasto[]>([]);
  readonly cuentas = signal<CuentaOpcion[]>([]);
  readonly personasAutorizadas = signal<PersonaCI[]>([]);

  readonly form = new FormGroup({
    destinatarioTipo: new FormControl<DestinatarioTipo>('PERSONA', {
      nonNullable: true,
    }),
    personaDestinatario: new FormControl<PersonaControlValue>(null),
    idActorDestinatario: new FormControl<string | null>(null),
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    monto: new FormControl<string | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.pattern(/^\d+(\.\d+)?$/),
      Validators.min(0.01),
    ]),
    idFormaPago: new FormControl<number | null>(null, [Validators.required]),
    idCuentaBancaria: new FormControl<number | null>(null),
    nroComprobante: new FormControl('', [
      Validators.maxLength(30),
    ]),
    idDestinoGasto: new FormControl<number | null>(null),
    idPersonaAutorizo: new FormControl<string | null>(null, [
      Validators.required,
    ]),
    fechaLimite: new FormControl<Date | null>(null),
  });

  get f() {
    return this.form.controls;
  }

  get destinatarioTipo(): DestinatarioTipo {
    return this.f.destinatarioTipo.value;
  }

  /** Formas de pago que no pasan por banco: se entregan de la caja de flujo. */
  private readonly CODIGOS_SIN_BANCO = new Set(['EFECTIVO']);

  private formaPagoSeleccionada(): FormaPago | undefined {
    const id = this.f.idFormaPago.value;
    return id == null ? undefined : this.formasPago().find((fp) => fp.id === id);
  }

  /** true cuando la forma de pago elegida es bancaria: el fondo sale de la
   *  libreta de esa cuenta (no de la caja) y exige cuenta + comprobante. */
  get requiereCuentaBancaria(): boolean {
    const fp = this.formaPagoSeleccionada();
    return (
      !!fp &&
      fp.afectaFondo !== false &&
      !this.CODIGOS_SIN_BANCO.has((fp.codigo ?? '').toUpperCase())
    );
  }

  private sincronizarCamposBanco(): void {
    const { idCuentaBancaria, nroComprobante } = this.f;
    if (this.requiereCuentaBancaria) {
      idCuentaBancaria.setValidators([Validators.required]);
      nroComprobante.setValidators([
        Validators.required,
        Validators.maxLength(30),
      ]);
    } else {
      idCuentaBancaria.clearValidators();
      nroComprobante.setValidators([
        Validators.maxLength(30),
      ]);
      idCuentaBancaria.setValue(null, { emitEvent: false });
      nroComprobante.setValue('', { emitEvent: false });
    }
    idCuentaBancaria.updateValueAndValidity({ emitEvent: false });
    nroComprobante.updateValueAndValidity({ emitEvent: false });
  }

  readonly personasFiltradas$: Observable<PersonaCI[]> = combineLatest([
    this.form.controls.personaDestinatario.valueChanges.pipe(startWith('')),
    toObservable(this.personas),
  ]).pipe(map(([valor, lista]) => this.filtrarPersonas(valor, lista)));

  ngOnInit(): void {
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });

    this.f.destinatarioTipo.valueChanges.subscribe(() => {
      this.f.personaDestinatario.setValue(null, { emitEvent: false });
      this.f.idActorDestinatario.setValue(null, { emitEvent: false });
    });

    this.f.idFormaPago.valueChanges.subscribe(() =>
      this.sincronizarCamposBanco(),
    );

    forkJoin({
      personas: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      }),
      actores: this.personaService.getAllActoresMineros(),
      formasPago: this.parametricasService.obtenerFormasPago(),
      destinosGasto: this.parametricasService.obtenerDestinosGasto(),
      entidades: this.parametricasService.obtenerEntidadesFinancieras(),
      personasAutorizadas: this.personaService.listarPersonasAutorizadas(),
    }).subscribe({
      next: ({
        personas,
        actores,
        formasPago,
        destinosGasto,
        entidades,
        personasAutorizadas,
      }) => {
        this.personas.set(personas.data ?? []);
        this.actores.set(
          actores.filter((a) => String(a.id) !== ID_ACTOR_EMPRESA),
        );
        this.formasPago.set(formasPago.filter((f) => f.activo !== false));
        this.destinosGasto.set(destinosGasto.filter((d) => d.activo !== false));
        const opciones: CuentaOpcion[] = [];
        for (const e of entidades) {
          for (const c of e.cuentas ?? []) {
            opciones.push({
              idCuenta: c.id,
              numeroCuenta: c.numeroCuenta,
              moneda: c.moneda,
              nombreEntidad: e.nombre,
              activo: c.activo !== false,
            });
          }
        }
        opciones.sort((a, b) => a.nombreEntidad.localeCompare(b.nombreEntidad));
        this.cuentas.set(opciones.filter((c) => c.activo));
        this.personasAutorizadas.set(
          (personasAutorizadas ?? []).filter(
            (p) => p.autorizado !== false && p.activo !== false,
          ),
        );
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  // ---------- Destinatario ----------

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
          (p.numeroDocumento ?? '').toLowerCase().includes(texto),
      )
      .slice(0, 50);
  }

  // ---------- Entrada restringida ----------

  private readonly TECLAS_CONTROL = [
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

  /** Monto: solo dígitos y un único punto decimal. */
  restringirEntradaNumerica(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (event.ctrlKey || event.metaKey) return;
    if (this.TECLAS_CONTROL.includes(event.key)) return;
    if (event.key === '.') {
      if (target.value.includes('.')) event.preventDefault();
      return;
    }
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  /** N° de comprobante: solo dígitos y . - _ / */
  etiquetaCuenta(c: CuentaOpcion): string {
    return `${c.nombreEntidad} · ${c.numeroCuenta} (${etiquetaMonedaCuenta(c.moneda)})`;
  }

  // ---------- Guardar ----------

  cancelar(): void {
    this.dialogRef.close();
  }

  private resolverDestinatario():
    | { idPersona?: string; idActorProductivoMinero?: string }
    | string {
    if (this.destinatarioTipo === 'ACTOR') {
      const idActor = this.f.idActorDestinatario.value;
      return idActor
        ? { idActorProductivoMinero: idActor }
        : 'Elige el actor productivo destinatario';
    }
    const p = this.f.personaDestinatario.value;
    return p && typeof p === 'object'
      ? { idPersona: String(p.id) }
      : 'Elige la persona destinataria';
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const destinatario = this.resolverDestinatario();
    if (typeof destinatario === 'string') {
      this.snackBar.open(destinatario, 'Cerrar', { duration: 4000 });
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();

    const request: EntregarFondoRendirRequest = {
      ...destinatario,
      fecha: this.formatFecha(v.fecha!),
      concepto: v.concepto!.trim(),
      monto: Number(v.monto),
      idPersonaAutorizo: v.idPersonaAutorizo!,
    };
    request.idFormaPago = v.idFormaPago!;
    // Con cuenta bancaria solo se debita la libreta de esa cuenta; sin ella,
    // sale en efectivo de la caja de flujo. Nunca ambas.
    if (this.requiereCuentaBancaria) {
      request.idCuentaBancaria = v.idCuentaBancaria!;
      request.nroComprobante = (v.nroComprobante ?? '').trim();
    }
    if (v.idDestinoGasto != null) request.idDestinoGasto = v.idDestinoGasto;
    if (v.fechaLimite) request.fechaLimite = this.formatFecha(v.fechaLimite);

    this.fondoRendirService.entregar(request).subscribe({
      next: (fondo) => {
        this.guardando.set(false);
        this.snackBar.open('Fondo entregado', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(fondo ?? true);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo entregar el fondo',
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
}
