import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { concat, last } from 'rxjs';
import { RolesPermisosService } from '../services/roles-permisos.service';
import {
  MatrizPermisos,
  PermisoMatriz,
  RolMatriz,
} from './models/roles-permisos.models';

/** Código de rol -> códigos de permiso marcados. */
type Seleccion = Record<string, string[]>;

@Component({
  selector: 'app-roles-permisos',
  imports: [
    CommonModule,
    MatCardModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './roles-permisos.component.html',
  styleUrl: './roles-permisos.component.scss',
})
export class RolesPermisosComponent implements OnInit {
  private readonly rolesPermisosService = inject(RolesPermisosService);
  private readonly snackBar = inject(MatSnackBar);

  readonly matriz = signal<MatrizPermisos | null>(null);
  readonly loading = signal(true);
  readonly guardando = signal(false);

  /** Lo marcado en pantalla (todavía sin guardar). */
  readonly seleccion = signal<Seleccion>({});

  /** Roles cuya selección en pantalla difiere de lo guardado. */
  readonly rolesModificados = computed<RolMatriz[]>(() => {
    const matriz = this.matriz();
    if (!matriz) return [];
    const guardado = this.seleccionGuardada(matriz);
    const actual = this.seleccion();
    return matriz.roles.filter((rol) => {
      if (rol.esAdministrador) return false;
      const a = guardado[rol.codigo] ?? [];
      const b = actual[rol.codigo] ?? [];
      return a.length !== b.length || a.some((codigo) => !b.includes(codigo));
    });
  });

  readonly hayCambios = computed(() => this.rolesModificados().length > 0);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.rolesPermisosService.obtenerMatriz().subscribe({
      next: (matriz) => {
        this.aplicarMatriz(matriz);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('No se pudo cargar la matriz de permisos', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  marcado(rol: RolMatriz, permiso: PermisoMatriz): boolean {
    if (rol.esAdministrador) return true;
    return (this.seleccion()[rol.codigo] ?? []).includes(permiso.codigo);
  }

  /** El back solo deja otorgar la pantalla a los roles que pueden usar sus rutas. */
  permitido(rol: RolMatriz, permiso: PermisoMatriz): boolean {
    return permiso.rolesPermitidos.includes(rol.codigo);
  }

  ayuda(rol: RolMatriz, permiso: PermisoMatriz): string {
    if (rol.esAdministrador) return 'El administrador tiene siempre todos los permisos';
    if (!this.permitido(rol, permiso)) return 'No disponible para este rol';
    return '';
  }

  alternar(rol: RolMatriz, permiso: PermisoMatriz, marcar: boolean): void {
    this.seleccion.update((actual) => {
      const propios = (actual[rol.codigo] ?? []).filter((c) => c !== permiso.codigo);
      if (marcar) propios.push(permiso.codigo);
      return { ...actual, [rol.codigo]: propios };
    });
  }

  descartar(): void {
    const matriz = this.matriz();
    if (matriz) this.seleccion.set(this.seleccionGuardada(matriz));
  }

  guardar(): void {
    const modificados = this.rolesModificados();
    if (modificados.length === 0 || this.guardando()) return;

    this.guardando.set(true);
    const actual = this.seleccion();

    // Un POST por rol modificado, en orden; cada uno devuelve la matriz al día.
    concat(
      ...modificados.map((rol) =>
        this.rolesPermisosService.guardarPermisosRol({
          idRol: Number(rol.id),
          permisos: actual[rol.codigo] ?? [],
        }),
      ),
    )
      .pipe(last())
      .subscribe({
        next: (matriz) => {
          this.aplicarMatriz(matriz);
          this.guardando.set(false);
          this.snackBar.open(
            'Permisos guardados. Los usuarios verán el cambio al volver a abrir el sistema.',
            'Cerrar',
            { duration: 5000 },
          );
        },
        error: (err) => {
          this.guardando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudieron guardar los permisos',
            'Cerrar',
            { duration: 5000 },
          );
          // Pudo guardarse parte (un rol sí y otro no): se vuelve a lo real.
          this.cargar();
        },
      });
  }

  private aplicarMatriz(matriz: MatrizPermisos): void {
    this.matriz.set(matriz);
    this.seleccion.set(this.seleccionGuardada(matriz));
  }

  private seleccionGuardada(matriz: MatrizPermisos): Seleccion {
    const seleccion: Seleccion = {};
    for (const rol of matriz.roles) seleccion[rol.codigo] = [];
    for (const modulo of matriz.modulos) {
      for (const permiso of modulo.permisos) {
        for (const codigoRol of permiso.rolesAsignados) {
          seleccion[codigoRol]?.push(permiso.codigo);
        }
      }
    }
    return seleccion;
  }
}
