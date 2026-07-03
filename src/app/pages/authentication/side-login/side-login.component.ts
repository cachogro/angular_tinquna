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
          this.errorMessage =
            err?.status === 401
              ? 'Usuario o contraseña incorrectos'
              : 'No se pudo conectar con el servidor. Intenta nuevamente.';
        },
        complete: () => {
          this.loading = false;
        },
      });
  }
}
