import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EntidadFinancieraFormDialogComponent } from '../entidad-financiera/entidad-financiera-form-dialog.component';
import { CajaFormDialogComponent } from '../caja/caja-form-dialog.component';

@Component({
  selector: 'app-parametricas-contabilidad',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './parametricas-contabilidad.component.html',
  styleUrl: './parametricas-contabilidad.component.scss',
})
export class ParametricasContabilidadComponent {
  private readonly dialog = inject(MatDialog);

  abrirNuevaEntidadFinanciera(): void {
    this.dialog.open(EntidadFinancieraFormDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirNuevaCaja(): void {
    this.dialog.open(CajaFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }
}
