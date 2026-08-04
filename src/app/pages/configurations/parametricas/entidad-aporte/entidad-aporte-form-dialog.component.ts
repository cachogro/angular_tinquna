import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import {
  EntidadAporte,
  TipoBaseAporte,
  TipoEntidadAporte,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

@Component({
  selector: 'app-entidad-aporte-form-dialog',
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
    ParametricaDialogShellComponent,
  ],
  templateUrl: './entidad-aporte-form-dialog.component.html',
  styleUrl: './entidad-aporte-form-dialog.component.scss',
})
export class EntidadAporteFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<EntidadAporteFormDialogComponent>,
  );

  guardando = false;
  columnas = [
    'id',
    'descripcion',
    'tipoEntidadAporte',
    'detalleAporte',
    'estado',
    'acciones',
  ];

  // Bases fijas: la entidad siempre reporta alícuota para ambas, en este orden.
  readonly tiposBaseAporte: TipoBaseAporte[] = ['VBV', 'VNV'];

  readonly etiquetasBaseAporte: Record<TipoBaseAporte, string> = {
    VBV: 'VBV - Valor Bruto de Venta',
    VNV: 'VNV - Valor Neto de Venta',
  };

  // Catálogo fijo (codificado por negocio): el back no expone servicio para esto.
  readonly tiposEntidadAporte: TipoEntidadAporte[] = [
    { id: 1, descripcion: 'ESTATAL' },
    { id: 2, descripcion: 'CAJA SALUD' },
    { id: 3, descripcion: 'FEDERACION' },
    { id: 4, descripcion: 'COOPERATIVA' },
    { id: 5, descripcion: 'OTROS' },
  ];

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender de datos inyectados en el modal.
  entidadEditando: EntidadAporte | null = null;

  get modoEdicion(): boolean {
    return !!this.entidadEditando;
  }

  form: FormGroup = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(150)]],
    idTipoEntidadAporte: [null, Validators.required],
    detalleAporte: this.fb.array(
      this.tiposBaseAporte.map((tipo) => this.crearFilaDetalle(tipo)),
      EntidadAporteFormDialogComponent.alMenosUnaAlicuota(),
    ),
  });

  get detalleAporte(): FormArray {
    return this.form.get('detalleAporte') as FormArray;
  }

  private crearFilaDetalle(
    tipoBaseAporte: TipoBaseAporte,
    alicuota?: number,
  ): FormGroup {
    return this.fb.group({
      tipoBaseAporte: [{ value: tipoBaseAporte, disabled: true }],
      alicuota: [alicuota ?? null, [Validators.min(0), Validators.max(100)]],
    });
  }

  /** No es obligatorio llenar VBV y VNV, pero al menos una de las dos alícuotas sí */
  private static alMenosUnaAlicuota(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const filas = (control as FormArray).controls;
      const tieneAlgunaAlicuota = filas.some((fila) => {
        const alicuota = fila.get('alicuota')?.value;
        return alicuota !== null && alicuota !== undefined && alicuota !== '';
      });
      return tieneAlgunaAlicuota ? null : { alMenosUnaAlicuota: true };
    };
  }

  ngOnInit(): void {
    this.recargarTabla();

    // La descripción siempre se guarda en mayúsculas.
    this.form.get('descripcion')?.valueChanges.subscribe((valor: string) => {
      const mayusculas = (valor ?? '').toUpperCase();
      if (valor !== mayusculas) {
        this.form
          .get('descripcion')
          ?.setValue(mayusculas, { emitEvent: false });
      }
    });
  }

  private recargarTabla(): void {
    // Máximo ~decenas de entidades esperadas: se listan todas sin paginación.
    this.parametricasService.cargarEntidadesAporte();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { descripcion } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion
          ? 'Actualizar entidad de aporte'
          : 'Crear entidad de aporte',
        message: this.modoEdicion
          ? `¿Confirmas actualizar "${descripcion}"?`
          : `¿Confirmas crear "${descripcion}"?`,
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
    const { descripcion, idTipoEntidadAporte, detalleAporte } =
      this.form.getRawValue();

    // Un solo POST: si hay entidad en edición, se manda su id y el back
    // actualiza; si no, la crea.
    this.parametricasService
      .guardarEntidadAporte({
        id: this.entidadEditando?.id,
        descripcion,
        idTipoEntidadAporte,
        // Solo se envían las bases con alícuota cargada: VBV y VNV son
        // ambas opcionales, pero al menos una es obligatoria (validado en el form).
        detalleAporte: detalleAporte
          .filter(
            (fila: { tipoBaseAporte: TipoBaseAporte; alicuota: number | null }) =>
              fila.alicuota !== null && fila.alicuota !== undefined,
          )
          .map(
            (fila: { tipoBaseAporte: TipoBaseAporte; alicuota: number }) => ({
              tipoBaseAporte: fila.tipoBaseAporte,
              alicuota: fila.alicuota,
            }),
          ),
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Entidad de aporte actualizada correctamente'
              : 'Entidad de aporte creada correctamente',
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
  editar(entidad: EntidadAporte): void {
    this.entidadEditando = entidad;
    this.form.patchValue({
      descripcion: entidad.descripcion,
      idTipoEntidadAporte: Number(entidad.idTipoEntidadAporte),
    });

    this.detalleAporte.clear();
    this.tiposBaseAporte.forEach((tipo) => {
      const existente = entidad.detalleAporte?.find(
        (d) => d.tipoBaseAporte === tipo,
      );
      this.detalleAporte.push(
        this.crearFilaDetalle(tipo, existente?.alicuota),
      );
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({ descripcion: '', idTipoEntidadAporte: null });
    this.detalleAporte.clear();
    this.tiposBaseAporte.forEach((tipo) =>
      this.detalleAporte.push(this.crearFilaDetalle(tipo)),
    );
    this.entidadEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva una entidad de aporte, con confirmación previa */
  cambiarEstado(entidad: EntidadAporte): void {
    const accion = entidad.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: entidad.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${entidad.descripcion}"?`,
        confirmLabel: entidad.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: entidad.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoEntidadAporte(entidad.id, !entidad.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${entidad.activo ? 'Desactivada' : 'Activada'} correctamente`,
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

  get entidadesAporte(): EntidadAporte[] {
    return [...this.parametricasService.entidadesAporte()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoEntidadesAporte();
  }
}
