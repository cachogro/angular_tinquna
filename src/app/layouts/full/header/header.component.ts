import {
  Component,
  Output,
  EventEmitter,
  Input,
  ViewEncapsulation,
  signal,
  inject,
} from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';

import { NgScrollbarModule } from 'ngx-scrollbar';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from 'src/app/core/auth/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [
    RouterModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    MatBadgeModule,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  private authService = inject(AuthService);

  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Input() isDark: boolean = false;
  @Output() toggleTheme = new EventEmitter<void>();

  cerrarSesion(): void {
    this.authService.logout(true); // Esto borrará el token, limpiará el usuario y redirigirá al LOGIN_PATH
  }
}
