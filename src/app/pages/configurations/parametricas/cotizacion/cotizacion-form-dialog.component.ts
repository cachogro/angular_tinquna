import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
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
import { Cotizacion, FiltrosCotizacion, Mineral } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';
import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';

interface OpcionOrden {
  value: string;
  label: string;
}

export interface CotizacionDialogData {
  cotizacion?: Cotizacion;
  /** Al abrir en modo "nueva" (sin `cotizacion`), preselecciona este mineral.
   *  Útil cuando el modal se abre desde valorización porque un mineral no
   *  tiene cotización vigente. */
  idMineralPreseleccionado?: number;
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
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTableModule,
    MatIconModule,
    MatSelectModule,
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
  mineralesFiltrados: Mineral[] = [];
  /** Control aparte del `form`: guarda lo que se ve en el input (texto
   *  mientras se busca, o el Mineral una vez seleccionado). El id real
   *  seleccionado sigue viviendo en `form.get('idMineral')`. */
  readonly mineralCtrl = new FormControl<Mineral | string | null>('');
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

  readonly opcionesOrden: OpcionOrden[] = [
    { value: 'id', label: 'ID' },
    { value: 'mineral', label: 'Mineral' },
    { value: 'fechaVigenciaInicial', label: 'Vigencia desde' },
    { value: 'fechaVigenciaFinal', label: 'Vigencia hasta' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  // Estado propio del componente: permite pasar de "nuevo" a "edición"
  // sin depender solo de `data`.
  cotizacionEditando: Cotizacion | null = null;

  get modoEdicion(): boolean {
    return !!this.cotizacionEditando;
  }

  /** Fecha de hoy en hora local, "YYYY-MM-DD". Sirve como mínimo del date
   *  input y para validar que fechaVigenciaFinal no sea anterior a hoy
   *  (el back rechaza esas fechas con 400). */
  readonly fechaMinima = this.obtenerFechaHoyLocal();

  private validarFechaNoAnteriorAHoy = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (!control.value) return null;
    return control.value < this.fechaMinima ? { fechaPasada: true } : null;
  };

  form: FormGroup = this.fb.group({
    idMineral: [null as number | null, [Validators.required]],
    cotizacionMineralDolares: [
      null as number | null,
      [Validators.required, Validators.min(0), this.validarMaxDecimales(5)],
    ],
    alicuotaExterna: [
      null as number | null,
      [Validators.min(0), this.validarMaxDecimales(5)],
    ],
    alicuotaInterna: [
      null as number | null,
      [Validators.min(0), this.validarMaxDecimales(5)],
    ],
    fechaVigenciaFinal: [
      '',
      [Validators.required, this.validarFechaNoAnteriorAHoy],
    ],
  });

  private obtenerFechaHoyLocal(): string {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** El back acepta como máximo 5 decimales en cotización y alícuotas */
  private validarMaxDecimales(max: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value === null || value === undefined || value === '') return null;
      const decimales = value.toString().split('.')[1]?.length ?? 0;
      return decimales > max ? { maxDecimales: { max } } : null;
    };
  }

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

