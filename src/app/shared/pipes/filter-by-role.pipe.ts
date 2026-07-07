// src/app/shared/pipes/filter-by-role.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthService } from 'src/app/core/auth/services/auth.service';

/**
 * Filtra un array de items (ej. NavItem[]) que tengan una propiedad opcional
 * `roles?: string[]`. Si el item no define `roles`, se muestra a todos los
 * usuarios autenticados (comportamiento actual, sin romper nada existente).
 * Si define `roles`, solo se muestra si el usuario tiene alguno de esos roles.
 *
 * Uso en el template del sidebar, sin tocar el componente:
 *   @for (item of navItems | filterByRole; track item.displayName) { ... }
 */
@Pipe({
  name: 'filterByRole',
  pure: false, // el pipe debe re-evaluar cuando cambian los roles del usuario (signal)
})
export class FilterByRolePipe implements PipeTransform {
  private readonly authService = inject(AuthService);

  transform<T extends { roles?: string[] }>(items: T[] | null | undefined): T[] {
    if (!items) return [];
    return items.filter((item) => !item.roles || this.authService.hasRole(...item.roles));
  }
}
