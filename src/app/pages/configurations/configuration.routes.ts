
import { Routes } from '@angular/router';

export const ConfiguracionesRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        redirectTo: 'parametricas',
        pathMatch: 'full'
      },
      {
        path: 'parametricas',
        loadComponent: () => import('./parametricas/parametricas.component').then(m => m.ParametricasComponent)
      },
      {
        path: 'gestion-usuarios',
        loadComponent: () => import('./gestion-usuarios/gestion-usuarios.component').then(m => m.GestionUsuariosComponent)
      }
    ]
  }
];
