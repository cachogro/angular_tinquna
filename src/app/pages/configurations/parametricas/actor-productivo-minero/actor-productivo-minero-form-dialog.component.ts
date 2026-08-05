import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import {
  ActorProductivoMinero,
  FiltrosActorProductivoMinero,
  TipoActorProductivoMinero,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

export interface ActorProductivoMineroDialogData {
  actorProductivoMinero?: ActorProductivoMinero;
}

interface OpcionOrden {
  value: string;
  label: string;
}

@Component({
  selector: 'app-actor-productivo-minero-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
    MatPaginatorModule,
    ParametricaDialogShellComponent,
  ],
  templateUrl: './actor-productivo-minero-form-dialog.component.html',
  styleUrl: './actor-productivo-minero-form-dialog.component.scss',
})
export class ActorProductivoMineroFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<ActorProductivoMineroFormDialogComponent>,
  );
  private readonly data =
    inject<ActorProductivoMineroDialogData>(MAT_DIALOG_DATA, {
      optional: true,
    }) ?? {};

  guardando = false;
  columnas = ['id', 'nombre', 'tipo', 'direccion', 'telefono', 'estado', 'acciones'];

  tipos: TipoActorProductivoMinero[] = [];

  // ---------- Búsqueda, filtro por tipo y paginación ----------
  searchControl = new FormControl('');
  filtroTipoControl = new FormControl<number | string | null>(null);
  pageIndex = 0; // 0-based, como espera mat-paginator
  pageSize = 10;
  private readonly busquedaChange$ = new Subject<void>();

  readonly opcionesOrden: OpcionOrden[] = [
    { value: 'id', label: 'ID' },
    { value: 'nombre', label: 'Nombre' },
    { value: 'direccion', label: 'Dirección' },
    { value: 'telefono', label: 'Teléfono' },
    { value: 'tipoActorProductivoMinero', label: 'Tipo' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender solo de `data`.
  actorEditando: ActorProductivoMinero | null = null;

  get modoEdicion(): boolean {
    return !!this.actorEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    direccion: ['', [Validators.required, Validators.maxLength(200)]],
    telefono: ['', [Validators.required, Validators.maxLength(20)]],
    idTipoActorProductivoMinero: [
      null as number | string | null,
      [Validators.required],
    ],
  });

  ngOnInit(): void {
    this.cargarTipos();

    this.busquedaChange$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex = 0;
        this.recargarTabla();
      });

    this.searchControl.valueChanges.subscribe(() =>
      this.busquedaChange$.next(),
    );

    this.filtroTipoControl.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.recargarTabla();
    });

    this.orderByControl.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.recargarTabla();
    });
    this.orderDirectionControl.valueChanges.subscribe(() => {
      this.pageIndex = 0;
      this.recargarTabla();
    });

    this.recargarTabla();

    if (this.data.actorProductivoMinero) {
      this.editar(this.data.actorProductivoMinero);
    }
  }

  private cargarTipos(): void {
    this.parametricasService.obtenerTiposActorProductivoMinero().subscribe({
      next: (data) => {
        this.tipos = data.filter((t) => t.activo !== false);
      },
      error: () =>
        this.snackBar.open('Error al cargar los tipos', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  /** Descripción del tipo para mostrar en la tabla, usando el catálogo
   *  cacheado si el back no lo devuelve anidado en cada fila. */
  descripcionTipo(row: ActorProductivoMinero): string {
    if (row.tipoActorProductivoMinero?.descripcion) {
      return row.tipoActorProductivoMinero.descripcion;
    }
    const tipo = this.tipos.find(
      (t) => String(t.id) === String(row.idTipoActorProductivoMinero),
    );
    return tipo?.descripcion ?? '—';
  }

  private recargarTabla(): void {
    this.parametricasService.cargarActoresProductivosMineros({
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value?.trim() || undefined,
      idTipoActorProductivoMinero: this.filtroTipoControl.value ?? undefined,
      orderBy:
        (this.orderByControl.value as FiltrosActorProductivoMinero['orderBy']) ??
        undefined,
      orderDirection: this.orderDirectionControl.value ?? undefined,
    });
  }

  /** Limpia el texto buscado y el filtro de tipo, restableciendo la lista */
  limpiarBusqueda(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.filtroTipoControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('id', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.pageIndex = 0;
    this.recargarTabla();
  }

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.recargarTabla();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar actor productivo minero'
          : 'Crear actor productivo minero',
        message: this.modoEdicion
          ? `¿Confirmas actualizar "${nombre}"?`
          : `¿Confirmas crear "${nombre}"?`,
        confirmLabel: this.modoEdicion ? 'Actualizar' : 'Crear',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: this.modoEdicion ? 'edit' : 'add_circle_outline',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.persistir();
      }
    });
  }

  private persistir(): void {
    this.guardando = true;
    const { nombre, direccion, telefono, idTipoActorProductivoMinero } =
      this.form.getRawValue();

    // Un solo POST: si hay actor en edición, se manda su id y el back
    // actualiza; si no, lo crea.
    this.parametricasService
      .guardarActorProductivoMinero({
        id: this.actorEditando?.id,
        nombre,
        direccion,
        telefono,
        idTipoActorProductivoMinero,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Actor productivo minero actualizado correctamente'
              : 'Actor productivo minero creado correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          // No cerramos el modal: la tabla vive adentro, solo limpiamos
          // el formulario para dejarlo listo para un nuevo registro.
          this.limpiar();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message ?? 'Ocurrió un error al guardar',
            'Cerrar',
            { duration: 4000 },
          );
          this.guardando = false;
        },
      });
  }

  /** Pone el formulario en modo edición con los datos de la fila seleccionada */
  editar(actor: ActorProductivoMinero): void {
    this.actorEditando = actor;
    this.form.patchValue({
      nombre: actor.nombre,
      direccion: actor.direccion,
      telefono: actor.telefono,
      idTipoActorProductivoMinero: actor.idTipoActorProductivoMinero,
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      nombre: '',
      direccion: '',
      telefono: '',
      idTipoActorProductivoMinero: null,
    });
    this.actorEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva un actor productivo minero, con confirmación previa */
  cambiarEstado(actor: ActorProductivoMinero): void {
    const accion = actor.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: actor.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${actor.nombre}"?`,
        confirmLabel: actor.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        // Si tu ConfirmDialogComponent tiene un tone tipo 'danger'/'warning'
        // para acciones destructivas, úsalo aquí al desactivar.
        tone: 'default',
        icon: actor.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoActorProductivoMinero(actor.id, !actor.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${actor.activo ? 'Desactivado' : 'Activado'} correctamente`,
              'Cerrar',
              { duration: 3000 },
            ),
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'Ocurrió un error al cambiar el estado',
              'Cerrar',
              { duration: 4000 },
            ),
        });
    });
  }

  get actores(): ActorProductivoMinero[] {
    return this.parametricasService.actoresProductivosMineros();
  }

  get totalActores(): number {
    return this.parametricasService.totalActoresProductivosMineros();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoActoresProductivosMineros();
  }
}
