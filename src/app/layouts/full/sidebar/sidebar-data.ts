import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
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
    displayName: 'Badge',
    iconName: 'solar:archive-minimalistic-line-duotone',
    route: '/ui-components/badge',
  },
  {
    displayName: 'Lists',
    iconName: 'solar:bookmark-square-minimalistic-line-duotone',
    route: '/ui-components/lists',
  },
  {
    displayName: 'Menu',
    iconName: 'solar:file-text-line-duotone',
    route: '/ui-components/menu',
  },
  {
    displayName: 'Tooltips',
    iconName: 'solar:text-field-focus-line-duotone',
    route: '/ui-components/tooltips',
  },
  {
    displayName: 'Recepcion de Minerales',
    iconName: 'solar:file-text-line-duotone',
    route: '/ui-components/recepcion-minerales',
  },

  // {
  //   displayName: 'Tables',
  //   iconName: 'solar:tablet-line-duotone',
  //   route: '/ui-components/tables',
  // },

  // {
  //   divider: true,
  //   navCap: 'Pages',
  // },

  // {
  //   navCap: 'Extra',
  //   divider: true
  // },
  // {
  //   displayName: 'Icons',
  //   iconName: 'solar:sticker-smile-circle-2-line-duotone',
  //   route: '/extra/icons',
  // },
  // {
  //   displayName: 'Sample Page',
  //   iconName: 'solar:planet-3-line-duotone',
  //   route: '/extra/sample-page',
  // },

  // {
  //   divider: true,
  //   navCap: 'Tables',
  // },
  // {
  //   displayName: 'Tables',
  //   iconName: 'solar:tablet-line-duotone',
  //   route: 'tables',
  //   chip: true,
  //   children: [
  //     {
  //       displayName: 'Basic Table',
  //        subItemIcon: true,
  //       iconName: 'solar:round-alt-arrow-right-line-duotone',
  //       route: 'https://matdash-angular-main.netlify.app/tables/basic-table',
  //       external: true,
  //       chip: true,
  //       chipClass: 'bg-light-secondary text-secondary',
  //       chipContent: 'PRO',
  //     },

  //   ],
  // },

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
  // {
  //   displayName: 'Register',
  //   iconName: 'solar:user-plus-rounded-line-duotone',
  //   route: '/authentication',
  //   children: [
  //     {
  //       displayName: 'Register',
  //        subItemIcon: true,
  //       iconName: 'solar:round-alt-arrow-right-line-duotone',
  //       route: '/authentication/register',
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
        iconName: 'solar:round-alt-arrow-right-line-duotone',
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
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: '/configuraciones/gestion-clientes',
      },
    ],
  },
  //  {
  //   divider: true,
  //   navCap: 'usuarios',
  // },

  // {
  //   displayName: 'Panel de Usuarios',
  //   iconName: 'solar:danger-circle-line-duotone',
  //   route: '/ui-components/users',
  //   roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR], // <-- NUEVO
  //   // children: [
  //   //   {
  //   //     displayName: 'panel USER',
  //   //     subItemIcon: true,
  //   //     iconName: 'solar:round-alt-arrow-right-line-duotone',
  //   //     route: '/configuraciones/gestion-usuarios',
  //   //   },
  //   //   {
  //   //     displayName: 'Parametricas',
  //   //     subItemIcon: true,
  //   //     iconName: 'solar:round-alt-arrow-right-line-duotone',
  //   //     route: '/configuraciones/parametricas',
  //   //   },
  //   // ],
  // },

  // {
  //   displayName: 'Register',
  //   iconName: 'solar:user-plus-rounded-line-duotone',
  //   route: '/authentication',
  //   children: [
  //     {
  //       displayName: 'Register',
  //        subItemIcon: true,
  //       iconName: 'solar:round-alt-arrow-right-line-duotone',
  //       route: '/authentication/register',
  //     },
  //   ],
  // },
];
