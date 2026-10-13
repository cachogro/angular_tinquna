import { Routes } from '@angular/router';
// ui
import { RecepcionMineralComponent } from './recepcion-mineral/recepcion-mineral.component';
import { permisoGuard } from 'src/app/core/auth/guards/permiso.guard';
import { PERMISO } from 'src/app/core/auth/models/permisos';
import { RecepcionMineralFormComponent } from './recepcion-mineral/recepcion-mineral-form/recepcion-mineral-form.component';

export const UiComponentsRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'recepcion-minerales',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.RECEPCION] },
        children: [
          {
            path: '',
            component: RecepcionMineralComponent, // listado
          },
          {
            path: 'nuevo',
            component: RecepcionMineralFormComponent, // crear
          },
          {
            path: 'editar/:id',
            component: RecepcionMineralFormComponent,
            canActivate: [permisoGuard],
            data: { permisos: [PERMISO.RECEPCION_GESTIONAR] }, // editar — permiso aparte
          },
        ],
      },

      {
        path: 'promedios',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.PROMEDIOS] },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./promedios/promedio-list.component').then(
                (m) => m.PromedioListComponent,
              ),
          },
          {
            path: 'nuevo',
            loadComponent: () =>
              import('./promedios/promedio-form/promedio-form.component').then(
                (m) => m.PromedioFormComponent,
              ),
          },
          {
            path: 'editar/:id',
            loadComponent: () =>
              import('./promedios/promedio-form/promedio-form.component').then(
                (m) => m.PromedioFormComponent,
              ),
          },
        ],
      },

      {
        path: 'ventas-lote',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.VENTAS_LOTE] },
        loadComponent: () =>
          import('./ventas-lote/venta-lote-list.component').then(
            (m) => m.VentaLoteListComponent,
          ),
      },

      {
        path: 'reportes',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.REPORTES_COMERCIO] },
        loadComponent: () =>
          import('./reportes/reporte-recepcion-mineral.component').then(
            (m) => m.ReporteRecepcionMineralComponent,
          ),
      },

      {
        path: 'reportes-promedios',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.REPORTES_COMERCIO] },
        loadComponent: () =>
          import('./reportes/reporte-promedio/reporte-promedio.component').then(
            (m) => m.ReportePromedioComponent,
          ),
      },

      {
        path: 'reportes-valorizacion',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.REPORTES_COMERCIO] },
        loadComponent: () =>
          import('./reportes/reporte-valorizacion.component').then(
            (m) => m.ReporteValorizacionComponent,
          ),
      },

      {
        path: 'valorizacion',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.VALORIZACION] },
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
