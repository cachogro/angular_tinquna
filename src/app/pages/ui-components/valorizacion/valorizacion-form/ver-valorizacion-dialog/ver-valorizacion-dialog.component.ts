import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { formatNumeroSinCeros } from 'src/app/shared/utils/numero.util';

export interface LeyPrecioVisualizacion {
  simbolo: string;
  ley: number | string | null;
  leyUnidad: string;
  precioPorKilo: number;
}

export interface DescuentoVisualizacion {
  entidad: string;
  porcentaje: number;
  importe: number;
}

/** Datos ya resueltos (sin lookups pendientes) que arma el formulario antes
 *  de abrir este diálogo: es una vista de solo lectura, no vuelve a
 *  consultar servicios ni el form. */
export interface VerValorizacionDialogData {
  numero: string;
  producto: string;
  cliente: string;
  numeroDocumento: string;
  lote: string;
  fechaEntrega: string;
  fechaTransaccion: string;
  cooperativa: string;
  pesoBruto: number;
  pesoNeto: number;
  leyesYPrecios: LeyPrecioVisualizacion[];
  totalValorBrutoBolivianos: number;
  anticipo: number;
  otrosAnticipo: number;
  transporte: number;
  totalValorLiquidoVentaBolivianos: number;
  descuentos: DescuentoVisualizacion[];
  descuentoTotal: number;
  telefonoCliente?: string;
}

@Component({
  selector: 'app-ver-valorizacion-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './ver-valorizacion-dialog.component.html',
  styleUrl: './ver-valorizacion-dialog.component.scss',
})
export class VerValorizacionDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<VerValorizacionDialogComponent>,
  );
  readonly data = inject<VerValorizacionDialogData>(MAT_DIALOG_DATA);

  cerrar(): void {
    this.dialogRef.close();
  }

  formatNumero(valor: number | string | null | undefined): string {
    return formatNumeroSinCeros(valor) || '0';
  }
}
