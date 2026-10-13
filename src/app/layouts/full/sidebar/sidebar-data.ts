import { PERMISO, PERMISOS_MODULO } from 'src/app/core/auth/models/permisos';
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
    permisos: PERMISOS_MODULO.comercioInterno,
    divider: true,
  },
  {
    displayName: 'Recepcion de Minerales',
    iconName: 'solar:inbox-in-line-duotone',
    route: '/ui-components/recepcion-minerales',
    permisos: [PERMISO.RECEPCION],
  },
  {
    displayName: 'Valorizacion',
    iconName: 'solar:tag-price-line-duotone',
    route: '/ui-components/valorizacion',
    permisos: [PERMISO.VALORIZACION],
  },
  {
    displayName: 'Promedios',
    iconName: 'solar:calculator-line-duotone',
    route: '/ui-components/promedios',
    permisos: [PERMISO.PROMEDIOS],
  },
  {
    displayName: 'Ventas de Lote',
    iconName: 'solar:cart-large-2-line-duotone',
    route: '/ui-components/ventas-lote',
    permisos: [PERMISO.VENTAS_LOTE],
  },
  {
    displayName: 'Reportes',
    iconName: 'solar:documents-line-duotone',
    route: '/ui-components/reportes',
    permisos: [PERMISO.REPORTES_COMERCIO],
    children: [
      {
        displayName: 'Recepción de Minerales',
        subItemIcon: true,
        iconName: 'solar:inbox-archive-line-duotone',
        route: '/ui-components/reportes',
      },
      {
        displayName: 'Valorización',
        subItemIcon: true,
        iconName: 'solar:dollar-minimalistic-line-duotone',
        route: '/ui-components/reportes-valorizacion',
      },
      {
        displayName: 'Promedios',
        subItemIcon: true,
        iconName: 'solar:graph-new-line-duotone',
        route: '/ui-components/reportes-promedios',
      },
    ],
  },
  {
    navCap: 'Contabilidad',
    permisos: PERMISOS_MODULO.contabilidad,
    divider: true,
  },
  {
    displayName: 'Recibos',
    iconName: 'solar:bill-list-line-duotone',
    route: '/contabilidad/recibos',
    permisos: [PERMISO.RECIBOS],
  },
  {
    displayName: 'Traspasos',
    iconName: 'solar:transfer-horizontal-line-duotone',
    route: '/contabilidad/traspasos',
    permisos: [PERMISO.TRASPASOS],
  },
  {
    displayName: 'Fondo a Rendir Cuentas',
    iconName: 'solar:wallet-money-line-duotone',
    route: '/contabilidad/fondo-rendir',
    permisos: [PERMISO.FONDO_RENDIR],
  },
  {
    displayName: 'Libreta Bancaria',
    iconName: 'solar:notebook-line-duotone',
    route: '/contabilidad/libreta-bancaria',
    permisos: [PERMISO.LIBRETA_BANCARIA],
  },
  {
    displayName: 'Kardex',
    iconName: 'solar:clipboard-text-line-duotone',
    route: '/contabilidad/kardex',
    permisos: [PERMISO.KARDEX],
  },
  {
    displayName: 'Caja de Flujo',
    iconName: 'solar:safe-square-line-duotone',
    route: '/contabilidad/caja-flujo',
    permisos: [PERMISO.CAJA_FLUJO],
  },
  {
    displayName: 'Préstamos al Personal',
    iconName: 'solar:hand-money-line-duotone',
    route: '/contabilidad/prestamos',
    permisos: [PERMISO.PRESTAMOS],
  },
  {
    displayName: 'Boletas de Pago',
    iconName: 'solar:bill-check-line-duotone',
    route: '/contabilidad/boletas-pago',
    permisos: [PERMISO.BOLETAS_PAGO],
  },

  {
    displayName: 'Reporte por Plan de Cuentas',
    iconName: 'solar:chart-2-line-duotone',
    route: '/contabilidad/reportes/plan-cuentas',
    permisos: [PERMISO.REPORTE_PLAN_CUENTAS],
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
    permisos: PERMISOS_MODULO.configuraciones,
  },
  {
    displayName: 'Actores y Clientes',
    iconName: 'solar:users-group-rounded-line-duotone',
    route: '/configuraciones/actores-clientes',
    permisos: [PERMISO.ACTORES_CLIENTES],
  },
  {
    displayName: 'Configuraciones',
    iconName: 'solar:settings-line-duotone',
    route: '/authentication',
    permisos: [
      PERMISO.USUARIOS,
      PERMISO.PARAMETRICAS,
      PERMISO.HISTORIAL_ACCESOS,
      PERMISO.ROLES_PERMISOS,
    ],
    children: [
      {
        displayName: 'Gestion de Usuarios',
        subItemIcon: true,
        iconName: 'solar:user-plus-rounded-line-duotone',
        route: '/configuraciones/gestion-usuarios',
        permisos: [PERMISO.USUARIOS],
      },
      {
        displayName: 'Parametricas',
        subItemIcon: true,
        iconName: 'solar:tuning-2-line-duotone',
        route: '/configuraciones/parametricas',
        permisos: [PERMISO.PARAMETRICAS],
      },
      {
        displayName: 'Historial de Accesos',
        subItemIcon: true,
        iconName: 'solar:shield-user-line-duotone',
        route: '/configuraciones/historial-accesos',
        permisos: [PERMISO.HISTORIAL_ACCESOS],
      },
      {
        displayName: 'Roles y Permisos',
        subItemIcon: true,
        iconName: 'solar:shield-keyhole-line-duotone',
        route: '/configuraciones/roles-permisos',
        permisos: [PERMISO.ROLES_PERMISOS],
      },
    ],
  },
];
