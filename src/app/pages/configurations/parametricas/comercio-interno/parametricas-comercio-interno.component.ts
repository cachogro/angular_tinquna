import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CodificacionFormDialogComponent } from '../codificaciones/codificacion-form-dialog.component';
import { CotizacionFormDialogComponent } from '../cotizacion/cotizacion-form-dialog.component';
import { LaboratorioFormDialogComponent } from '../laboratorio/laboratorio-form-dialog.component';
import { CodificacionLoteFormDialogComponent } from '../codificacion-lote/codificacion-lote-form-dialog.component';
import { EntidadAporteFormDialogComponent } from '../entidad-aporte/entidad-aporte-form-dialog.component';
import { MineralFormDialogComponent } from '../mineral/mineral-form-dialog.component';
import { EscalaPrecioFormDialogComponent } from '../escala-precio/escala-precio-form-dialog.component';
import { GastoTratamientoFormDialogComponent } from '../gasto-tratamiento/gasto-tratamiento-form-dialog.component';
import { PenalidadFormDialogComponent } from '../penalidad/penalidad-form-dialog.component';
import { LugarAcopioFormDialogComponent } from '../lugar-acopio/lugar-acopio-form-dialog.component';

// A futuro, cuando implementes Ley e Ingenio, importa aquí sus modales
// y sus tablas, siguiendo exactamente el mismo patrón que Codificación:
// import { LeyFormDialogComponent } from './leyes/ley-form-dialog/ley-form-dialog.component';
// import { LeyesTableComponent } from './leyes/leyes-table/leyes-table.component';

@Component({
  selector: 'app-parametricas-comercio-interno',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './parametricas-comercio-interno.component.html',
  styleUrl: './parametricas-comercio-interno.component.scss',
})
export class ParametricasComercioInternoComponent {
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

  abrirNuevaCodificacionLote(): void {
    this.dialog.open(CodificacionLoteFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevoLaboratorio(): void {
    this.dialog.open(LaboratorioFormDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevaEntidadAporte(): void {
    this.dialog.open(EntidadAporteFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevoMineral(): void {
    this.dialog.open(MineralFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevaEscalaPrecio(): void {
    this.dialog.open(EscalaPrecioFormDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevoGastoTratamiento(): void {
    this.dialog.open(GastoTratamientoFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevaPenalidad(): void {
    this.dialog.open(PenalidadFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevoLugarAcopio(): void {
    this.dialog.open(LugarAcopioFormDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

}
