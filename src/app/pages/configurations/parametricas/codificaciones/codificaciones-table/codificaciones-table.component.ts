import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';



import { CodificacionFormDialogComponent } from '../codificacion-form-dialog/codificacion-form-dialog.component';
import { ParametricasService } from '../../../services/parametricas.service';
import { Codificacion } from '../../models/parametricas.models';


@Component({
  selector: 'app-codificaciones-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './codificaciones-table.component.html',
})
export class CodificacionesTableComponent implements OnInit {
  private readonly parametricasService = inject(ParametricasService);
  private readonly dialog = inject(MatDialog);

  columnas = ['codigo', 'nombre', 'acciones'];

  // Se leen directo del signal del servicio: al guardar en el modal,
  // el servicio actualiza el signal y esta tabla se refresca sola.
  get codificaciones(): Codificacion[] {
    return this.parametricasService.codificaciones();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoCodificaciones();
  }

  ngOnInit(): void {
    this.parametricasService.cargarCodificaciones();
  }

  editar(codificacion: Codificacion): void {
    this.dialog.open(CodificacionFormDialogComponent, {
      width: '560px',
      autoFocus: false,
      data: { codificacion },
    });
  }
}
