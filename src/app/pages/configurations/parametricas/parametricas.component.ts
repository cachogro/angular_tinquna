import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CodificacionFormDialogComponent } from './codificaciones/codificacion-form-dialog.component';
import { CotizacionFormDialogComponent } from './cotizacion/cotizacion-form-dialog.component';
import { ActorProductivoMineroFormDialogComponent } from './actor-productivo-minero/actor-productivo-minero-form-dialog.component';
import { MatIcon } from '@angular/material/icon';

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
    MatIcon,
    // LeyesTableComponent,
    // IngeniosTableComponent,
  ],
  templateUrl: './parametricas.component.html',
  styleUrl: './parametricas.component.scss',
})
export class ParametricasComponent {
  private readonly dialog = inject(MatDialog);

  abrirNuevaCodificacion(): void {
    this.dialog.open(CodificacionFormDialogComponent, {
      // width: '860px',
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevaCotizacion(): void {
    this.dialog.open(CotizacionFormDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevoActorProductivoMinero(): void {
    this.dialog.open(ActorProductivoMineroFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }



}
