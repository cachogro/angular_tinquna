import { Routes } from '@angular/router';

// ui
import { AppBadgeComponent } from './badge/badge.component';
import { AppListsComponent } from './lists/lists.component';
import { AppMenuComponent } from './menu/menu.component';
import { AppTooltipsComponent } from './tooltips/tooltips.component';
import { AppFormsComponent } from './forms/forms.component';
import { AppTablesComponent } from './tables/tables.component';
import { PanelUsersComponent } from './panel-users/panel-users.component';
import { roleGuard } from 'src/app/core/auth/guards/role.guard';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { PanelUserFormComponent } from './panel-users/panel-user-form/panel-user-form.component';

export const UiComponentsRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'badge',
        component: AppBadgeComponent,
      },
      // {
      //   path: 'users',
      //   component: PanelUsersComponent,
      // },
      {
        path: 'lists',
        component: AppListsComponent,
      },
      {
        path: 'menu',
        component: AppMenuComponent,
      },
      {
        path: 'tooltips',
        component: AppTooltipsComponent,
      },
      {
        path: 'forms',
        component: AppFormsComponent,
      },
      {
        path: 'tables',
        component: AppTablesComponent,
      },
      {
        // <-- NUEVO: 'users' pasa de ruta simple a grupo con hijos
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR] },
        children: [
          {
            path: '',
            component: PanelUsersComponent, // listado — admin y operador
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
    ],
  },
];
