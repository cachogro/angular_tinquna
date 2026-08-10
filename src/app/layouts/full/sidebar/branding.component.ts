import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-branding',
  imports: [RouterModule, TablerIconsModule],
  template: `
    <a [routerLink]="['/']" class="branding-logo">
      <img
        src="./assets/images/logos/logo.svg"
        class="align-middle m-2"
        style="width: 187px; height: 55px;"
        alt="logo"
      />
    </a>

    @if (authService.user(); as user) {
      <div class="user-card">
        <div class="user-card__fila">
          <span
            class="user-card__nombre"
            [title]="user.persona.nombres + ' ' + user.persona.apellidoPaterno"
          >
            {{ user.persona.nombres }} {{ user.persona.apellidoPaterno }}
          </span>
        </div>
        <span>
          @if (user.roles[0]?.nombre; as rol) {
            <span class="user-card__rol">{{ rol }}</span>
          }
        </span>
        <span class="user-card__linea">
          <i-tabler name="user-circle" class="icon-14"></i-tabler>
          <span>{{ user.usuario }}</span>
        </span>
        <span class="user-card__linea" [title]="user.persona.correoElectronico">
          <i-tabler name="mail" class="icon-14"></i-tabler>
          <span>{{ user.persona.correoElectronico }}</span>
        </span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 100%;
      }

      .branding-logo {
        display: block;
      }

      .user-card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        margin: 2px 0 6px;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--mat-sys-surface-container-high);
        box-sizing: border-box;
      }

      .user-card__fila {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      .user-card__nombre {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--mat-sys-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .user-card__rol {
        flex: none;
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }

      .user-card__linea {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        font-size: 11px;
        color: var(--mat-sys-on-surface-variant);

        span {
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .icon-14 {
          flex: none;
          width: 13px;
          height: 13px;
        }
      }
    `,
  ],
})
export class BrandingComponent {
  options = this.settings.getOptions();

  constructor(
    private settings: CoreService,
    readonly authService: AuthService, // <-- sin inject(), solo el tipo
  ) {}
}
