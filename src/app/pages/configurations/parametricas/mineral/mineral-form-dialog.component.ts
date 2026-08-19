import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { Mineral } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

@Component({
  selector: 'app-mineral-form-dialog',
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
    ParametricaDialogShellComponent,
  ],
  templateUrl: './mineral-form-dialog.component.html',
  styleUrl: './mineral-form-dialog.component.scss',
})
export class MineralFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<MineralFormDialogComponent>);

  guardando = false;
  columnas = [
    'id',
    'descripcion',
    'simbolo',
    'unidadCotizacion',
    'factorConversion',
    'alicuotaExterna',
    'alicuotaInterna',
    'tipo',
    'estado',
    'acciones',
  ];

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender de datos inyectados en el modal.
  mineralEditando: Mineral | null = null;

  get modoEdicion(): boolean {
    return !!this.mineralEditando;
  }

  // Solo la descripción es obligatoria; el resto de campos son opcionales
  // según lo definido por el back.
  // Límites de longitud tomados de los ejemplos de negocio más largos:
  // descripción -> 'Manufactura de Aleaciones de Oro' (32), detalle -> 'Recursos Evaporiticos(Otros Subprod y Deriv)' (44).
  form: FormGroup = this.fb.group({
    descripcion: ['', [Validators.required, Validators.maxLength(32)]],
    simbolo: ['', [Validators.maxLength(10)]],
    unidadCotizacion: ['', [Validators.maxLength(4)]],
    detalleMineral: ['', [Validators.maxLength(44)]],
    factorConversion: [null, [MineralFormDialogComponent.numeroPositivo()]],
    tipo: ['', [Validators.maxLength(50)]],
    // No obligatorias: algunos minerales no tienen alícuota configurada.
    alicuotaExterna: [
      null as number | null,
      [Validators.min(0), this.validarMaxDecimales(5)],
    ],
    alicuotaInterna: [
      null as number | null,
      [Validators.min(0), this.validarMaxDecimales(5)],
    ],
  });

  /** No es obligatorio, pero si se llena debe ser un número mayor a cero */
  private static numeroPositivo(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = control.value;
      if (valor === null || valor === undefined || valor === '') return null;
      return Number(valor) > 0 ? null : { numeroPositivo: true };
    };
  }

  /** El back acepta como máximo 5 decimales en las alícuotas */
  private validarMaxDecimales(max: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = control.value;
      if (valor === null || valor === undefined || valor === '') return null;
      const decimales = valor.toString().split('.')[1]?.length ?? 0;
      return decimales > max ? { maxDecimales: { max } } : null;
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
    // Máximo ~decenas de minerales esperados: se listan todos sin paginación.
    this.parametricasService.cargarMinerales();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { descripcion } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion ? 'Actualizar mineral' : 'Crear mineral',
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
    const {
      descripcion,
      simbolo,
      unidadCotizacion,
      detalleMineral,
      factorConversion,
      tipo,
      alicuotaExterna,
      alicuotaInterna,
    } = this.form.getRawValue();

    // Un solo POST: si hay mineral en edición, se manda su id y el back
    // actualiza; si no, lo crea.
    this.parametricasService
      .guardarMineral({
        id: this.mineralEditando?.id,
        descripcion,
        simbolo: simbolo?.trim() || undefined,
        unidadCotizacion: unidadCotizacion?.trim() || undefined,
        detalleMineral: detalleMineral?.trim() || undefined,
        factorConversion: factorConversion ?? undefined,
        tipo: tipo?.trim() || undefined,
        alicuotaExterna: alicuotaExterna ?? undefined,
        alicuotaInterna: alicuotaInterna ?? undefined,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Mineral actualizado correctamente'
              : 'Mineral creado correctamente',
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
  editar(mineral: Mineral): void {
    this.mineralEditando = mineral;
    this.form.patchValue({
      descripcion: mineral.descripcion,
      simbolo: mineral.simbolo ?? '',
      unidadCotizacion: mineral.unidadCotizacion ?? '',
      detalleMineral: mineral.detalleMineral ?? '',
      factorConversion: mineral.factorConversion ?? null,
      tipo: mineral.tipo ?? '',
      alicuotaExterna: mineral.alicuotaExterna ?? null,
      alicuotaInterna: mineral.alicuotaInterna ?? null,
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      descripcion: '',
      simbolo: '',
      unidadCotizacion: '',
      detalleMineral: '',
      factorConversion: null,
      tipo: '',
      alicuotaExterna: null,
      alicuotaInterna: null,
    });
    this.mineralEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva un mineral, con confirmación previa */
  cambiarEstado(mineral: Mineral): void {
    const accion = mineral.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: mineral.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${mineral.descripcion}"?`,
        confirmLabel: mineral.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: mineral.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoMineral(mineral.id, !mineral.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${mineral.activo ? 'Desactivado' : 'Activado'} correctamente`,
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

  get minerales(): Mineral[] {
    return [...this.parametricasService.minerales()].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoMinerales();
  }
}
