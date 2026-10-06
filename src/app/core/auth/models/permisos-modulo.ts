import { RolCodigo } from './auth.models';

/**
 * Roles que pueden entrar a cada módulo. Es la única fuente: la usan las
 * rutas (roleMatchGuard en app.routes.ts) y el menú lateral (sidebar-data.ts),
 * así lo que se ve en el menú y lo que deja abrir la URL no se desfasan.
 *
 * Para dar acceso a un rol a un módulo entero, agrégalo aquí. Para afinar
 * dentro del módulo, usar roleGuard + data.roles en la ruta hija y `roles`
 * en el item del menú correspondiente.
 */
export const PERMISOS_MODULO = {
  comercioInterno: [RolCodigo.ADMINISTRADOR, RolCodigo.TECNICO],
  contabilidad: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR],
  // Operador: solo Parametricas y Actores y Clientes (el resto es solo admin).
  configuraciones: [RolCodigo.ADMINISTRADOR, RolCodigo.OPERADOR],
} satisfies Record<string, RolCodigo[]>;
