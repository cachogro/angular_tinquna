// src/app/pages/ui-components/panel-users/panel-user-form/panel-user-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { CatalogoItem } from '../models/catalogos.models';
import { obtenerRolUsuario } from '../models/usuario-admin.models';
import { CatalogosService } from '../services/catalogos.service';
import { UsuarioAdminService } from '../services/usuario-admin.service';

@Component({
  selector: 'app-panel-user-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './panel-user-form.component.html',
  styleUrl: './panel-user-form.component.scss',
})
export class PanelUserFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly roles = signal<CatalogoItem[]>([]);
  readonly tiposDocumento = signal<CatalogoItem[]>([]);
  readonly lugaresEmision = signal<CatalogoItem[]>([]);

  readonly cargandoCatalogos = signal(true);
  readonly cargandoUsuario = signal(false);
  readonly guardando = signal(false);

  usuarioId: string | null = null;
  get esEdicion(): boolean {
    return !!this.usuarioId;
  }

  readonly form = new FormGroup({
    usuario: new FormControl('', [Validators.required, Validators.minLength(4)]),
    contrasena: new FormControl('', [Validators.minLength(8)]),
    idRol: new FormControl<string | null>(null, [Validators.required]),
    nombres: new FormControl('', [Validators.required]),
    apellidoPaterno: new FormControl('', [Validators.required]),
    apellidoMaterno: new FormControl('', [Validators.required]),
    celular: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{6,15}$/)]),
    correoElectronico: new FormControl('', [Validators.required, Validators.email]),
    fechaNacimiento: new FormControl<Date | null>(null, [Validators.required]),
    numeroDocumento: new FormControl('', [Validators.required]),
    idTipoDocumento: new FormControl<string | null>(null, [Validators.required]),
    idLugarEmisionDocumento: new FormControl<string | null>(null, [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.usuarioId = this.route.snapshot.paramMap.get('id');

    // Defensa extra: aunque el roleGuard ya bloquea /editar/:id para OPERADOR
    // a nivel de ruta, si algún día se reutiliza este componente de otra
    // forma, nunca debe quedar en modo edición sin ser ADMINISTRADOR.
    if (this.esEdicion && !this.authService.isAdmin()) {
      this.router.navigate(['/ui-components/users']);
      return;
    }

    if (!this.esEdicion) {
      this.form.controls.contrasena.addValidators(Validators.required);
    }

    forkJoin({
      roles: this.catalogosService.getRoles(),
      tiposDocumento: this.catalogosService.getTiposDocumento(),
      lugaresEmision: this.catalogosService.getLugaresEmision(),
    }).subscribe({
      next: ({ roles, tiposDocumento, lugaresEmision }) => {
        this.roles.set(roles);
        this.tiposDocumento.set(tiposDocumento);
        this.lugaresEmision.set(lugaresEmision);
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos (rol/documento)', 'Cerrar', {
          duration: 4000,
        });
      },
    });

    if (this.esEdicion && this.usuarioId) {
      this.cargandoUsuario.set(true);
      this.usuarioAdminService.obtenerUsuario(this.usuarioId).subscribe({
        next: (usuario) => {
          const rol = obtenerRolUsuario(usuario);
          this.form.patchValue({
            usuario: usuario.usuario,
            idRol: rol?.id ?? null,
            nombres: usuario.persona.nombres,
            apellidoPaterno: usuario.persona.apellidoPaterno,
            apellidoMaterno: usuario.persona.apellidoMaterno,
            celular: usuario.persona.celular,
            correoElectronico: usuario.persona.correoElectronico,
            fechaNacimiento: usuario.persona.fechaNacimiento
              ? new Date(usuario.persona.fechaNacimiento)
              : null,
            numeroDocumento: usuario.persona.numeroDocumento,
            idTipoDocumento: usuario.persona.idTipoDocumento,
            idLugarEmisionDocumento: usuario.persona.idLugarEmisionDocumento,
          });
          this.cargandoUsuario.set(false);
        },
        error: () => {
          this.cargandoUsuario.set(false);
          this.snackBar.open('No se pudo cargar el usuario a editar', 'Cerrar', {
            duration: 4000,
          });
          this.router.navigate(['/ui-components/users']);
        },
      });
    }
  }

  private formatFecha(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}-${mes}-${anio}`;
  }

  cancelar(): void {
    this.router.navigate(['/ui-components/users']);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revisa los campos marcados en rojo', 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();

    const persona = {
      nombres: v.nombres!,
      apellidoPaterno: v.apellidoPaterno!,
      apellidoMaterno: v.apellidoMaterno!,
      celular: v.celular!,
      correoElectronico: v.correoElectronico!,
      fechaNacimiento: this.formatFecha(v.fechaNacimiento!),
      numeroDocumento: v.numeroDocumento!,
      idTipoDocumento: v.idTipoDocumento!,
      idLugarEmisionDocumento: v.idLugarEmisionDocumento!,
    };

    if (this.esEdicion && this.usuarioId) {
      this.usuarioAdminService
        .actualizarUsuario(this.usuarioId, {
          usuario: v.usuario!,
          idRol: v.idRol!,
          persona,
        })
        .subscribe({
          next: () => this.onExito('Usuario actualizado correctamente'),
          error: (err) => this.onError(err),
        });
      return;
    }

    this.usuarioAdminService
      .registrarUsuario({
        usuario: v.usuario!,
        contrasena: v.contrasena!,
        idRol: v.idRol!,
        persona,
      })
      .subscribe({
        next: () => this.onExito('Usuario creado correctamente'),
        error: (err) => this.onError(err),
      });
  }

  private onExito(mensaje: string): void {
    this.guardando.set(false);
    this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
    this.router.navigate(['/ui-components/users']);
  }

  private onError(err: unknown): void {
    this.guardando.set(false);
    const mensaje =
      (err as { error?: { message?: string } })?.error?.message ??
      'Ocurrió un error al guardar el usuario';
    this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
  }
}
