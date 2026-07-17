import { Routes } from '@angular/router';

// ui
import { AppFormsComponent } from './forms/forms.component';

import { roleGuard } from 'src/app/core/auth/guards/role.guard';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { RecepcionMineralComponent } from './recepcion-mineral/recepcion-mineral.component';
// import { PanelUserFormComponent } from './panel-users/panel-user-form/panel-user-form.component';
// import { PanelUsersComponent } from './panel-users/panel-users.component';

export const UiComponentsRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'forms',
        component: AppFormsComponent,
      },
      {
        path: 'recepcion-minerales',
        component: RecepcionMineralComponent,
      },

      // {
      //   // <-- NUEVO: 'users' pasa de ruta simple a grupo con hijos
      //   path: 'users',
      //   canActivate: [roleGuard],
      //   data: { roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR] },
      //   children: [
      //     {
      //       path: '',
      //       component: PanelUsersComponent, // listado — admin y operador
      //     },
      //     {
      //       path: 'nuevo',
      //       component: PanelUserFormComponent, // crear — admin y operador
      //     },
      //     {
      //       path: 'editar/:id',
      //       component: PanelUserFormComponent,
      //       canActivate: [roleGuard],
      //       data: { roles: [RolCodigo.ADMINISTRADOR] }, // editar — SOLO admin
      //     },
      //   ],
      // },
    ],
  },
];
