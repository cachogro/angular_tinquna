// TU app.config.ts, con SOLO 2 líneas nuevas marcadas con "// <-- NUEVO"
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withInterceptors, // <-- NUEVO
} from '@angular/common/http';
import { routes } from './app.routes';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration } from '@angular/platform-browser';
// icons
import { TablerIconsModule } from 'angular-tabler-icons';
import * as TablerIcons from 'angular-tabler-icons/icons';
// perfect scrollbar
import { NgScrollbarModule } from 'ngx-scrollbar';
//Import all material modules
import { MaterialModule } from './material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
// auth interceptors <-- NUEVO
import { authInterceptor } from './core/auth/interceptors/auth.interceptor';
import { errorInterceptor } from './core/auth/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
      withComponentInputBinding()
    ),
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([authInterceptor, errorInterceptor]) // <-- NUEVO (el orden importa: auth primero, error después)
    ),
    provideClientHydration(),
    provideAnimationsAsync(),
    importProvidersFrom(
      FormsModule,
      ReactiveFormsModule,
      MaterialModule,
      TablerIconsModule.pick(TablerIcons),
      NgScrollbarModule,
    ),
  ],
};

/*
 * NOTA: withInterceptorsFromDi() y withInterceptors() pueden convivir sin problema.
 * El primero es para interceptores basados en clases (@Injectable con HTTP_INTERCEPTORS),
 * el segundo para interceptores funcionales como los que creamos (HttpInterceptorFn).
 * Si en el futuro no usas ningún interceptor de clase, puedes quitar withInterceptorsFromDi().
 */
