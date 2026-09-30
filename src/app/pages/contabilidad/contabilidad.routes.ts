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
        // Gestión del kardex de un destinatario (antes era un diálogo).
        // Query params: tipo, idActor | idPersona | idCliente, nombre.
        path: 'kardex/gestionar',
        loadComponent: () =>
          import('./kardex/kardex-gestion/kardex-gestion.component').then(
            (m) => m.KardexGestionComponent,
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
        path: 'traspasos',
        loadComponent: () =>
          import('./traspasos/traspaso-list.component').then(
            (m) => m.TraspasoListComponent,
          ),
      },
      {
        path: 'fondo-rendir',
        loadComponent: () =>
          import('./fondo-rendir/fondo-rendir-list.component').then(
            (m) => m.FondoRendirListComponent,
          ),
      },
      {
        path: 'prestamos',
        loadComponent: () =>
          import('./prestamos/prestamo-list.component').then(
            (m) => m.PrestamoListComponent,
          ),
      },
      {
        path: 'boletas-pago',
        loadComponent: () =>
          import('./boletas-pago/boleta-list.component').then(
            (m) => m.BoletaListComponent,
          ),
      },
      {
        path: 'reportes/destino-gasto',
        loadComponent: () =>
          import('./reportes/reporte-destino-gasto.component').then(
            (m) => m.ReporteDestinoGastoComponent,
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
