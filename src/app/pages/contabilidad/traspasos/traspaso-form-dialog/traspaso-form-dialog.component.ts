// src/app/pages/contabilidad/traspasos/traspaso-form-dialog/traspaso-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { MatButtonModule } from '@angular/material/button';
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
import { forkJoin } from 'rxjs';
import {
  DestinoGasto,
  MonedaCuentaBancaria,
  etiquetaMonedaCuenta,
} from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import { PersonaCI } from '../../../configurations/models/persona.models';
import { PersonaService } from '../../../configurations/services/persona.service';
import {
  GuardarTraspasoRequest,
  PersonaAutorizoEnTraspaso,
  Traspaso,
  TipoTraspaso,
} from '../../models/traspaso.models';
import { TraspasoService } from '../../services/traspaso.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

export interface TraspasoFormDialogData {
  tipo: TipoTraspaso;
  traspaso?: Traspaso | null;
}

interface CuentaOpcion {
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuentaBancaria;
  nombreEntidad: string;
  activo: boolean;
}

@Component({
  selector: 'app-traspaso-form-dialog',
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
    MatIconModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './traspaso-form-dialog.component.html',
  styleUrl: './traspaso-form-dialog.component.scss',
})
export class TraspasoFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<TraspasoFormDialogComponent>,
  );
  readonly data = inject<TraspasoFormDialogData>(MAT_DIALOG_DATA);
  private readonly traspasoService = inject(TraspasoService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly cuentas = signal<CuentaOpcion[]>([]);
  readonly destinosGasto = signal<DestinoGasto[]>([]);
  /** Personas autorizadas + (en edición) el autorizador guardado en el
   *  traspaso aunque ya no figure como autorizado: el back conserva sus
   *  datos si se reenvía el mismo id. */
  readonly personasAutorizadas = signal<PersonaAutorizoEnTraspaso[]>([]);

  get esEdicion(): boolean {
    return !!this.data.traspaso;
  }

  get titulo(): string {
    const accion = this.esEdicion ? 'Editar' : 'Nuevo';
    return this.data.tipo === 'DEPOSITO'
      ? `${accion} depósito — Caja → Banco`
      : `${accion} retiro — Banco → Caja`;
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    idCuentaBancaria: new FormControl<number | null>(null, [
      Validators.required,
    ]),
    nroComprobante: new FormControl('', [Validators.maxLength(30)]),
    idDestinoGasto: new FormControl<number | null>(null),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    monto: new FormControl<number | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    // Quién autorizó el traspaso: obligatoria, del catálogo de autorizadas.
    idPersonaAutorizo: new FormControl<string | null>(null, [
      Validators.required,
    ]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });

    forkJoin({
      entidades: this.parametricasService.obtenerEntidadesFinancieras(),
      destinosGasto: this.parametricasService.obtenerDestinosGasto(),
      personasAutorizadas: this.personaService.listarPersonasAutorizadas(),
    }).subscribe({
      next: ({ entidades, destinosGasto, personasAutorizadas }) => {
        this.destinosGasto.set(destinosGasto.filter((d) => d.activo !== false));
        this.personasAutorizadas.set(
          this.opcionesAutorizo(personasAutorizadas ?? []),
        );
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
        this.cargandoCatalogos.set(false);
        this.precargarSiEdicion();
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
        this.precargarSiEdicion();
      },
    });
  }

  private precargarSiEdicion(): void {
    const t = this.data.traspaso;
    if (!t) return;
    this.form.patchValue({
      fecha: this.parseFecha(t.fecha),
      idCuentaBancaria: t.idCuentaBancaria,
      nroComprobante: t.nroComprobante ?? '',
      idDestinoGasto: t.idDestinoGasto ?? null,
      concepto: t.concepto,
      monto: Number(t.monto),
      // Traspasos anteriores a la 069 vienen sin autorizador: hay que elegirlo.
      idPersonaAutorizo: t.personaAutorizo?.id
        ? String(t.personaAutorizo.id)
        : null,
    });
    // Cuenta bancaria: no se puede cambiar en un update.
    this.form.controls.idCuentaBancaria.disable();
  }

  /** Autorizadas activas; en edición se suma el autorizador guardado si ya
   *  no está en la lista, para que el select lo muestre. */
  private opcionesAutorizo(lista: PersonaCI[]): PersonaAutorizoEnTraspaso[] {
    const opciones: PersonaAutorizoEnTraspaso[] = lista
      .filter((p) => p.autorizado !== false && p.activo !== false)
      .map((p) => ({
        id: String(p.id),
        nombres: p.nombres,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
      }));
    const guardada = this.data.traspaso?.personaAutorizo;
    if (guardada && !opciones.some((p) => p.id === String(guardada.id))) {
      opciones.unshift({ ...guardada, id: String(guardada.id) });
    }
    return opciones;
  }

  nombreAutorizo(p: PersonaAutorizoEnTraspaso): string {
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  etiquetaCuenta(c: CuentaOpcion): string {
    return `${c.nombreEntidad} · ${c.numeroCuenta} (${etiquetaMonedaCuenta(c.moneda)})`;
  }

  /** DEPOSITO (sale de caja) exige un destino de egreso; RETIRO (entra a
   *  caja) exige uno de ingreso — mismo criterio que la pantalla de recibos. */
  get destinosGastoFiltrados(): DestinoGasto[] {
    const quiero = this.data.tipo === 'DEPOSITO';
    return this.destinosGasto().filter((d) => d.esEgreso === quiero);
  }

  // ---------- Guardar ----------

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();

    const request: GuardarTraspasoRequest = {
      ...(this.data.traspaso ? { id: this.data.traspaso.id } : {}),
      fecha: this.formatFecha(v.fecha!),
      idCuentaBancaria: v.idCuentaBancaria!,
      tipo: this.data.tipo,
      concepto: v.concepto!.trim(),
      monto: Number(v.monto),
      idPersonaAutorizo: v.idPersonaAutorizo!,
    };

    const nroComprobante = (v.nroComprobante ?? '').trim();
    if (nroComprobante) request.nroComprobante = nroComprobante;
    if (v.idDestinoGasto != null) request.idDestinoGasto = v.idDestinoGasto;

    this.traspasoService.guardar(request).subscribe({
      next: (traspaso) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion ? 'Traspaso actualizado' : 'Traspaso registrado',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(traspaso ?? true);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo guardar el traspaso',
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