    this.mineralCtrl.valueChanges.subscribe((valor) => {
      const texto = typeof valor === 'string' ? valor : (valor?.descripcion ?? '');
      this.mineralesFiltrados = this.filtrarMinerales(texto);
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

    if (this.data.cotizacion) {
      this.editar(this.data.cotizacion);
    } else if (this.data.idMineralPreseleccionado) {
      this.form.patchValue({ idMineral: this.data.idMineralPreseleccionado });
    }
  }

  private cargarMinerales(): void {
    this.parametricasService.obtenerMinerales().subscribe({
      next: (data) => {
        this.minerales = data.filter((m) => m.activo !== false);
        this.mineralesFiltrados = this.minerales;
        this.sincronizarMineralCtrl();
      },
      error: () =>
        this.snackBar.open('Error al cargar los minerales', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  /** Refleja en el input de búsqueda el mineral que ya está seleccionado en
   *  `form.get('idMineral')` (al editar, o al preseleccionar). Se llama tras
   *  cargar los minerales por si el id ya estaba seteado antes de tenerlos. */
  private sincronizarMineralCtrl(): void {
    const id = this.form.get('idMineral')?.value;
    if (id == null) return;
    const mineral = this.minerales.find((m) => m.id === id);
    if (mineral) this.mineralCtrl.setValue(mineral, { emitEvent: false });
  }

  private filtrarMinerales(texto: string): Mineral[] {
    const filtro = texto.trim().toLowerCase();
    if (!filtro) return this.minerales;
    return this.minerales.filter((m) =>
      m.descripcion.toLowerCase().includes(filtro),
    );
  }

  mostrarMineral = (mineral: Mineral | string | null): string => {
    if (!mineral) return '';
    if (typeof mineral === 'string') return mineral;
    return `${mineral.descripcion} (${mineral.simbolo ?? ''})`;
  };

  onMineralSeleccionado(event: MatAutocompleteSelectedEvent): void {
    const mineral = event.option.value as Mineral;
    this.form.get('idMineral')!.setValue(mineral.id);
    this.form.get('idMineral')!.markAsTouched();
  }

  /** Si al salir del campo no se llegó a seleccionar un mineral real de la
   *  lista (p. ej. el usuario escribió y no eligió ninguna opción), se
   *  intenta hacer match exacto por descripción; si no hay match, se limpia
   *  el campo para que el validator `required` de idMineral lo marque. */
  onMineralBlur(): void {
    const valor = this.mineralCtrl.value;
    if (valor && typeof valor === 'object') return;

    const texto = (valor ?? '').toString().trim().toLowerCase();
    const coincidencia = this.minerales.find(
      (m) => m.descripcion.toLowerCase() === texto,
    );
    if (coincidencia) {
      this.mineralCtrl.setValue(coincidencia);
      this.form.get('idMineral')!.setValue(coincidencia.id);
    } else {
      this.mineralCtrl.setValue('');
      this.form.get('idMineral')!.setValue(null);
    }
    this.form.get('idMineral')!.markAsTouched();
  }

  /** El buscador de mineral solo admite letras, espacios y acentos */
  soloLetras(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length > 1) return; // teclas de control: Backspace, Tab, ArrowLeft, etc.
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  /** Evita el signo "-" (y notación "e") en los campos numéricos: no deben
   *  aceptar negativos, ni siquiera tecleados a mano. */
  bloquearNegativos(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  private recargarTabla(): void {
    this.parametricasService.cargarCotizaciones({
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value?.trim() || undefined,
      vigente: this.soloVigentes || undefined,
      orderBy: (this.orderByControl.value as FiltrosCotizacion['orderBy']) ?? undefined,
      orderDirection: this.orderDirectionControl.value ?? undefined,
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

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
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

    // Si el usuario deja alicuotaExterna/alicuotaInterna vacías, no se
    // incluyen en el body: el back solo aplica su fallback (heredar de la
    // última cotización, o no modificar en edición) cuando la propiedad es
    // undefined. Mandar null o 0 explícito rompería esa lógica.
    const alicuotas: { alicuotaExterna?: number; alicuotaInterna?: number } =
      {};
    if (alicuotaExterna !== null && alicuotaExterna !== '') {
      alicuotas.alicuotaExterna = alicuotaExterna;
    }
    if (alicuotaInterna !== null && alicuotaInterna !== '') {
      alicuotas.alicuotaInterna = alicuotaInterna;
    }

    const request$ =
      this.modoEdicion && this.cotizacionEditando
        ? this.parametricasService.actualizarCotizacion({
            id: this.cotizacionEditando.id,
            cotizacionMineralDolares,
            fechaVigenciaFinal,
            ...alicuotas,
          })
        : this.parametricasService.crearCotizacion({
            idMineral,
            cotizacionMineralDolares,
            fechaVigenciaFinal,
            ...alicuotas,
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
    this.sincronizarMineralCtrl();
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      idMineral: null,
      cotizacionMineralDolares: null,
      alicuotaExterna: null,
      alicuotaInterna: null,
      fechaVigenciaFinal: '',
    });
    this.form.get('idMineral')!.enable();
    this.mineralCtrl.setValue('');
    this.mineralesFiltrados = this.minerales;
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

  /** Formatea a "dd/mm/aaaa" para la tabla. Se hace por string, sin pasar
   *  por `Date`, para no arrastrar el offset del timestamp completo
   *  ("...T15:42:10.123-04:00") ni el de fechas legadas sin hora
   *  ("2026-07-15") — ambas ya traen el día calendario correcto. */
  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const [year, month, day] = fecha.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
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
