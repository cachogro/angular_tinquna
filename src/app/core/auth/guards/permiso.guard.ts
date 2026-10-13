import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Deja pasar si el usuario tiene al menos uno de los permisos de la ruta.
 *
 * {
 *   path: 'recibos',
 *   canActivate: [permisoGuard],
 *   data: { permisos: [PERMISO.RECIBOS] },
 *   loadComponent: () => import('./recibos/recibo-list.component')...
 * }
 */
export const permisoGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const permisos = route.data['permisos'] as string[] | undefined;

  if (!permisos || permisos.length === 0) {
    return true;
  }

  if (authService.hasPermiso(...permisos)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/**
 * Igual que permisoGuard, pero para el padre de un módulo lazy
 * (`loadChildren`). Con canMatch, si el usuario no tiene ningún permiso del
 * módulo el router ni siquiera descarga su código.
 *
 * {
 *   path: 'contabilidad',
 *   canMatch: [permisoMatchGuard],
 *   data: { permisos: PERMISOS_MODULO.contabilidad },
 *   loadChildren: () => import('./contabilidad.routes')...
 * }
 */
export const permisoMatchGuard: CanMatchFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    const url = router.getCurrentNavigation()?.extractedUrl.toString();
    return router.createUrlTree(['/authentication/login'], {
      queryParams: url ? { returnUrl: url } : {},
    });
  }

  const permisos = route.data?.['permisos'] as string[] | undefined;

  if (!permisos || permisos.length === 0) {
    return true;
  }

  if (authService.hasPermiso(...permisos)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
