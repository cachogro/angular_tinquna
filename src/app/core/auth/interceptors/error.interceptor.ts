// src/app/core/auth/interceptors/error.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Estado compartido entre todas las peticiones que pasan por este interceptor
let isRefreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshedToken$.next(null);

        return authService.refreshToken().pipe(
          switchMap((response) => {
            isRefreshing = false;
            refreshedToken$.next(response.token);
            return next(
              req.clone({ setHeaders: { Authorization: `Bearer ${response.token}` } })
            );
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            authService.logout(); // refresh token también expiró/inválido -> logout total
            return throwError(() => refreshError);
          })
        );
      }

      // Ya hay un refresh en curso: esperar a que termine y reintentar con el nuevo token
      return refreshedToken$.pipe(
        filter((token): token is string => token !== null),
        take(1),
        switchMap((token) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
        )
      );
    })
  );
};
