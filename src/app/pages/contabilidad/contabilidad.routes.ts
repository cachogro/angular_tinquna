import { Routes } from '@angular/router';
import { permisoGuard } from 'src/app/core/auth/guards/permiso.guard';
import { PERMISO } from 'src/app/core/auth/models/permisos';

export const ContabilidadRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'libreta-bancaria',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.LIBRETA_BANCARIA] },
        loadComponent: () =>
          import('./libreta-bancaria/libreta-bancaria.component').then(
            (m) => m.LibretaBancariaComponent,
          ),
      },
      {
        path: 'kardex',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.KARDEX] },
        loadComponent: () =>
          import('./kardex/kardex-list.component').then(
            (m) => m.KardexListComponent,
          ),
      },
      {
        // Gestión del kardex de un destinatario (antes era un diálogo).
        // Query params: tipo, idActor | idPersona | idCliente, nombre.
        path: 'kardex/gestionar',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.KARDEX] },
        loadComponent: () =>
          import('./kardex/kardex-gestion/kardex-gestion.component').then(
            (m) => m.KardexGestionComponent,
          ),
      },
      {
        path: 'recibos',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.RECIBOS] },
        loadComponent: () =>
          import('./recibos/recibo-list.component').then(
            (m) => m.ReciboListComponent,
          ),
      },
      {
        path: 'caja-flujo',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.CAJA_FLUJO] },
        loadComponent: () =>
          import('./caja-flujo/caja-flujo.component').then(
            (m) => m.CajaFlujoComponent,
          ),
      },
      {
        path: 'traspasos',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.TRASPASOS] },
        loadComponent: () =>
          import('./traspasos/traspaso-list.component').then(
            (m) => m.TraspasoListComponent,
          ),
      },
      {
        path: 'fondo-rendir',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.FONDO_RENDIR] },
        loadComponent: () =>
          import('./fondo-rendir/fondo-rendir-list.component').then(
            (m) => m.FondoRendirListComponent,
          ),
      },
      {
        path: 'prestamos',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.PRESTAMOS] },
        loadComponent: () =>
          import('./prestamos/prestamo-list.component').then(
            (m) => m.PrestamoListComponent,
          ),
      },
      {
        path: 'boletas-pago',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.BOLETAS_PAGO] },
        loadComponent: () =>
          import('./boletas-pago/boleta-list.component').then(
            (m) => m.BoletaListComponent,
          ),
      },
      {
        path: 'reportes/plan-cuentas',
        canActivate: [permisoGuard],
        data: { permisos: [PERMISO.REPORTE_PLAN_CUENTAS] },
        loadComponent: () =>
          import('./reportes/reporte-plan-cuentas.component').then(
            (m) => m.ReportePlanCuentasComponent,
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
