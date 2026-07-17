import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { Cotizacion, Mineral } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';
import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';

export interface CotizacionDialogData {
  cotizacion?: Cotizacion;
}

@Component({
  selector: 'app-cotizacion-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
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
    MatCheckboxModule,
    ParametricaDialogShellComponent,
  ],
  templateUrl: './cotizacion-form-dialog.component.html',
  styleUrl: './cotizacion-form-dialog.component.scss',
})
export class CotizacionFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<CotizacionFormDialogComponent>,
  );
  private readonly data =
    inject<CotizacionDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  minerales: Mineral[] = [];
  guardando = false;
  columnas = [
    'id',
    'mineral',
    'cotizacion',
    'alicuotaExterna',
    'alicuotaInterna',
    'vigenciaInicial',
    'vigenciaFinal',
    'estado',
    'acciones',
  ];

  // ---------- Búsqueda y paginación ----------
  searchControl = new FormControl('');
  soloVigentes = false;
  pageIndex = 0; // 0-based, como espera mat-paginator
  pageSize = 10;
  private readonly busquedaChange$ = new Subject<void>();

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender solo de `data`.
  cotizacionEditando: Cotizacion | null = null;

  get modoEdicion(): boolean {
    return !!this.cotizacionEditando;
  }

  form: FormGroup = this.fb.group({
    idMineral: [null as number | null, [Validators.required]],
    cotizacionMineralDolares: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    alicuotaExterna: [0, [Validators.min(0)]],
    alicuotaInterna: [0, [Validators.min(0)]],
    fechaVigenciaFinal: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.cargarMinerales();

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

    if (this.data.cotizacion) {
      this.editar(this.data.cotizacion);
    }
  }

  private cargarMinerales(): void {
    this.parametricasService.obtenerMinerales().subscribe({
      next: (data) => {
        this.minerales = data.filter((m) => m.activo !== false);
      },
      error: () =>
        this.snackBar.open('Error al cargar los minerales', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  private recargarTabla(): void {
    this.parametricasService.cargarCotizaciones({
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value?.trim() || undefined,
      vigente: this.soloVigentes || undefined,
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.recargarTabla();
  }

  onToggleSoloVigentes(): void {
    this.pageIndex = 0;
    this.recargarTabla();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const mineral = this.minerales.find(
      (m) => m.id === this.form.get('idMineral')!.value,
    );
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion ? 'Actualizar cotización' : 'Crear cotización',
        message: this.modoEdicion
          ? `¿Confirmas actualizar la cotización de "${mineral?.descripcion ?? ''}"?`
          : `¿Confirmas crear la cotización de "${mineral?.descripcion ?? ''}"?`,
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
      idMineral,
      cotizacionMineralDolares,
      alicuotaExterna,
      alicuotaInterna,
      fechaVigenciaFinal,
    } = this.form.getRawValue();

    const request$ =
      this.modoEdicion && this.cotizacionEditando
        ? this.parametricasService.actualizarCotizacion({
            id: this.cotizacionEditando.id,
            cotizacionMineralDolares,
            alicuotaExterna,
            alicuotaInterna,
            fechaVigenciaFinal,
          })
        : this.parametricasService.crearCotizacion({
            idMineral,
            cotizacionMineralDolares,
            alicuotaExterna,
            alicuotaInterna,
            fechaVigenciaFinal,
          });

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.modoEdicion
            ? 'Cotización actualizada correctamente'
            : 'Cotización creada correctamente',
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

  /** Pone el formulario en modo edición con los datos de la fila seleccionada.
   *  idMineral no se puede cambiar en edición (regla del back), por eso se
   *  deshabilita el control en vez de solo bloquearlo visualmente. */
  editar(cotizacion: Cotizacion): void {
    this.cotizacionEditando = cotizacion;
    this.form.patchValue({
      idMineral: cotizacion.idMineral,
      cotizacionMineralDolares: cotizacion.cotizacionMineralDolares,
      alicuotaExterna: cotizacion.alicuotaExterna,
      alicuotaInterna: cotizacion.alicuotaInterna,
      fechaVigenciaFinal: this.aInputDate(cotizacion.fechaVigenciaFinal),
    });
    this.form.get('idMineral')!.disable();
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      idMineral: null,
      cotizacionMineralDolares: null,
      alicuotaExterna: 0,
      alicuotaInterna: 0,
      fechaVigenciaFinal: '',
    });
    this.form.get('idMineral')!.enable();
    this.cotizacionEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** El back devuelve fechas tipo "2026-08-14T04:00:00.000Z" o "2026-07-15";
   *  el input type="date" necesita siempre "YYYY-MM-DD". */
  private aInputDate(fecha: string): string {
    return fecha?.slice(0, 10) ?? '';
  }

  get cotizaciones(): Cotizacion[] {
    return this.parametricasService.cotizaciones();
  }

  get totalCotizaciones(): number {
    return this.parametricasService.totalCotizaciones();
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoCotizaciones();
  }
}
