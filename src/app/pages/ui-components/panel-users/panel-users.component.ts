// src/app/pages/ui-components/panel-users/panel-users.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import {
  ConfirmDialogComponent,
} from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { CatalogoItem } from './models/catalogos.models';
import { UsuarioAdmin, obtenerRolUsuario } from './models/usuario-admin.models';
import { CatalogosService } from './services/catalogos.service';
import { UsuarioAdminService } from './services/usuario-admin.service';

const AVATAR_PALETTE = ['#7367F0', '#28C76F', '#EA5455', '#FF9F43', '#00CFE8', '#5E5873'];

@Component({
  selector: 'app-panel-users',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './panel-users.component.html',
  styleUrl: './panel-users.component.scss',
})
export class PanelUsersComponent implements OnInit {
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
      ? ['usuario', 'contacto', 'rol', 'estado', 'acciones']
      : ['usuario', 'contacto', 'rol', 'estado'];
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
      })
      .subscribe({
        next: (res) => {
          this.usuarios.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('No se pudo cargar el listado de usuarios', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarUsuarios();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.rolControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
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

  confirmarCambioEstado(usuario: UsuarioAdmin): void {
    // Defensa extra: aunque el botón esté oculto para OPERADOR, nunca confiar
    // solo en la UI para una acción sensible como dar de baja a un usuario.
    if (!this.puedeGestionar) return;

    const activar = !usuario.activo;

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

      this.usuarioAdminService.cambiarEstadoUsuario(usuario.id, activar).subscribe({
        next: (actualizado) => {
          this.usuarios.update((lista) =>
            lista.map((u) => (u.id === usuario.id ? actualizado : u))
          );
          this.snackBar.open(
            activar ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente',
            'Cerrar',
            { duration: 3000 }
          );
        },
        error: () => {
          this.snackBar.open('No se pudo cambiar el estado del usuario', 'Cerrar', {
            duration: 4000,
          });
        },
      });
    });
  }
}
