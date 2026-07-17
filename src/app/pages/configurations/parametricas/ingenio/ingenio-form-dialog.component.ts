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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { Ingenio } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

export interface IngenioDialogData {
  ingenio?: Ingenio;
}

@Component({
  selector: 'app-ingenio-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
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
  templateUrl: './ingenio-form-dialog.component.html',
  styleUrl: './ingenio-form-dialog.component.scss',
})
export class IngenioFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<IngenioFormDialogComponent>);
  private readonly data =
    inject<IngenioDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  guardando = false;
  columnas = ['id', 'nombre', 'direccion', 'telefono', 'estado', 'acciones'];

  // ---------- Búsqueda y paginación ----------
  searchControl = new FormControl('');
  pageIndex = 0; // 0-based, como espera mat-paginator
  pageSize = 10;
  private readonly busquedaChange$ = new Subject<void>();

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender solo de `data`.
  ingenioEditando: Ingenio | null = null;

  get modoEdicion(): boolean {
    return !!this.ingenioEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    direccion: ['', [Validators.required, Validators.maxLength(200)]],
    telefono: ['', [Validators.required, Validators.maxLength(20)]],
  });

  ngOnInit(): void {
    this.busquedaChange$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex = 0;
        this.recargarTabla();
      });

    this.searchControl.valueChanges.subscribe(() =>
      this.busquedaChange$.next(),
    );

    this.recargarTabla();

    if (this.data.ingenio) {
      this.editar(this.data.ingenio);
    }
  }

  private recargarTabla(): void {
    this.parametricasService.cargarIngenios({
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value?.trim() || undefined,
      orderBy: 'id',
      orderDirection: 'DESC',
    });
  }

  /** Limpia el texto buscado y restablece la lista completa desde la página 1 */
  limpiarBusqueda(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.pageIndex = 0;
    this.recargarTabla();
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
        title: this.modoEdicion ? 'Actualizar ingenio' : 'Crear ingenio',
        message: this.modoEdicion
          ? `¿Confirmas actualizar el ingenio "${nombre}"?`
          : `¿Confirmas crear el ingenio "${nombre}"?`,
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
    const { nombre, direccion, telefono } = this.form.getRawValue();

    // Un solo POST: si hay ingenio en edición, se manda su id y el back
    // actualiza; si no, lo crea.
    this.parametricasService
      .guardarIngenio({
        id: this.ingenioEditando?.id,
        nombre,
        direccion,
        telefono,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Ingenio actualizado correctamente'
              : 'Ingenio creado correctamente',
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
  editar(ingenio: Ingenio): void {
    this.ingenioEditando = ingenio;
    this.form.patchValue({
      nombre: ingenio.nombre,
      direccion: ingenio.direccion,
      telefono: ingenio.telefono,
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({ nombre: '', direccion: '', telefono: '' });
    this.ingenioEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva un ingenio, con confirmación previa */
  cambiarEstado(ingenio: Ingenio): void {
    const accion = ingenio.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: ingenio.activo ? 'Desactivar ingenio' : 'Activar ingenio',
        message: `¿Confirmas ${accion} el ingenio "${ingenio.nombre}"?`,
        confirmLabel: ingenio.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        // Si tu ConfirmDialogComponent tiene un tone tipo 'danger'/'warning'
        // para acciones destructivas, úsalo aquí al desactivar.
        tone: 'default',
        icon: ingenio.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoIngenio(ingenio.id, !ingenio.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `Ingenio ${ingenio.activo ? 'desactivado' : 'activado'} correctamente`,
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

  /** Respaldo: ordena descendente por id en el cliente mientras el back
   *  no soporte los parámetros orderBy/orderDirection en /parametricas/ingenio.
   *  Una vez el back ordene server-side, esto queda como un no-op. */
  get ingenios(): Ingenio[] {
    return [...this.parametricasService.ingenios()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get totalIngenios(): number {
    return this.parametricasService.totalIngenios();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoIngenios();
  }
}
