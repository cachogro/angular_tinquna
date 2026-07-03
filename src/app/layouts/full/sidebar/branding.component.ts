import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/services/auth.service';

@Component({
  selector: 'app-branding',
  imports: [RouterModule],
  template: `
    <a [routerLink]="['/']">
      <img
        src="./assets/images/logos/logo.svg"
        class="align-middle m-2"
        style="width: 187px; height: 55px;"
        alt="logo"
      />
    </a>
    @if (authService.user(); as user) {
      <h6>
        Hola, {{ user.persona.nombres }} {{ user.persona.apellidoPaterno }}
      </h6>
      <h6>Usuario: {{ user.usuario }}</h6>
      <h6>Rol: {{ user.roles[0]?.nombre }}</h6>
      <h6>Correo: {{ user.persona.correoElectronico }}</h6>
    }
  `,
})
export class BrandingComponent {
  options = this.settings.getOptions();

  constructor(
    private settings: CoreService,
    readonly authService: AuthService, // <-- sin inject(), solo el tipo
  ) {}
}
