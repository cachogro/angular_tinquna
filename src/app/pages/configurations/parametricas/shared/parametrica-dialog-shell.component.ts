import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Cascarón visual reutilizable para todos los modales de Parametricas
 * (Codificación, Ley, Ingenio, etc.). Da el mismo header, layout de
 * contenido y zona de acciones sin repetir markup en cada modal.
 *
 * Uso:
 * <app-parametrica-dialog-shell [titulo]="'Nueva Codificación'">
 *   <form>...</form>
 *   <ng-container dialog-actions>
 *     <button mat-stroked-button mat-dialog-close>Cancelar</button>
 *     <button mat-flat-button color="primary">Guardar</button>
 *   </ng-container>
 * </app-parametrica-dialog-shell>
 */
@Component({
  selector: 'app-parametrica-dialog-shell',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './parametrica-dialog-shell.component.html',
  styleUrl: './parametrica-dialog-shell.component.scss',
})
export class ParametricaDialogShellComponent {
  @Input() titulo = '';
}
