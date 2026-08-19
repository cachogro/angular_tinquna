import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/core/auth/services/auth.service';

@Component({
  selector: 'app-side-login',
  imports: [
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
  ],
  templateUrl: './side-login.component.html',
  styleUrl: './side-login.component.scss',
})
export class AppSideLoginComponent {
  loading = false;
  errorMessage: string | null = null;
  hidePassword = true;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  form = new FormGroup({
    uname: new FormControl('', [Validators.required, Validators.minLength(6)]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  togglePasswordVisibility(event: Event) {
    event.preventDefault();
    this.hidePassword = !this.hidePassword;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const { uname, password } = this.form.getRawValue();

    this.authService
      .login({ usuario: uname ?? '', contrasena: password ?? '' })
      .subscribe({
        next: () => {
          const returnUrl =
            this.route.snapshot.queryParams['returnUrl'] ?? '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = this.resolveErrorMessage(err);
        },
        complete: () => {
          this.loading = false;
        },
      });
  }

  private resolveErrorMessage(err: unknown): string {
    const httpErr = err as {
      status?: number;
      error?: { message?: string };
    };

    if (httpErr?.status === 0) {
      return 'No se pudo conectar con el servidor. Intenta nuevamente.';
    }

    if (httpErr?.status === 429) {
      return 'Demasiados intentos de inicio de sesión. Espera un minuto antes de volver a intentarlo.';
    }

    // 403 (cuenta bloqueada temporalmente) ya llega con un mensaje en español
    // listo para mostrar tal cual, vía httpErr.error.message.
    return (
      httpErr?.error?.message ??
      (httpErr?.status === 401
        ? 'Usuario o contraseña incorrectos'
        : 'Ocurrió un error al iniciar sesión. Intenta nuevamente.')
    );
  }
}
