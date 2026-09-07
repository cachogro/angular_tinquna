import { Routes } from '@angular/router';
import { roleGuard } from 'src/app/core/auth/guards/role.guard';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
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
        loadComponent: () =>
          import('./parametricas/parametricas.component').then(
            (m) => m.ParametricasComponent,
          ),
      },

      {
        // <-- NUEVO: 'users' pasa de ruta simple a grupo con hijos
        path: 'gestion-usuarios',
        canActivate: [roleGuard],
        data: { roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR] },
        children: [
          {
            path: '',
            component: GestionUsuariosComponent, // listado — admin y operador
          },
          {
            path: 'nuevo',
            component: PanelUserFormComponent, // crear — admin y operador
          },
          {
            path: 'editar/:id',
            component: PanelUserFormComponent,
            canActivate: [roleGuard],
            data: { roles: [RolCodigo.ADMINISTRADOR] }, // editar — SOLO admin
          },
        ],
      },

      {
        path: 'actores-clientes',
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
        canActivate: [roleGuard],
        data: { roles: [RolCodigo.ADMINISTRADOR] },
        loadComponent: () =>
          import('./historial-accesos/historial-accesos.component').then(
            (m) => m.HistorialAccesosComponent,
          ),
      },
    ],
  },
];
