import { Routes } from '@angular/router';

export const ContabilidadRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'libreta-bancaria',
        loadComponent: () =>
          import('./libreta-bancaria/libreta-bancaria.component').then(
            (m) => m.LibretaBancariaComponent,
          ),
      },
      {
        path: 'kardex',
        loadComponent: () =>
          import('./kardex/kardex-list.component').then(
            (m) => m.KardexListComponent,
          ),
      },
      {
        path: 'recibos',
        loadComponent: () =>
          import('./recibos/recibo-list.component').then(
            (m) => m.ReciboListComponent,
          ),
      },
      {
        path: 'caja-flujo',
        loadComponent: () =>
          import('./caja-flujo/caja-flujo.component').then(
            (m) => m.CajaFlujoComponent,
          ),
      },
      {
        path: '',
        redirectTo: 'libreta-bancaria',
        pathMatch: 'full',
      },
    ],
  },
];
