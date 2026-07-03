// src/app/core/auth/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// Endpoints que NUNCA deben llevar Authorization (evita loops / envíos innecesarios)
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isPublic = PUBLIC_ENDPOINTS.some((endpoint) => req.url.includes(endpoint));
  const token = authService.getAccessToken();

  if (isPublic || !token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authReq);
};
