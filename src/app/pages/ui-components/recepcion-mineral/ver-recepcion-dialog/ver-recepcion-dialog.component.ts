import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RegistroMineral } from '../../models/registro-mineral.models';
import { RegistroMineralService } from '../../services/registro-mineral.service';
import { formatNumeroConMiles } from 'src/app/shared/utils/numero.util';

export interface VerRecepcionDialogData {
  registro: RegistroMineral;
  /** Solo se puede imprimir en APROBADO, RECHAZADO A TOL, TRANZADO y REMUESTREO. */
  puedeImprimir: boolean;
  /** Si viene en true, se dispara la impresión apenas se abre el diálogo. */
  autoImprimir?: boolean;
}

@Component({
  selector: 'app-ver-recepcion-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './ver-recepcion-dialog.component.html',
  styleUrl: './ver-recepcion-dialog.component.scss',
})
export class VerRecepcionDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<VerRecepcionDialogComponent>,
  );
  private readonly registroMineralService = inject(RegistroMineralService);
  readonly data = inject<VerRecepcionDialogData>(MAT_DIALOG_DATA);

  get registro(): RegistroMineral {
    return this.data.registro;
  }

  ngOnInit(): void {}

  cerrar(): void {
    this.dialogRef.close();
  }

  nombreProveedor(): string {
    const p = this.registro.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  nombreMuestrero(): string {
    const p = this.registro.personalInterno;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  /**
   * Formatea una fecha ISO con offset ('2026-07-24T04:38:00-04:00') como
   * 'HH:mm - dd-MM-yyyy', usando los componentes tal cual vienen en el string
   * (sin pasar por Date, para no depender del huso horario del navegador).
   */
  formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia, hora, minuto] = match;
    return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
  }

  leyesTexto(): string {
    if (!this.registro.detalles?.length) return '';
    return this.registro.detalles
      .map(
        (d) =>
          `${d.mineral?.simbolo ?? 'Mineral ' + d.idMineral} ${formatNumeroConMiles(d.ley)}%`,
      )
      .join(' · ');
  }

  formatNumero(valor: number | string | null | undefined): string {
    return formatNumeroConMiles(valor);
  }

  /** Abre una ventana de impresión con el detalle formateado (el navegador permite "Guardar como PDF"). */

  imprimir2(id: string) {
    const idNumerico = +id;

    console.log('este es el id ', id);

    this.registroMineralService.descargarPdf(idNumerico);
  }
}
