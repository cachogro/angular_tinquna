// src/app/core/auth/services/inactivity.service.ts
import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, NgZone, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { fromEvent, merge, Subscription, interval } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { APP_CONFIG } from '../../../config';
import { AuthService } from './auth.service';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
const LAST_ACTIVITY_KEY = 'app_last_activity';

/**
 * Cierra la sesión automáticamente tras N minutos sin actividad del usuario,
 * mostrando un aviso previo con cuenta regresiva.
 *
 * - Se activa/desactiva solo, según authService.isAuthenticated().
 * - No hace nada en el servidor (SSR): todo lo que usa window/localStorage
 *   está protegido con isPlatformBrowser().
 * - Sincroniza la actividad entre pestañas vía localStorage: si el usuario
 *   trabaja en la pestaña A, la pestaña B (aunque esté inactiva) no cierra sesión.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly authService = inject(AuthService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly timeoutMs = APP_CONFIG.inactivity.timeoutMinutes * 60 * 1000;
  private readonly warningMs = APP_CONFIG.inactivity.warningMinutes * 60 * 1000;

  private lastActivityTime = Date.now();
  private activitySub?: Subscription;
  private tickSub?: Subscription;

  /** true mientras se muestra el aviso de "tu sesión está por expirar" */
  readonly showWarning = signal(false);
  /** segundos restantes para el cierre automático, mientras showWarning() es true */
  readonly secondsRemaining = signal(0);

  constructor() {
    if (!this.isBrowser) return; // en el servidor no hay nada que vigilar

    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.start();
      } else {
        this.stop();
      }
    });

    this.destroyRef.onDestroy(() => this.stop());

    window.addEventListener('storage', (event) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        this.lastActivityTime = Number(event.newValue);
        this.showWarning.set(false);
      }
    });
  }

  /** Llamado por el botón "Seguir conectado" del modal de aviso */
  extendSession(): void {
    this.registerActivity();
    this.showWarning.set(false);
  }

  private start(): void {
    if (this.activitySub) return; // ya está corriendo

    this.registerActivity();

    // Escuchar actividad del usuario fuera de la zona de Angular (rendimiento)
    this.ngZone.runOutsideAngular(() => {
      this.activitySub = merge(...ACTIVITY_EVENTS.map((evt) => fromEvent(window, evt)))
        .pipe(throttleTime(2000))
        .subscribe(() => {
          // Si el aviso ya está visible, la actividad debe pasar por extendSession()
          // dentro del modal (evita que un scroll accidental lo cierre sin que el
          // usuario confirme). Si no está visible, simplemente se refresca el timer.
          if (!this.showWarning()) {
            this.ngZone.run(() => this.registerActivity());
          }
        });

      // Chequeo cada segundo del tiempo transcurrido
      this.tickSub = interval(1000).subscribe(() => this.ngZone.run(() => this.checkInactivity()));
    });
  }

  private stop(): void {
    this.activitySub?.unsubscribe();
    this.tickSub?.unsubscribe();
    this.activitySub = undefined;
    this.tickSub = undefined;
    this.showWarning.set(false);
  }

  private registerActivity(): void {
    this.lastActivityTime = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, String(this.lastActivityTime));
  }

  private checkInactivity(): void {
    const elapsed = Date.now() - this.lastActivityTime;
    const remainingMs = this.timeoutMs - elapsed;

    if (remainingMs <= 0) {
      this.showWarning.set(false);
      this.authService.logout();
      return;
    }

    if (remainingMs <= this.warningMs) {
      this.showWarning.set(true);
      this.secondsRemaining.set(Math.ceil(remainingMs / 1000));
    } else if (this.showWarning()) {
      this.showWarning.set(false);
    }
  }
}
