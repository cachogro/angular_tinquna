import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-branding',
  imports: [RouterModule, TablerIconsModule],
  templateUrl: './branding.component.html',
  styleUrl: './branding.component.scss',
})
export class BrandingComponent {
  options = this.settings.getOptions();

  constructor(
    private settings: CoreService,
    readonly authService: AuthService, // <-- sin inject(), solo el tipo
  ) {}
}
