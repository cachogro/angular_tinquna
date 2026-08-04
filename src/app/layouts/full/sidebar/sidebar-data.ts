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
    displayName: 'Reportes',
    iconName: 'solar:file-text-line-duotone',
    route: '/ui-components/reportes',
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
    displayName: 'Configuraciones',
    iconName: 'solar:lock-keyhole-minimalistic-line-duotone',
    route: '/authentication',
    children: [
      {
        displayName: 'Gestion de Usuarios',
        subItemIcon: true,
        iconName: 'solar:user-plus-rounded-line-duotone',
        route: '/configuraciones/gestion-usuarios',
      },
      {
        displayName: 'Parametricas',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: '/configuraciones/parametricas',
      },

      {
        displayName: 'Gestion Clientes',
        subItemIcon: true,
        iconName: 'solar:user-plus-rounded-line-duotone',
        route: '/configuraciones/gestion-clientes',
      },
    ],
  },
];
