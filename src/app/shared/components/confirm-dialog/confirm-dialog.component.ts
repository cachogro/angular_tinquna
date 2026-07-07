// src/app/shared/components/confirm-dialog/confirm-dialog.component.ts
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog" [class.tone-danger]="data.tone === 'danger'">
      <div class="confirm-dialog__icon">
        <mat-icon>{{ data.icon ?? (data.tone === 'danger' ? 'warning_amber' : 'help_outline') }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>{{ data.message }}</mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button [mat-dialog-close]="false">
          {{ data.cancelLabel ?? 'Cancelar' }}
        </button>
        <button
          mat-flat-button
          [color]="data.tone === 'danger' ? 'warn' : 'primary'"
          [mat-dialog-close]="true"
          cdkFocusInitial
        >
          {{ data.confirmLabel ?? 'Confirmar' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 8px 4px;
      min-width: 320px;
    }
    .confirm-dialog__icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(63, 81, 181, 0.1);
      color: #3f51b5;
      margin-bottom: 8px;
    }
    .confirm-dialog.tone-danger .confirm-dialog__icon {
      background: rgba(244, 67, 54, 0.1);
      color: #f44336;
    }
    h2[mat-dialog-title] {
      margin-bottom: 4px;
    }
    mat-dialog-content {
      color: rgba(0, 0, 0, 0.6);
    }
  `],
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
