import { Component, input } from '@angular/core';

/** Logo animado (pulso + brillo). Úsalo suelto o dentro del overlay global. */
@Component({
  selector: 'app-logo-loader',
  standalone: true,
  templateUrl: './logo-loader.component.html',
  styleUrl: './logo-loader.component.scss',
})
export class LogoLoaderComponent {
  readonly width = input(220);
}
