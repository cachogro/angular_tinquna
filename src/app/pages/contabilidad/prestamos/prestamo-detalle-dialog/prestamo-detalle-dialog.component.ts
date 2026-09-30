// src/app/pages/contabilidad/prestamos/prestamo-detalle-dialog/prestamo-detalle-dialog.component.ts
// Visor del préstamo (GET /:id): datos + sub-libro propio (OTORGAMIENTO,
// DESCUENTO_SUELDO, ABONO) con DEBE / HABER / saldo.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MovimientoPrestamo,
  PrestamoPersonal,
  TipoMovimientoPrestamo,
} from '../../models/prestamo-personal.models';
import { PrestamoPersonalService } from '../../services/prestamo-personal.service';
import { fechaFmt, nombrePersona, num } from '../../components/personal-interno.util';
import {
  ReciboDetalleDialogComponent,
  ReciboDetalleDialogData,
} from '../../recibos/recibo-detalle-dialog/recibo-detalle-dialog.component';
import {
  PrestamoOperacionDialogComponent,
  PrestamoOperacionDialogData,
} from '../prestamo-operacion-dialog/prestamo-operacion-dialog.component';

export interface PrestamoDetalleDialogData {
  id: string;
}

@Component({
  selector: 'app-prestamo-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './prestamo-detalle-dialog.component.html',
  styleUrl: './prestamo-detalle-dialog.component.scss',
})
export class PrestamoDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PrestamoDetalleDialogComponent>);
  readonly data = inject<PrestamoDetalleDialogData>(MAT_DIALOG_DATA);
  private readonly prestamoService = inject(PrestamoPersonalService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly prestamo = signal<PrestamoPersonal | null>(null);
  /** true si se registró algo (la bandeja recarga al cerrar). */
  private huboCambios = false;

  readonly columnas = ['numeroLinea', 'fecha', 'tipo', 'detalle', 'origen', 'debe', 'haber', 'saldo'];

  nombre = nombrePersona;
  fechaFmt = fechaFmt;
  num = num;

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.prestamoService.obtener(this.data.id).subscribe({
      next: (p) => {
        p.movimientos = [...(p.movimientos ?? [])].sort((a, b) => a.numeroLinea - b.numeroLinea);
        this.prestamo.set(p);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo cargar el préstamo', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  tipoLabel(t: TipoMovimientoPrestamo): string {
    return { OTORGAMIENTO: 'Otorgamiento', DESCUENTO_SUELDO: 'Desc. sueldo', ABONO: 'Abono' }[t];
  }

  codigoRecibo(m: MovimientoPrestamo): string {
    const r = m.recibo;
    return r ? `${r.serie}-${String(r.numero).padStart(4, '0')}` : '';
  }

  verRecibo(id: string): void {
    const data: ReciboDetalleDialogData = { id };
    this.dialog.open(ReciboDetalleDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  operar(modo: 'ABONO' | 'CUOTA'): void {
    const p = this.prestamo();
    if (!p) return;
    const data: PrestamoOperacionDialogData = { modo, prestamo: p };
    this.dialog
      .open(PrestamoOperacionDialogComponent, {
        data,
        width: modo === 'ABONO' ? '680px' : '560px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        this.huboCambios = true;
        this.cargar();
      });
  }

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }
}
