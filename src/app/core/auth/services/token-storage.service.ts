// src/app/core/auth/services/token-storage.service.ts
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Aísla el mecanismo de almacenamiento de tokens.
 *
//  * SSR: en el servidor no existe sessionStorage, así que todas las operaciones
//  * verifican isPlatformBrowser() primero. En el servidor, get* devuelve null
//  * y set/clear no hacen nada (el estado real se hidrata en el cliente).
//  *
//  * NOTA DE SEGURIDAD:
//  * - Se usa sessionStorage en lugar de localStorage: el token se borra al
//  *   cerrar la pestaña/navegador, reduciendo la ventana de exposición ante XSS.
//  * - Ningún almacenamiento en el navegador (localStorage/sessionStorage) es
//  *   100% seguro contra XSS. La protección real contra robo de token viene de:
//  *     1) Angular sanitiza el DOM por defecto (no uses innerHTML con datos no confiables).
//  *     2) Configurar una Content-Security-Policy estricta en el servidor/hosting.
//  *     3) Idealmente, a futuro, mover el refreshToken a una cookie httpOnly +
//  *        Secure + SameSite=Strict emitida por el backend, para que JS nunca
//  *        pueda leerlo. Esto requiere cambios en el backend NestJS.
//  * - Mientras tanto, este servicio centraliza el acceso para que ese cambio
//  *   futuro solo toque este archivo.
//  */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly ACCESS_TOKEN_KEY = 'app_access_token';
  private readonly REFRESH_TOKEN_KEY = 'app_refresh_token';
  private readonly USER_KEY = 'app_user';

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    if (!this.isBrowser) return;
    sessionStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (!this.isBrowser) return;
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  getUserRaw(): string | null {
    if (!this.isBrowser) return null;
    return sessionStorage.getItem(this.USER_KEY);
  }

  setUserRaw(userJson: string): void {
    if (!this.isBrowser) return;
    sessionStorage.setItem(this.USER_KEY, userJson);
  }

  clear(): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
  }
}