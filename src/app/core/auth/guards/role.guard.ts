// src/app/core/auth/guards/role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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
