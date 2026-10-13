/**
 * Permisos de pantalla. Qué rol tiene cada uno se define en
 * Configuraciones > Roles y Permisos (se guarda en la base); acá solo están
 * los códigos, que deben coincidir con los del back
 * (back-end/src/security/enums/permisos.ts).
 *
 * Los usan las rutas (permisoGuard / permisoMatchGuard), el menú lateral
 * (sidebar-data.ts) y los botones (AuthService.hasPermiso), así lo que se ve
 * en el menú y lo que deja abrir la URL no se desfasan.
 *
 * El administrador tiene siempre todos.
 */
export const PERMISO = {
  // Comercio Interno
  RECEPCION: 'comercio.recepcion',
  RECEPCION_GESTIONAR: 'comercio.recepcion.gestionar',
  VALORIZACION: 'comercio.valorizacion',
  PROMEDIOS: 'comercio.promedios',
  VENTAS_LOTE: 'comercio.ventas_lote',
  REPORTES_COMERCIO: 'comercio.reportes',

  // Contabilidad
  RECIBOS: 'contabilidad.recibos',
  TRASPASOS: 'contabilidad.traspasos',
  FONDO_RENDIR: 'contabilidad.fondo_rendir',
  LIBRETA_BANCARIA: 'contabilidad.libreta_bancaria',
  KARDEX: 'contabilidad.kardex',
  CAJA_FLUJO: 'contabilidad.caja_flujo',
  PRESTAMOS: 'contabilidad.prestamos',
  BOLETAS_PAGO: 'contabilidad.boletas_pago',
  REPORTE_PLAN_CUENTAS: 'contabilidad.reporte_plan_cuentas',
  /** Descargar los reportes de Contabilidad en EXCEL (el PDF es libre). Es
   *  de acción, no de pantalla: no da entrada al módulo por sí solo. */
  DESCARGAR_EXCEL_CONTABILIDAD: 'contabilidad.descargar_excel',

  // Configuraciones
  ACTORES_CLIENTES: 'config.actores_clientes',
  PARAMETRICAS: 'config.parametricas',
  USUARIOS: 'config.usuarios',
  HISTORIAL_ACCESOS: 'config.historial_accesos',
  ROLES_PERMISOS: 'config.roles_permisos',
} as const;

/**
 * Permisos de cada módulo: quien tenga al menos uno entra al módulo y ve su
 * título en el menú.
 */
export const PERMISOS_MODULO = {
  comercioInterno: [
    PERMISO.RECEPCION,
    PERMISO.VALORIZACION,
    PERMISO.PROMEDIOS,
    PERMISO.VENTAS_LOTE,
    PERMISO.REPORTES_COMERCIO,
  ],
  contabilidad: [
    PERMISO.RECIBOS,
    PERMISO.TRASPASOS,
    PERMISO.FONDO_RENDIR,
    PERMISO.LIBRETA_BANCARIA,
    PERMISO.KARDEX,
    PERMISO.CAJA_FLUJO,
    PERMISO.PRESTAMOS,
    PERMISO.BOLETAS_PAGO,
    PERMISO.REPORTE_PLAN_CUENTAS,
  ],
  configuraciones: [
    PERMISO.ACTORES_CLIENTES,
    PERMISO.PARAMETRICAS,
    PERMISO.USUARIOS,
    PERMISO.HISTORIAL_ACCESOS,
    PERMISO.ROLES_PERMISOS,
  ],
} satisfies Record<string, string[]>;
