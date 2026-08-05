// src/app/pages/ui-components/panel-users/panel-user-form/panel-user-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { CatalogoItem } from '../models/catalogos.models';
import { obtenerRolUsuario } from '../models/usuario-admin.models';
import { UsuarioAdminService } from '../../services/usuario-admin.service';
import { CatalogosService } from '../../services/catalogos.service';
import { MatCardModule } from '@angular/material/card';


@Component({
  selector: 'app-panel-user-form',
  imports: [
    MatCardModule,
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
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-BO' }],
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

  /** 18 años atrás desde hoy, usado como fecha máxima seleccionable en el datepicker */
  readonly fechaMaximaNacimiento = this.hace18Anios();

  readonly form = new FormGroup({
    usuario: new FormControl('', [
      Validators.required,
      Validators.minLength(4),
      Validators.pattern(/^[A-Za-zÑñ.]+$/),
    ]),
    contrasena: new FormControl('', [
      Validators.minLength(8),
      Validators.pattern(/^\S+$/),
    ]),
    idRol: new FormControl<string | null>(null, [Validators.required]),
    nombres: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    apellidoPaterno: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    apellidoMaterno: new FormControl('', [
      Validators.pattern(/^[A-ZÁÉÍÓÚÑÜ ]+$/),
    ]),
    celular: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[0-9+]+$/),
    ]),
    correoElectronico: new FormControl('', [
      Validators.required,
      Validators.email,
      Validators.pattern(/^\S+$/),
    ]),
    fechaNacimiento: new FormControl<Date | null>(null, [
      Validators.required,
      this.edadMinimaValidator(18),
    ]),
    numeroDocumento: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[0-9A-Za-z_-]+$/),
      this.maxLetrasValidator(3),
    ]),
    idTipoDocumento: new FormControl<string | null>(null, [Validators.required]),
    idLugarEmisionDocumento: new FormControl<string | null>(null, [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  /** Compara valores de mat-select por texto: evita que un id string vs number
   *  (o distintas referencias) impida que se muestre la opción ya seleccionada al editar. */
  compararPorValor = (a: unknown, b: unknown): boolean =>
    a != null && b != null ? String(a) === String(b) : a === b;

  private hace18Anios(): Date {
    const hoy = new Date();
    return new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
  }

  private edadMinimaValidator(edadMinima: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = control.value;
      if (!valor) return null;
      const fecha = valor instanceof Date ? valor : new Date(valor);
      if (isNaN(fecha.getTime())) return null;

      const hoy = new Date();
      let edad = hoy.getFullYear() - fecha.getFullYear();
      const cumplioMesDia =
        hoy.getMonth() > fecha.getMonth() ||
        (hoy.getMonth() === fecha.getMonth() && hoy.getDate() >= fecha.getDate());
      if (!cumplioMesDia) edad--;

      return edad >= edadMinima ? null : { edadMinima: true };
    };
  }

  private maxLetrasValidator(maxLetras: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor: string = control.value ?? '';
      const cantidadLetras = (valor.match(/[A-Za-z]/g) ?? []).length;
      return cantidadLetras <= maxLetras ? null : { maxLetras: true };
    };
  }

  /** Reescribe en vivo el valor de un control según una función de saneo (misma
   *  convención que persona-form-dialog: bloquea/normaliza caracteres al tipear) */
  private registrarSaneador(
    control: FormControl<string | null>,
    sanea: (valor: string) => string,
  ): void {
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = sanea(valor);
      if (limpio !== valor) {
        control.setValue(limpio, { emitEvent: false });
      }
    });
  }

  private saneaUsuario(valor: string): string {
    return valor.replace(/[^A-Za-zÑñ.]/g, '');
  }

  private saneaSinEspacios(valor: string): string {
    return valor.replace(/\s/g, '');
  }

  private saneaSoloLetrasMayusculas(valor: string): string {
    return valor.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ ]/g, '');
  }

  private saneaCelular(valor: string): string {
    return valor.replace(/[^0-9+]/g, '');
  }

  private saneaNumeroDocumento(valor: string): string {
    return valor.replace(/[^0-9A-Za-z_-]/g, '');
  }

  /**
   * El backend entrega fechaNacimiento como 'DD-MM-YYYY' (ver PersonaRegistro).
   * `new Date('25-12-1990')` la interpreta como MM-DD-YYYY (o directamente
   * Invalid Date cuando el día > 12), por eso el campo aparecía vacío al editar.
   * Acá se parsea explícitamente soportando 'DD-MM-YYYY', 'DD/MM/YYYY' e ISO.
   */
  private parseFechaBackend(fecha: string): Date | null {
    if (!fecha) return null;

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
    if (iso) {
      const [, anio, mes, dia] = iso;
      return new Date(Number(anio), Number(mes) - 1, Number(dia));
    }

    const partes = fecha.split(/[-/]/);
    if (partes.length === 3) {
      const [dia, mes, anio] = partes;
      const fechaParseada = new Date(Number(anio), Number(mes) - 1, Number(dia));
      return isNaN(fechaParseada.getTime()) ? null : fechaParseada;
    }

    return null;
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

    this.registrarSaneador(this.form.controls.usuario, (v) => this.saneaUsuario(v));
    this.registrarSaneador(this.form.controls.contrasena, (v) => this.saneaSinEspacios(v));
    this.registrarSaneador(this.form.controls.correoElectronico, (v) => this.saneaSinEspacios(v));
    this.registrarSaneador(this.form.controls.nombres, (v) => this.saneaSoloLetrasMayusculas(v));
    this.registrarSaneador(this.form.controls.apellidoPaterno, (v) => this.saneaSoloLetrasMayusculas(v));
    this.registrarSaneador(this.form.controls.apellidoMaterno, (v) => this.saneaSoloLetrasMayusculas(v));
    this.registrarSaneador(this.form.controls.celular, (v) => this.saneaCelular(v));
    this.registrarSaneador(this.form.controls.numeroDocumento, (v) => this.saneaNumeroDocumento(v));

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

        // Por defecto el tipo de documento es CI (solo al crear; en edición
        // el valor real llega del usuario y se respeta).
        if (!this.esEdicion) {
          const ci = tiposDocumento.find((t) => t.nombre?.trim().toUpperCase() === 'CI');
          if (ci) {
            this.form.controls.idTipoDocumento.setValue(ci.id);
          }
        }
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
            idRol: rol?.id != null ? String(rol.id) : null,
            nombres: usuario.persona.nombres,
            apellidoPaterno: usuario.persona.apellidoPaterno,
            apellidoMaterno: usuario.persona.apellidoMaterno,
            celular: usuario.persona.celular,
            correoElectronico: usuario.persona.correoElectronico,
            fechaNacimiento: this.parseFechaBackend(usuario.persona.fechaNacimiento),
            numeroDocumento: usuario.persona.numeroDocumento,
            idTipoDocumento:
              usuario.persona.idTipoDocumento != null
                ? String(usuario.persona.idTipoDocumento)
                : null,
            idLugarEmisionDocumento:
              usuario.persona.idLugarEmisionDocumento != null
                ? String(usuario.persona.idLugarEmisionDocumento)
                : null,
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
    this.router.navigate(['/configuraciones/gestion-usuarios']);
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
    this.router.navigate(['/configuraciones/gestion-usuarios']);
  }




  private onError(err: unknown): void {
    this.guardando.set(false);
    const mensaje =
      (err as { error?: { message?: string } })?.error?.message ??
      'Ocurrió un error al guardar el usuario';
    this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
  }
}
