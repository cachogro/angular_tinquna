import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  RegistroMineral,
  detalleProveedorRecepcion,
  leyesTextoRecepcion,
  nombreProveedorRecepcion,
} from '../../models/registro-mineral.models';
import { RegistroMineralService } from '../../services/registro-mineral.service';
import { nombrePersona } from '../../../contabilidad/components/personal-interno.util';
import { abrirBlobEnPestana } from 'src/app/shared/utils/descarga-archivo.util';
import { horaFechaDeIso } from 'src/app/shared/utils/fecha-bolivia.util';
import { formatNumeroConMiles } from 'src/app/shared/utils/numero.util';

export interface VerRecepcionDialogData {
  registro: RegistroMineral;
  /** Comprobante RM-: imprimible en cualquier estado salvo CANCELADO. */
  puedeImprimir: boolean;
}

@Component({
  selector: 'app-ver-recepcion-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './ver-recepcion-dialog.component.html',
  styleUrl: './ver-recepcion-dialog.component.scss',
})
export class VerRecepcionDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<VerRecepcionDialogComponent>,
  );
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<VerRecepcionDialogData>(MAT_DIALOG_DATA);

  readonly registro = this.data.registro;
  readonly formatFecha = horaFechaDeIso;
  readonly formatNumero = formatNumeroConMiles;

  cerrar(): void {
    this.dialogRef.close();
  }

  nombreProveedor(): string {
    return nombreProveedorRecepcion(this.registro);
  }

  detalleProveedor(): string {
    return detalleProveedorRecepcion(this.registro);
  }

  nombreMuestrero(): string {
    return nombrePersona(this.registro.personalInterno);
  }

  leyesTexto(): string {
    return leyesTextoRecepcion(this.registro);
  }

  /** Abre el comprobante RM- (PDF del back) en otra pestaña. */
  imprimirComprobante(): void {
    this.registroMineralService.obtenerPdf(this.registro.id).subscribe({
      next: (blob) => abrirBlobEnPestana(blob),
      error: (err) =>
        this.snackBar.open(
          err?.error?.message ??
            'No se pudo generar el comprobante de la recepción',
          'Cerrar',
          { duration: 4000 },
        ),
    });
  }
}
