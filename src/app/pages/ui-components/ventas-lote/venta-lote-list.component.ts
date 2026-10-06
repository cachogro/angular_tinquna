// src/app/pages/ui-components/ventas-lote/venta-lote-list.component.ts
// Ventas de lote en dos pestañas: "Por cliente" (cuenta corriente de cada
// comprador, agrupada por modalidad) y "Por lote" (cada lote vendido con su
// seguimiento invertido / cobrado / venta / por cobrar / utilidad, en Bs).
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { ModalidadVentaCliente } from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { EstadoVentaLote, VentaLote } from '../models/venta-lote.models';
import { VentaLoteService } from '../services/venta-lote.service';
import { fechaFmt } from 'src/app/pages/contabilidad/components/personal-interno.util';
import {
  abrirCobroVentaLote,
  abrirLiquidarVentaLote,
  abrirVenderLote,
  puedeCobrarVentaLote,
} from './cobro-venta-lote.util';
import { VentaLoteClientesComponent } from './venta-lote-clientes/venta-lote-clientes.component';
import { VentaLoteDetalleDialogComponent } from './venta-lote-detalle-dialog/venta-lote-detalle-dialog.component';

@Component({
  selector: 'app-venta-lote-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatTabsModule,
    VentaLoteClientesComponent,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './venta-lote-list.component.html',
  styleUrl: './venta-lote-list.component.scss',
})
export class VentaLoteListComponent implements OnInit {
  private readonly service = inject(VentaLoteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'lote',
    'cliente',
    'fecha',
    'moneda',
    'invertido',
    'cobrado',
    'venta',
    'porCobrar',
    'utilidad',
    'estado',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly registros = signal<VentaLote[]>([]);
  readonly total = signal(0);
  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly estadoControl = new FormControl<EstadoVentaLote | null>(null);
  readonly modalidadControl = new FormControl<ModalidadVentaCliente | null>(null);

  /** Pestaña "Por cliente": se recarga cuando algo cambia en "Por lote". */
  private readonly bandejaClientes = viewChild(VentaLoteClientesComponent);

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.modalidadControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.cargar();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value?.trim() || undefined,
        estado: this.estadoControl.value ?? undefined,
        modalidad: this.modalidadControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.registros.set([]);
          this.total.set(0);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar las ventas de lote',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  /** Tras una acción sobre un lote cambia también la cuenta del cliente. */
  private recargarTodo(): void {
    this.cargar();
    this.bandejaClientes()?.cargar();
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargar();
  }

  // ---------- Acciones ----------

  nueva(): void {
    abrirVenderLote(this.dialog).subscribe((venta) => {
      if (venta) this.recargarTodo();
    });
  }

  verDetalle(v: VentaLote): void {
    this.dialog
      .open(VentaLoteDetalleDialogComponent, {
        data: v.id,
        width: '980px',
        maxWidth: '96vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((cambios) => {
        if (cambios) this.recargarTodo();
      });
  }

  puedeCobrar(v: VentaLote): boolean {
    return puedeCobrarVentaLote(v);
  }

  registrarCobro(v: VentaLote): void {
    abrirCobroVentaLote(this.dialog, v).subscribe((recibo) => {
      if (recibo) this.recargarTodo();
    });
  }

  liquidar(v: VentaLote): void {
    abrirLiquidarVentaLote(this.dialog, v).subscribe((venta) => {
      if (venta) this.recargarTodo();
    });
  }

  anular(v: VentaLote): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Anular venta del lote ${v.codigoLote}`,
          message:
            'La venta se anula y el lote vuelve a quedar disponible para venderse. Solo es posible si no tiene cobros vigentes.',
          confirmLabel: 'Anular',
          tone: 'danger',
          icon: 'block',
        },
        width: '420px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.service.anular(v.id).subscribe({
          next: () => {
            this.snackBar.open('Venta anulada', 'Cerrar', { duration: 3000 });
            this.recargarTodo();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo anular la venta',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  // ---------- Presentación ----------

  etiquetaEstado(v: VentaLote): string {
    return v.pagada ? 'PAGADA' : v.estado;
  }

  readonly fechaFmt = fechaFmt;
}
