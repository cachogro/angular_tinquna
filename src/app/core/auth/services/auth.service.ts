// src/app/core/auth/services/auth.service.ts
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { APP_CONFIG } from '../../../config';
import {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RolCodigo,
  Usuario,
} from '../models/auth.models';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly apiUrl = `${APP_CONFIG.apiUrl}/auth`;
  private readonly LOGIN_PATH = '/authentication/login';

  // Estado reactivo centralizado con signals
  private readonly _user = signal<Usuario | null>(this.loadUserFromStorage());
  readonly user = this._user.asReadonly();

  readonly isAuthenticated = computed(
    () => !!this._user() && !!this.tokenStorage.getAccessToken(),
  );

  readonly roles = computed<string[]>(
    () => this._user()?.roles.map((r) => r.codigo) ?? [],
  );

  readonly isAdmin = computed(() =>
    this.roles().includes(RolCodigo.ADMINISTRADOR),
  );

  constructor() {
    if (!this.isBrowser) return; // en servidor no hay window/eventos de storage

    // Sincroniza el logout entre pestañas: si otra pestaña borra el token, esta también cierra sesión
    window.addEventListener('storage', (event) => {
      if (event.key === null) {
        // storage.clear() fue llamado en otra pestaña
        this._user.set(null);
      }
    });
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response) => this.persistSession(response)),
        catchError((err) => throwError(() => err)),
      );
  }

  /**
   * Ajusta la ruta '/refresh' y el nombre del campo si tu backend usa otro.
   * Se asume: POST /api/auth/refresh { refreshToken } -> { token, refreshToken }
   */
  refreshToken(): Observable<RefreshResponse> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    // Seteamos el header tal como lo pide tu RefreshTokenStrategy
    const headers = new HttpHeaders().set(
      'Authorization',
      `Bearer ${refreshToken}`,
    );
    return this.http
      .post<RefreshResponse>(`${this.apiUrl}/refresh_token`, {}, { headers })
      .pipe(
        tap((response) => {
          this.tokenStorage.setAccessToken(response.token);
          this.tokenStorage.setRefreshToken(response.refreshToken);
        }),
      );
  }

  logout(navigateToLogin = true): void {
    const refreshToken = this.tokenStorage.getRefreshToken();
    if (refreshToken) {
      // Revoca el refresh token en el backend. Best-effort: si falla (red caída,
      // token ya expirado, etc.) igual cerramos sesión localmente.
      const headers = new HttpHeaders().set(
        'Authorization',
        `Bearer ${refreshToken}`,
      );
      this.http
        .post(`${this.apiUrl}/logout`, {}, { headers })
        .pipe(catchError(() => throwError(() => null)))
        .subscribe();
    }

    this.tokenStorage.clear();
    this._user.set(null);
    if (navigateToLogin) {
      this.router.navigate([this.LOGIN_PATH]);
    }
  }

  hasRole(...codigos: string[]): boolean {
    const userRoles = this.roles();
    return codigos.some((c) => userRoles.includes(c));
  }

  getAccessToken(): string | null {
    return this.tokenStorage.getAccessToken();
  }

  /** true si el JWT ya expiró (o no se puede leer) */
  isAccessTokenExpired(): boolean {
    const token = this.tokenStorage.getAccessToken();
    if (!token) return true;
    const payload = this.decodeJwt(token);
    if (!payload?.exp) return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowInSeconds;
  }

  private persistSession(response: LoginResponse): void {
    this.tokenStorage.setAccessToken(response.token);
    this.tokenStorage.setRefreshToken(response.refreshToken);
    this.tokenStorage.setUserRaw(JSON.stringify(response.user));
    this._user.set(response.user);

    console.log('Sesión iniciada para usuario:', response.user);
  }

  private loadUserFromStorage(): Usuario | null {
    const raw = this.tokenStorage.getUserRaw();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  }

  private decodeJwt(
    token: string,
  ): { exp?: number; [key: string]: unknown } | null {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}
