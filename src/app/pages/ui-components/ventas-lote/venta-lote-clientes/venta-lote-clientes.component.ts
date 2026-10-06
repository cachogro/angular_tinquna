// src/app/pages/ui-components/ventas-lote/venta-lote-clientes/venta-lote-clientes.component.ts
// Bandeja por cliente: la cuenta corriente de cada comprador (anticipos vs
// lotes liquidados), agrupada por modalidad de venta. En comercio interno
// los anticipos pagan los lotes a medida que se liquidan.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModalidadVentaCliente } from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { CuentaClienteFila } from '../../models/venta-lote.models';
import { VentaLoteService } from '../../services/venta-lote.service';
import { abrirAnticipoCliente, abrirVenderLote } from '../cobro-venta-lote.util';
import { VentaLoteClienteDialogComponent } from '../venta-lote-cliente-dialog/venta-lote-cliente-dialog.component';

interface GrupoClientes {
  modalidad: ModalidadVentaCliente;
  titulo: string;
  ayuda: string;
  filas: CuentaClienteFila[];
}

@Component({
  selector: 'app-venta-lote-clientes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './venta-lote-clientes.component.html',
  styleUrl: './venta-lote-clientes.component.scss',
})
export class VentaLoteClientesComponent implements OnInit {
  private readonly service = inject(VentaLoteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Algo cambió (anticipo, venta, liquidación): la bandeja por lote recarga. */
  readonly cambio = output<void>();

  readonly cargando = signal(true);
  readonly cuentas = signal<CuentaClienteFila[]>([]);

  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly busqueda = toSignal(this.searchControl.valueChanges, {
    initialValue: '',
  });

  readonly grupos = computed<GrupoClientes[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filas = this.cuentas().filter(
      (c) => !texto || c.cliente.nombre.toLowerCase().includes(texto),
    );
    const grupos: GrupoClientes[] = [
      {
        modalidad: 'COMERCIO_INTERNO',
        titulo: 'Comercio interno',
        ayuda: 'Cuenta corriente: los anticipos pagan los lotes a medida que se liquidan',
        filas: filas.filter((c) => c.modalidadVenta === 'COMERCIO_INTERNO'),
      },
      {
        modalidad: 'EXPORTACION',
        titulo: 'Exportación',
        ayuda: 'Se cobra lote por lote, el total o por partes',
        filas: filas.filter((c) => c.modalidadVenta === 'EXPORTACION'),
      },
    ];
    return grupos.filter((g) => g.filas.length > 0);
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.cuentasClientes().subscribe({
      next: (cuentas) => {
        this.cuentas.set(cuentas);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.cuentas.set([]);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar las cuentas de clientes',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  private huboCambio(): void {
    this.cargar();
    this.cambio.emit();
  }

  verCuenta(c: CuentaClienteFila): void {
    this.dialog
      .open(VentaLoteClienteDialogComponent, {
        data: c.cliente.id,
        width: '1040px',
        maxWidth: '96vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((cambios) => {
        if (cambios) this.huboCambio();
      });
  }

  registrarAnticipo(c: CuentaClienteFila): void {
    abrirAnticipoCliente(this.dialog, c.cliente).subscribe((recibo) => {
      if (recibo) this.huboCambio();
    });
  }

  venderLote(c: CuentaClienteFila): void {
    abrirVenderLote(this.dialog, c.cliente.id).subscribe((venta) => {
      if (venta) this.huboCambio();
    });
  }

  abs(n: number): number {
    return Math.abs(Number(n));
  }
}
