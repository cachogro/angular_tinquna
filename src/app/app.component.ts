import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingOverlayComponent } from './core/loading/loading-overlay.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, LoadingOverlayComponent],
    templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'Modernize Angular Admin Tempplate';
}
