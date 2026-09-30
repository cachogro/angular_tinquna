import { Injectable, computed, signal } from '@angular/core';

/** Milisegundos que debe tardar una petición antes de mostrar el loader (evita parpadeos). */
const SHOW_DELAY_MS = 300;

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pending = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly _visible = signal(false);

  readonly visible = computed(() => this._visible());

  start(): void {
    this.pending++;
    if (this.pending === 1 && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this._visible.set(true);
      }, SHOW_DELAY_MS);
    }
  }

  stop(): void {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending > 0) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._visible.set(false);
  }
}
