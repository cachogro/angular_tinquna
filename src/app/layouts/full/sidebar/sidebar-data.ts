import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  // RUTAS PADRE
  {
    navCap: 'Home',
  },
  {
    displayName: 'Dashboard',
    iconName: 'solar:widget-add-line-duotone',
    route: '/dashboard',
  },
  {
    navCap: 'Comercio Interno',
    divider: true,
  },
  {
    displayName: 'Recepcion de Minerales',
    iconName: 'solar:file-text-line-duotone',
    route: '/ui-components/recepcion-minerales',
  },
  {
    displayName: 'Valorizacion',
    iconName: 'solar:file-text-line-duotone',
    route: '/ui-components/valorizacion',
  },
  {
    displayName: 'Promedios',
    iconName: 'solar:calculator-line-duotone',
    route: '/ui-components/promedios',
  },
  {
    displayName: 'Ventas de Lote',
    iconName: 'solar:hand-money-line-duotone',
    route: '/ui-components/ventas-lote',
  },
  {
    displayName: 'Reportes',
    iconName: 'solar:file-text-line-duotone',
    route: '/ui-components/reportes',
    children: [
      {
        displayName: 'Recepción de Minerales',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: '/ui-components/reportes',
      },
      {
        displayName: 'Valorización',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: '/ui-components/reportes-valorizacion',
      },
    ],
  },
  {
    navCap: 'Contabilidad',
    divider: true,
  },
  {
    displayName: 'Recibos',
    iconName: 'solar:bill-list-line-duotone',
    route: '/contabilidad/recibos',
  },
  {
    displayName: 'Traspasos',
    iconName: 'solar:transfer-horizontal-line-duotone',
    route: '/contabilidad/traspasos',
  },
  {
    displayName: 'Fondo a Rendir Cuentas',
    iconName: 'solar:wallet-money-line-duotone',
    route: '/contabilidad/fondo-rendir',
  },
  {
    displayName: 'Libreta Bancaria',
    iconName: 'solar:notebook-line-duotone',
    route: '/contabilidad/libreta-bancaria',
  },
  {
    displayName: 'Kardex',
    iconName: 'solar:document-text-line-duotone',
    route: '/contabilidad/kardex',
  },
  {
    displayName: 'Caja de Flujo',
    iconName: 'solar:safe-square-line-duotone',
    route: '/contabilidad/caja-flujo',
  },
  {
    displayName: 'Préstamos al Personal',
    iconName: 'solar:hand-money-line-duotone',
    route: '/contabilidad/prestamos',
  },
  {
    displayName: 'Boletas de Pago',
    iconName: 'solar:bill-check-line-duotone',
    route: '/contabilidad/boletas-pago',
  },

  {
    displayName: 'Reporte por Destino',
    iconName: 'solar:chart-2-line-duotone',
    route: '/contabilidad/reportes/destino-gasto',
  },

  //-----------MODULO LOGUIN NO SE PUEDE ACCEDER SI UYA ESTAS LOGUEADO
  // {
  //   divider: true,
  //   navCap: 'Auth',
  // },
  // {
  //   displayName: 'Login',
  //   iconName: 'solar:lock-keyhole-minimalistic-line-duotone',
  //   route: '/authentication',
  //   children: [
  //     {
  //       displayName: 'Login',
  //        subItemIcon: true,
  //       iconName: 'solar:round-alt-arrow-right-line-duotone',
  //       route: '/authentication/login',
  //     },
  //   ],
  // },

  {
    divider: true,
    navCap: 'Configuraciones',
  },
  {
    displayName: 'Actores y Clientes',
    iconName: 'solar:users-group-rounded-line-duotone',
    route: '/configuraciones/actores-clientes',
  },
  {
    displayName: 'Configuraciones',
    iconName: 'solar:lock-keyhole-minimalistic-line-duotone',
    route: '/authentication',
    children: [
      {
        displayName: 'Gestion de Usuarios',
        subItemIcon: true,
        iconName: 'solar:user-plus-rounded-line-duotone',
        route: '/configuraciones/gestion-usuarios',
        roles: [RolCodigo.ADMINISTRADOR],
      },
      {
        displayName: 'Parametricas',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: '/configuraciones/parametricas',
        roles: [RolCodigo.ADMINISTRADOR],
      },
      {
        displayName: 'Historial de Accesos',
        subItemIcon: true,
        iconName: 'solar:shield-user-line-duotone',
        route: '/configuraciones/historial-accesos',
        roles: [RolCodigo.ADMINISTRADOR],
      },
    ],
  },
];
