import { Routes } from '@angular/router';
// ui
import { RecepcionMineralComponent } from './recepcion-mineral/recepcion-mineral.component';
import { roleGuard } from 'src/app/core/auth/guards/role.guard';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { RecepcionMineralFormComponent } from './recepcion-mineral/recepcion-mineral-form/recepcion-mineral-form.component';

export const UiComponentsRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'recepcion-minerales',
        canActivate: [roleGuard], // <-- NUEVO
        data: {
          roles: [
            RolCodigo.ADMINISTRADOR,
            RolCodigo.OPERADOR,
            RolCodigo.TECNICO,
          ],
        }, // <-- NUEVO
        children: [
          {
            path: '',
            component: RecepcionMineralComponent, // listado — los 3 roles
          },
          {
            path: 'nuevo',
            component: RecepcionMineralFormComponent, // crear — los 3 roles
          },
          {
            path: 'editar/:id',
            component: RecepcionMineralFormComponent,
            canActivate: [roleGuard],
            data: { roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR] }, // editar — SIN técnico
          },
        ],
      },

      {
        path: 'reportes',
        loadComponent: () =>
          import('./reportes/reporte-recepcion-mineral.component').then(
            (m) => m.ReporteRecepcionMineralComponent,
          ),
      },

      {
        path: 'reportes-valorizacion',
        loadComponent: () =>
          import('./reportes/reporte-valorizacion.component').then(
            (m) => m.ReporteValorizacionComponent,
          ),
      },

      {
        path: 'valorizacion',
        canActivate: [roleGuard],
        data: {
          // Valorización: acceso solo para ADMINISTRADOR y OPERADOR (sin TÉCNICO)
          roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR],
        },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./valorizacion/valorizacion.component').then(
                (m) => m.ValorizacionComponent,
              ),
          },
          {
            path: 'editar/:id',
            loadComponent: () =>
              import('./valorizacion/valorizacion-form/valorizacion-form.component').then(
                (m) => m.ValorizacionFormComponent,
              ),
          },
        ],
      },
    ],
  },
];
