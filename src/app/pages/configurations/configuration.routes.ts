import { Routes } from '@angular/router';
import { permisoGuard } from 'src/app/core/auth/guards/permiso.guard';
import { PERMISO } from 'src/app/core/auth/models/permisos';
import { PanelUserFormComponent } from './gestion-usuarios/panel-user-form/panel-user-form.component';
import { GestionUsuariosComponent } from './gestion-usuarios/gestion-usuarios.component';

export const ConfiguracionesRoutes: Routes = [
  {
    path: '',
    children: [
      // {
      //   path: '',
      //   redirectTo: 'parametricas',
      //   pathMatch: 'full',
      // },
      {
        path: 'parametricas',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.PARAMETRICAS] },
        loadComponent: () =>
          import('./parametricas/parametricas.component').then(
            (m) => m.ParametricasComponent,
          ),
      },

      {
        path: 'gestion-usuarios',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.USUARIOS] }, // solo administrador
        children: [
          {
            path: '',
            component: GestionUsuariosComponent,
          },
          {
            path: 'nuevo',
            component: PanelUserFormComponent,
          },
          {
            path: 'editar/:id',
            component: PanelUserFormComponent,
          },
        ],
      },

      {
        path: 'actores-clientes',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.ACTORES_CLIENTES] },
        loadComponent: () =>
          import('./actores-clientes/actores-clientes.component').then(
            (m) => m.ActoresClientesComponent,
          ),
      },

      {
        // Compatibilidad: el módulo pasó a llamarse "Actores y Clientes".
        path: 'gestion-clientes',
        redirectTo: 'actores-clientes',
        pathMatch: 'full',
      },

      {
        path: 'historial-accesos',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.HISTORIAL_ACCESOS] }, // solo administrador
        loadComponent: () =>
          import('./historial-accesos/historial-accesos.component').then(
            (m) => m.HistorialAccesosComponent,
          ),
      },

      {
        path: 'roles-permisos',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.ROLES_PERMISOS] }, // solo administrador
        loadComponent: () =>
          import('./roles-permisos/roles-permisos.component').then(
            (m) => m.RolesPermisosComponent,
          ),
      },
    ],
  },
];
