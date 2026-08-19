import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { EscalaPrecio } from 'src/app/pages/configurations/parametricas/models/parametricas.models';

/** Datos ya resueltos que arma valorizacion-form antes de abrir este
 *  diálogo: es una vista de solo lectura, no vuelve a consultar servicios. */
export interface VerTablaPrecioDialogData {
  mineral: string;
  /** Ley + ajuste de puntos con la que se buscó el tramo; null si la fila
   *  todavía no tiene ley cargada. */
  leyAjustada: number | null;
  /** id del tramo (fila de la tabla) que se está usando para el cálculo
   *  actual; null si no hay ninguno (ley fuera de rango o sin tabla). */
  idTramoActivo: number | null;
  /** Tramos vigentes del mineral, ordenados por ley ascendente. */
  tramos: EscalaPrecio[];
}

@Component({
  selector: 'app-ver-tabla-precio-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './ver-tabla-precio-dialog.component.html',
  styleUrl: './ver-tabla-precio-dialog.component.scss',
})
export class VerTablaPrecioDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<VerTablaPrecioDialogComponent>,
  );
  readonly data = inject<VerTablaPrecioDialogData>(MAT_DIALOG_DATA);

  cerrar(): void {
    this.dialogRef.close();
  }

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const [year, month, day] = fecha.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
}
