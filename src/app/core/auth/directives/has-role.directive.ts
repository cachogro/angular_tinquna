// src/app/core/auth/directives/has-role.directive.ts
import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Uso en templates:
 *   <li *hasRole="['ROLE_ADMINISTRADOR']">Gestión de usuarios</li>
 */
@Directive({
  selector: '[hasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private allowedRoles: string[] = [];
  private hasView = false;

  @Input() set hasRole(roles: string[]) {
    this.allowedRoles = roles;
    this.updateView();
  }

  constructor() {
    effect(() => {
      this.authService.roles(); // se re-ejecuta cuando cambian los roles del usuario
      this.updateView();
    });
  }

  private updateView(): void {
    const canShow = this.authService.hasRole(...this.allowedRoles);

    if (canShow && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!canShow && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
