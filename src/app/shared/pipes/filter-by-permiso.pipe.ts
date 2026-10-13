// src/app/shared/pipes/filter-by-permiso.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthService } from 'src/app/core/auth/services/auth.service';

/**
 * Filtra un array de items (ej. NavItem[]) que tengan una propiedad opcional
 * `permisos?: string[]`. Si el item no define `permisos`, se muestra a todos
 * los usuarios autenticados. Si los define, solo se muestra si el usuario
 * tiene al menos uno.
 *
 * Uso en el template del sidebar, sin tocar el componente:
 *   @for (item of navItems | filterByPermiso; track item.displayName) { ... }
 */
@Pipe({
  name: 'filterByPermiso',
  pure: false, // el pipe debe re-evaluar cuando cambian los permisos del usuario (signal)
})
export class FilterByPermisoPipe implements PipeTransform {
  private readonly authService = inject(AuthService);

  transform<T extends { permisos?: string[] }>(items: T[] | null | undefined): T[] {
    if (!items) return [];
    return items.filter(
      (item) => !item.permisos || this.authService.hasPermiso(...item.permisos),
    );
  }
}
