// src/app/pages/ui-components/ventas-lote/venta-lote-list.component.ts
// Bandeja de ventas de lote: cada lote (promedio) vendido a un cliente, con
// su seguimiento invertido / cobrado / venta / por cobrar / utilidad (Bs).
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { EstadoVentaLote, VentaLote } from '../models/venta-lote.models';
import { VentaLoteService } from '../services/venta-lote.service';
import {
  abrirCobroVentaLote,
  puedeCobrarVentaLote,
} from './cobro-venta-lote.util';
import { VentaLoteDetalleDialogComponent } from './venta-lote-detalle-dialog/venta-lote-detalle-dialog.component';
import { VentaLoteFormDialogComponent } from './venta-lote-form-dialog/venta-lote-form-dialog.component';
import { VentaLoteLiquidarDialogComponent } from './venta-lote-liquidar-dialog/venta-lote-liquidar-dialog.component';

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

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
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

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargar();
  }

  // ---------- Acciones ----------

  nueva(): void {
    this.dialog
      .open(VentaLoteFormDialogComponent, {
        width: '640px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((venta?: VentaLote) => {
        if (venta) this.cargar();
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
        if (cambios) this.cargar();
      });
  }

  puedeCobrar(v: VentaLote): boolean {
    return puedeCobrarVentaLote(v);
  }

  registrarCobro(v: VentaLote): void {
    abrirCobroVentaLote(this.dialog, v).subscribe((recibo) => {
      if (recibo) this.cargar();
    });
  }

  liquidar(v: VentaLote): void {
    this.dialog
      .open(VentaLoteLiquidarDialogComponent, {
        data: v,
        width: '560px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((res) => {
        if (res) this.cargar();
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
            this.cargar();
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

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }
}
