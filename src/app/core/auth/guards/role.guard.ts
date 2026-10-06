// src/app/core/auth/guards/role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Uso en rutas:
 *
 * {
 *   path: 'usuarios',
 *   canActivate: [authGuard, roleGuard],
 *   data: { roles: [RolCodigo.ADMINISTRADOR] },
 *   loadComponent: () => import('./usuarios.component')...
 * }
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as string[] | undefined;

  // Si la ruta no define roles, cualquier usuario autenticado pasa
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (authService.hasRole(...allowedRoles)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']); // ajusta esto si creas una página de "no autorizado"
};

/**
 * Igual que roleGuard, pero para el padre de un módulo lazy (`loadChildren`).
 * Con canMatch, si el usuario no tiene el rol el router ni siquiera descarga
 * el código del módulo; con canActivate lo descargaría y recién después
 * negaría el acceso.
 *
 * {
 *   path: 'contabilidad',
 *   canMatch: [roleMatchGuard],
 *   data: { roles: [RolCodigo.ADMINISTRADOR] },
 *   loadChildren: () => import('./contabilidad.routes')...
 * }
 */
export const roleMatchGuard: CanMatchFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // canMatch corre antes que el authGuard del layout: sin sesión se manda
  // al login conservando la URL pedida, igual que haría authGuard.
  if (!authService.isAuthenticated()) {
    const url = router.getCurrentNavigation()?.extractedUrl.toString();
    return router.createUrlTree(['/authentication/login'], {
      queryParams: url ? { returnUrl: url } : {},
    });
  }

  const allowedRoles = route.data?.['roles'] as string[] | undefined;

  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (authService.hasRole(...allowedRoles)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
