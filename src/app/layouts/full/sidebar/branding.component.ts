import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-branding',
  imports: [RouterModule, TablerIconsModule, MatTooltipModule],
  templateUrl: './branding.component.html',
  styleUrl: './branding.component.scss',
})
export class BrandingComponent {
  options = this.settings.getOptions();
  sidebarMini = this.settings.sidebarMini;

  constructor(
    private settings: CoreService,
    readonly authService: AuthService, // <-- sin inject(), solo el tipo
  ) {}

  iniciales(nombres: string, apellido: string): string {
    return `${nombres?.charAt(0) ?? ''}${apellido?.charAt(0) ?? ''}`.toUpperCase();
  }
}
