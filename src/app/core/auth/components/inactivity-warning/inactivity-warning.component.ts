// src/app/core/auth/components/inactivity-warning/inactivity-warning.component.ts
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { InactivityService } from '../../services/inactivity.service';

@Component({
  selector: 'app-inactivity-warning',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (inactivityService.showWarning()) {
      <div class="inactivity-overlay">
        <div class="inactivity-modal">
          <h3>¿Sigues ahí?</h3>
          <p>
            Tu sesión se cerrará por inactividad en
            <strong>{{ inactivityService.secondsRemaining() }}</strong> segundos.
          </p>
          <div class="inactivity-actions">
            <button type="button" class="btn-primary" (click)="inactivityService.extendSession()">
              Seguir conectado
            </button>
            <button type="button" class="btn-secondary" (click)="authService.logout()">
              Cerrar sesión ahora
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .inactivity-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .inactivity-modal {
      background: #fff;
      border-radius: 8px;
      padding: 24px 28px;
      max-width: 360px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }
    .inactivity-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      justify-content: center;
    }
    .btn-primary, .btn-secondary {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-primary { background: #4f46e5; color: #fff; }
    .btn-secondary { background: #e5e7eb; color: #111827; }
  `],
})
export class InactivityWarningComponent {
  readonly inactivityService = inject(InactivityService);
  readonly authService = inject(AuthService);
}
