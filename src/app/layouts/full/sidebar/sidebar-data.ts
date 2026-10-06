import { PERMISOS_MODULO } from 'src/app/core/auth/models/permisos-modulo';
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
    roles: PERMISOS_MODULO.comercioInterno,
    divider: true,
  },
  {
    displayName: 'Recepcion de Minerales',
    iconName: 'solar:inbox-in-line-duotone',
    route: '/ui-components/recepcion-minerales',
    roles: PERMISOS_MODULO.comercioInterno,
  },
  {
    displayName: 'Valorizacion',
    iconName: 'solar:tag-price-line-duotone',
    route: '/ui-components/valorizacion',
    roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR], // igual que la ruta: sin técnico
  },
  {
    displayName: 'Promedios',
    iconName: 'solar:calculator-line-duotone',
    route: '/ui-components/promedios',
    roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR], // igual que la ruta: sin técnico
  },
  {
    displayName: 'Ventas de Lote',
    iconName: 'solar:cart-large-2-line-duotone',
    route: '/ui-components/ventas-lote',
    roles: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR], // igual que la ruta: sin técnico
  },
  {
    displayName: 'Reportes',
    iconName: 'solar:documents-line-duotone',
    route: '/ui-components/reportes',
    roles: PERMISOS_MODULO.comercioInterno,
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
    roles: PERMISOS_MODULO.contabilidad,
    divider: true,
  },
  {
    displayName: 'Recibos',
    iconName: 'solar:bill-list-line-duotone',
    route: '/contabilidad/recibos',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Traspasos',
    iconName: 'solar:transfer-horizontal-line-duotone',
    route: '/contabilidad/traspasos',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Fondo a Rendir Cuentas',
    iconName: 'solar:wallet-money-line-duotone',
    route: '/contabilidad/fondo-rendir',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Libreta Bancaria',
    iconName: 'solar:notebook-line-duotone',
    route: '/contabilidad/libreta-bancaria',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Kardex',
    iconName: 'solar:clipboard-text-line-duotone',
    route: '/contabilidad/kardex',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Caja de Flujo',
    iconName: 'solar:safe-square-line-duotone',
    route: '/contabilidad/caja-flujo',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Préstamos al Personal',
    iconName: 'solar:hand-money-line-duotone',
    route: '/contabilidad/prestamos',
    roles: PERMISOS_MODULO.contabilidad,
  },
  {
    displayName: 'Boletas de Pago',
    iconName: 'solar:bill-check-line-duotone',
    route: '/contabilidad/boletas-pago',
    roles: PERMISOS_MODULO.contabilidad,
  },

  {
    displayName: 'Reporte por Destino',
    iconName: 'solar:chart-2-line-duotone',
    route: '/contabilidad/reportes/destino-gasto',
    roles: PERMISOS_MODULO.contabilidad,
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
    roles: PERMISOS_MODULO.configuraciones,
  },
  {
    displayName: 'Actores y Clientes',
    iconName: 'solar:users-group-rounded-line-duotone',
    route: '/configuraciones/actores-clientes',
    roles: PERMISOS_MODULO.configuraciones,
  },
  {
    displayName: 'Configuraciones',
    iconName: 'solar:settings-line-duotone',
    route: '/authentication',
    roles: PERMISOS_MODULO.configuraciones,
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
        iconName: 'solar:tuning-2-line-duotone',
        route: '/configuraciones/parametricas',
        roles: PERMISOS_MODULO.configuraciones,
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
