import { Signal, computed, inject } from '@angular/core';
import { AuthService } from './services/auth.service';

/**
 * Signal que dice si el usuario tiene al menos uno de los permisos. Para
 * mostrar u ocultar botones:
 *
 *   readonly puedeDescargarExcel = tienePermiso(PERMISO.DESCARGAR_EXCEL_CONTABILIDAD);
 *
 * Llamar en un inicializador de campo o en el constructor (usa inject()).
 */
export function tienePermiso(...codigos: string[]): Signal<boolean> {
  const authService = inject(AuthService);
  return computed(() => authService.hasPermiso(...codigos));
}
