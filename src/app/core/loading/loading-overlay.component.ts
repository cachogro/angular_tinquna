import { Component, inject } from '@angular/core';
import { LoadingService } from './loading.service';
import { LogoLoaderComponent } from './logo-loader.component';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [LogoLoaderComponent],
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.scss',
})
export class LoadingOverlayComponent {
  readonly loading = inject(LoadingService);
}
