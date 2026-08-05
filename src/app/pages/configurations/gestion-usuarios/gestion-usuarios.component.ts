import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { UsuarioAdminService } from '../services/usuario-admin.service';
import { CatalogosService } from '../services/catalogos.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import {
  FiltrosListadoUsuarios,
  obtenerRolUsuario,
  UsuarioAdmin,
} from './models/usuario-admin.models';
import { CatalogoItem } from './models/catalogos.models';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

interface OpcionOrden {
  value: string;
  label: string;
}

const AVATAR_PALETTE = [
  '#7367F0',
  '#28C76F',
  '#EA5455',
  '#FF9F43',
  '#00CFE8',
  '#5E5873',
];

@Component({
  selector: 'app-gestion-usuarios',
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatButtonModule,
    MatCardModule,
    CommonModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.scss',
})
export class GestionUsuariosComponent implements OnInit {
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly authService = inject(AuthService);

  /**
   * ADMINISTRADOR: ve todas las acciones (editar, activar/desactivar).
   * OPERADOR: solo puede listar y crear (botón "Nuevo usuario"), no ve
   * columna de acciones de edición/baja sobre otros usuarios.
   */
  get puedeGestionar(): boolean {
    return this.authService.isAdmin();
  }

  get displayedColumns(): string[] {
    return this.puedeGestionar
      ? ['id', 'usuario', 'contacto', 'rol', 'estado', 'acciones']
      : ['id', 'usuario', 'contacto', 'rol', 'estado'];
  }

  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly roles = signal<CatalogoItem[]>([]);

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly rolControl = new FormControl<string | null>(null);
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null

  readonly opcionesOrden: OpcionOrden[] = [
    { value: 'id', label: 'ID' },
    { value: 'usuario', label: 'Usuario' },
    { value: 'nombres', label: 'Nombres' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  ngOnInit(): void {
    this.catalogosService.getRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => this.roles.set([]),
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.rolControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderByControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.cargarUsuarios();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.loading.set(true);

    const estado = this.estadoControl.value;

    this.usuarioAdminService
      .listarUsuarios({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value || undefined,
        idRol: this.rolControl.value || undefined,
        activo: estado === null ? undefined : estado === 'true',
        orderBy: (this.orderByControl.value as FiltrosListadoUsuarios['orderBy']) ?? undefined,
        orderDirection: this.orderDirectionControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.usuarios.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de usuarios',
            'Cerrar',
            {
              duration: 4000,
            },
          );
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarUsuarios();
  }

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.rolControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('id', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  rolDe(usuario: UsuarioAdmin) {
    return obtenerRolUsuario(usuario);
  }

  nombreCompleto(usuario: UsuarioAdmin): string {
    const p = usuario.persona;
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  iniciales(usuario: UsuarioAdmin): string {
    const p = usuario.persona;
    return `${p.nombres?.[0] ?? ''}${p.apellidoPaterno?.[0] ?? ''}`.toUpperCase();
  }

  colorAvatar(usuario: UsuarioAdmin): string {
    const index = Number(usuario.id) % AVATAR_PALETTE.length;
    return AVATAR_PALETTE[Math.abs(index) || 0];
  }

  /**
   * Normaliza `activo` a un boolean real. El backend a veces lo serializa
   * como string ("true"/"false") o número (0/1); comparar directo con `!` o
   * `?:` sobre un valor no-boolean rompe tanto el badge como el ícono de
   * cambio de estado (se quedan siempre en la misma rama).
   */
  estaActivo(usuario: UsuarioAdmin): boolean {
    const valor = usuario.activo as unknown;
    if (typeof valor === 'string') return valor.trim().toLowerCase() === 'true' || valor === '1';
    return Boolean(valor);
  }

  confirmarCambioEstado(usuario: UsuarioAdmin): void {
    // Defensa extra: aunque el botón esté oculto para OPERADOR, nunca confiar
    // solo en la UI para una acción sensible como dar de baja a un usuario.
    if (!this.puedeGestionar) return;

    const activar = !this.estaActivo(usuario);

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: activar ? 'Activar usuario' : 'Desactivar usuario',
        message: activar
          ? `¿Deseas activar a ${this.nombreCompleto(usuario)}? Podrá iniciar sesión nuevamente.`
          : `¿Deseas desactivar a ${this.nombreCompleto(usuario)}? No podrá iniciar sesión hasta que lo reactives.`,
        confirmLabel: activar ? 'Sí, activar' : 'Sí, desactivar',
        tone: activar ? 'default' : 'danger',
        icon: activar ? 'check_circle_outline' : 'block',
      },
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.usuarioAdminService
        .cambiarEstadoUsuario(usuario.id, activar)
        .subscribe({
          next: (actualizado) => {
            this.usuarios.update((lista) =>
              lista.map((u) => (u.id === usuario.id ? actualizado : u)),
            );
            this.snackBar.open(
              activar
                ? 'Usuario activado correctamente'
                : 'Usuario desactivado correctamente',
              'Cerrar',
              { duration: 3000 },
            );
          },
          error: () => {
            this.snackBar.open(
              'No se pudo cambiar el estado del usuario',
              'Cerrar',
              {
                duration: 4000,
              },
            );
          },
        });
    });
  }
}
