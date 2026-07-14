import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CodificacionFormDialogComponent } from './codificaciones/codificacion-form-dialog/codificacion-form-dialog.component';
import { CodificacionesTableComponent } from './codificaciones/codificaciones-table/codificaciones-table.component';

// A futuro, cuando implementes Ley e Ingenio, importa aquí sus modales
// y sus tablas, siguiendo exactamente el mismo patrón que Codificación:
// import { LeyFormDialogComponent } from './leyes/ley-form-dialog/ley-form-dialog.component';
// import { LeyesTableComponent } from './leyes/leyes-table/leyes-table.component';

@Component({
  selector: 'app-parametricas',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
    CodificacionesTableComponent,
    // LeyesTableComponent,
    // IngeniosTableComponent,
  ],
  templateUrl: './parametricas.component.html',
})
export class ParametricasComponent {
  private readonly dialog = inject(MatDialog);

  abrirNuevaCodificacion(): void {
    this.dialog.open(CodificacionFormDialogComponent, {
      width: '860px',
      autoFocus: false,
    });
  }

  // A futuro:
  // abrirNuevaLey(): void {
  //   this.dialog.open(LeyFormDialogComponent, { width: '560px', autoFocus: false });
  // }
  //
  // abrirNuevoIngenio(): void {
  //   this.dialog.open(IngenioFormDialogComponent, { width: '560px', autoFocus: false });
  // }
}
