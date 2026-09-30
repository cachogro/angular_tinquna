// src/app/pages/contabilidad/boletas-pago/boleta-detalle-dialog/boleta-detalle-dialog.component.ts
// Visor de la boleta (GET /:id): ingresos, descuentos de ley, descuentos de
// préstamos (líneas DESCUENTO_SUELDO de cada sub-libro) y el recibo del neto.
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
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BoletaPago } from '../../models/boleta-pago.models';
import { BoletaPagoService } from '../../services/boleta-pago.service';
import { fechaFmt, nombrePersona, num } from '../../components/personal-interno.util';
import { abrirPdfBoleta } from '../boleta-pdf.util';
import {
  ReciboDetalleDialogComponent,
  ReciboDetalleDialogData,
} from '../../recibos/recibo-detalle-dialog/recibo-detalle-dialog.component';

export interface BoletaDetalleDialogData {
  id: string;
}

@Component({
  selector: 'app-boleta-detalle-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule],
  templateUrl: './boleta-detalle-dialog.component.html',
  styleUrl: './boleta-detalle-dialog.component.scss',
})
export class BoletaDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BoletaDetalleDialogComponent>);
  readonly data = inject<BoletaDetalleDialogData>(MAT_DIALOG_DATA);
  private readonly boletaService = inject(BoletaPagoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly descargandoPdf = signal(false);
  readonly boleta = signal<BoletaPago | null>(null);

  nombre = nombrePersona;
  fechaFmt = fechaFmt;
  num = num;

  ngOnInit(): void {
    this.boletaService.obtener(this.data.id).subscribe({
      next: (b) => {
        this.boleta.set(b);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo cargar la boleta', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  codigoRecibo(b: BoletaPago): string {
    const r = b.recibo;
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

  /** interno = true: con préstamos, neto y saldos; false: solo la parte de ley. */
  verPdf(interno: boolean): void {
    if (this.descargandoPdf()) return;
    this.descargandoPdf.set(true);
    abrirPdfBoleta(this.boletaService, this.snackBar, this.data.id, interno, () =>
      this.descargandoPdf.set(false),
    );
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
