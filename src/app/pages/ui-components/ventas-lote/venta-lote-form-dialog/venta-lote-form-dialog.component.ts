// src/app/pages/ui-components/ventas-lote/venta-lote-form-dialog/venta-lote-form-dialog.component.ts
// Nueva venta: un lote (promedio) entero a un cliente comprador. Nace ABIERTA,
// sin monto; los anticipos se registran después como recibos de INGRESO.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
import { FechaInputDirective } from 'src/app/shared/directives/fecha-input.directive';
import { tipoCambioCuatroDecimales } from 'src/app/shared/utils/numero.util';
import {
  Cliente,
  esClienteExportacion,
} from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import { KardexService } from 'src/app/pages/contabilidad/services/kardex.service';
import { formatFechaIso } from 'src/app/pages/contabilidad/components/personal-interno.util';
import { PromedioMineral } from '../../models/promedio-mineral.models';
import {
  CrearVentaLoteRequest,
  MonedaVentaLote,
} from '../../models/venta-lote.models';
import { VentaLoteService } from '../../services/venta-lote.service';

export interface VentaLoteFormDialogData {
  idCliente?: string;
}

@Component({
  selector: 'app-venta-lote-form-dialog',
  standalone: true,
  imports: [
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
    FechaInputDirective,
  ],
  templateUrl: './venta-lote-form-dialog.component.html',
  styleUrl: './venta-lote-form-dialog.component.scss',
})
export class VentaLoteFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<VentaLoteFormDialogComponent>);
  /** Opcional: cliente fijo cuando se abre desde su cuenta corriente. */
  private readonly data = inject<VentaLoteFormDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly ventaService = inject(VentaLoteService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly kardexService = inject(KardexService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly promedios = signal<PromedioMineral[]>([]);
  /** Solo clientes con kardex CLIENTE abierto (ahí van sus anticipos). */
  readonly clientes = signal<Cliente[]>([]);
  /** Separados para el select por la modalidad de venta del cliente. */
  readonly clientesInternos = computed(() =>
    this.clientes().filter((c) => !esClienteExportacion(c)),
  );
  readonly clientesExportacion = computed(() =>
    this.clientes().filter((c) => esClienteExportacion(c)),
  );
  readonly hoy = new Date();

  readonly form = new FormGroup({
    idPromedioMineral: new FormControl<string | null>(null, [Validators.required]),
    idCliente: new FormControl<string | null>(null, [Validators.required]),
    fechaVenta: new FormControl<Date | null>(new Date(), [Validators.required]),
    moneda: new FormControl<MonedaVentaLote>('BS', { nonNullable: true }),
    tipoCambio: new FormControl<string | null>(null),
    observaciones: new FormControl('', [Validators.maxLength(255)]),
  });

  get f() {
    return this.form.controls;
  }

  get esUsd(): boolean {
    return this.f.moneda.value === 'USD';
  }

  ngOnInit(): void {
    this.f.moneda.valueChanges.subscribe(() => this.sincronizarTipoCambio());
    this.f.idCliente.valueChanges.subscribe(() => this.sugerirMoneda());
    forkJoin({
      promedios: this.ventaService.promediosDisponibles(),
      clientes: this.parametricasService.getAllClientes(),
      kardex: this.kardexService.listar({
        tipo: 'CLIENTE',
        estado: 'ABIERTO',
        limit: 1000,
      }),
    }).subscribe({
      next: ({ promedios, clientes, kardex }) => {
        const conKardex = new Set(
          (kardex.data ?? [])
            .map((k) => String(k.idCliente ?? k.cliente?.id ?? ''))
            .filter(Boolean),
        );
        this.promedios.set(promedios);
        this.clientes.set(
          (clientes ?? []).filter(
            (c) => c.activo !== false && conKardex.has(String(c.id)),
          ),
        );
        this.cargando.set(false);
        this.fijarClienteInicial();
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('No se pudieron cargar lotes y clientes', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  /** Abierto desde la cuenta de un cliente: lo deja elegido y fijo. */
  private fijarClienteInicial(): void {
    const idCliente = this.data?.idCliente;
    if (!idCliente) return;
    const cliente = this.clientes().find((c) => String(c.id) === String(idCliente));
    if (!cliente) {
      this.snackBar.open(
        'El cliente no tiene un kardex abierto: ábrelo antes de venderle un lote.',
        'Cerrar',
        { duration: 6000 },
      );
      return;
    }
    this.f.idCliente.setValue(cliente.id);
    this.f.idCliente.disable({ emitEvent: false });
  }

  /** Sugiere la moneda según la modalidad del cliente: exportación en $us,
   *  comercio interno en Bs. Queda editable. */
  private sugerirMoneda(): void {
    const cliente = this.clienteSeleccionado();
    if (!cliente) return;
    this.f.moneda.setValue(esClienteExportacion(cliente) ? 'USD' : 'BS');
  }

  clienteSeleccionado(): Cliente | undefined {
    return this.clientes().find((c) => c.id === this.f.idCliente.value);
  }

  get esVentaExportacion(): boolean {
    const cliente = this.clienteSeleccionado();
    return !!cliente && esClienteExportacion(cliente);
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
      tc.setValue(null, { emitEvent: false });
    }
    tc.updateValueAndValidity({ emitEvent: false });
  }

  promedioSeleccionado(): PromedioMineral | undefined {
    return this.promedios().find((p) => p.id === this.f.idPromedioMineral.value);
  }

  etiquetaPromedio(p: PromedioMineral): string {
    return `${p.codigoLote || p.codigo}${p.codigoLote ? ' · ' + p.codigo : ''}`;
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const req: CrearVentaLoteRequest = {
      idPromedioMineral: v.idPromedioMineral!,
      idCliente: v.idCliente!,
      fechaVenta: formatFechaIso(v.fechaVenta!),
      moneda: v.moneda,
      observaciones: v.observaciones?.trim() || undefined,
    };
    if (v.moneda === 'USD') req.tipoCambio = Number(v.tipoCambio);

    this.guardando.set(true);
    this.ventaService.crear(req).subscribe({
      next: (venta) => {
        this.guardando.set(false);
        this.snackBar.open(`Lote ${venta.codigoLote ?? ''} vendido`, 'Cerrar', {
          duration: 3000,
        });
        this.dialogRef.close(venta);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo registrar la venta',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
