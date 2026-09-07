// TU app.routes.ts, con SOLO las líneas marcadas "// <-- NUEVO" agregadas
import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { guestGuard, authGuard } from './core/auth/guards/auth.guard'; // <-- NUEVO

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'authentication/login',
    pathMatch: 'full',
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        canActivate: [guestGuard], // <-- NUEVO: si ya está logueado, no puede ver el login
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes,
          ),
      },
    ],
  },
  {
    path: '',
    component: FullComponent,
    canActivate: [authGuard], // <-- NUEVO: protege TODO lo que cuelga de este layout (dashboard, ui-components, extra)
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'ui-components',
        loadChildren: () =>
          import('./pages/ui-components/ui-components.routes').then(
            (m) => m.UiComponentsRoutes,
          ),
      },
      {
        path: 'configuraciones',
        loadChildren: () =>
          import('./pages/configurations/configuration.routes').then(
            (m) => m.ConfiguracionesRoutes,
          ),
      },
      {
        path: 'contabilidad',
        loadChildren: () =>
          import('./pages/contabilidad/contabilidad.routes').then(
            (m) => m.ContabilidadRoutes,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/login',
  },
];

/*
 * IMPORTANTE sobre canActivate en una ruta PADRE (la del FullComponent):
 * Angular ejecuta el guard UNA VEZ para esa ruta padre, y si retorna true,
 * TODOS sus hijos (dashboard, ui-components, extra) quedan protegidos
 * automáticamente. No necesitas repetir authGuard en cada hijo.
 *
 * Si más adelante quieres que SOLO "dashboard/usuarios" (por ejemplo) sea
 * exclusivo de ADMINISTRADOR, agrega roleGuard + data:{roles:[...]} en esa
 * ruta específica dentro de pages.routes.ts (ver rutas-ejemplo.md, sección 2).
 */
