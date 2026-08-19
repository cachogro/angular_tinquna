import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import {
  EscalaPrecio,
  FilaEscalaPrecioRequest,
  Mineral,
} from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';

export interface EscalaPrecioDialogData {
  /** Preselecciona este mineral al abrir. Útil cuando el modal se abre
   *  desde valorización (RAM) porque un mineral no tiene tabla vigente. */
  idMineralPreseleccionado?: number;
}

@Component({
  selector: 'app-escala-precio-form-dialog',
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
    ParametricaDialogShellComponent,
  ],
  templateUrl: './escala-precio-form-dialog.component.html',
  styleUrl: './escala-precio-form-dialog.component.scss',
})
export class EscalaPrecioFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<EscalaPrecioFormDialogComponent>,
  );
  private readonly data =
    inject<EscalaPrecioDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  /** Tope de filas que se generan de una sola vez: como máximo se
   *  registran 100 tramos por tabla (ej. rango de ley 0 a 100). */
  private readonly MAX_FILAS = 100;

  /** leyInicial con el que se generó la tabla actual (se guarda aparte del
   *  form porque cuando cambia el rango hay que saber el rango VIEJO para
   *  poder emparejar cada fila con su ley real y no perder lo ya tecleado). */
  private leyInicialVigente: number | null = null;

  minerales: Mineral[] = [];
  guardando = false;

  columnasVigente = [
    'ley',
    'precioPunto',
    'precioTm',
    'vigenciaInicial',
    'vigenciaFinal',
    'acciones',
  ];

  /** Fecha de hoy en hora local, "YYYY-MM-DD": mínimo de los date inputs de vigencia. */
  readonly fechaMinima = this.obtenerFechaHoyLocal();

  /** Filtro de historial de la "Tabla vigente": vacío = tabla vigente ahora
   *  mismo; con fecha = la tabla que regía ese día. No forma parte de
   *  `form` porque es solo de consulta, no se manda en ningún guardado. */
  readonly fechaConsultaControl = new FormControl<string>('');

  /** true mientras se está viendo una tabla histórica (con fecha filtrada):
   *  en ese modo la edición inline se deshabilita, porque el back solo deja
   *  modificar tramos que siguen vigentes ahora mismo. */
  get modoHistorico(): boolean {
    return !!this.fechaConsultaControl.value;
  }

  form: FormGroup = this.fb.group(
    {
      idMineral: [null as number | null, [Validators.required]],
      fechaVigenciaInicial: ['', [Validators.required]],
      fechaVigenciaFinal: ['', [Validators.required]],
      /** Rango de ley: la tabla se genera con exactamente
       *  (leyFinal - leyInicial + 1) filas, correlativas. */
      leyInicial: [
        null as number | null,
        [Validators.required, Validators.min(0)],
      ],
      leyFinal: [
        null as number | null,
        [Validators.required, Validators.min(0)],
      ],
      /** Una fila por cada tramo de ley; solo lleva el USD/Punto tecleado
       *  por el usuario (la ley y el USD/TM se calculan, no se guardan acá). */
      filas: this.fb.array(
        [] as FormGroup[],
        EscalaPrecioFormDialogComponent.alMenosUnaFilaLlena(),
      ),
    },
    {
      validators: [
        EscalaPrecioFormDialogComponent.vigenciaFinalPosterior(),
        EscalaPrecioFormDialogComponent.rangoLeyValido(),
      ],
    },
  );

  get filas(): FormArray {
    return this.form.get('filas') as FormArray;
  }

  private crearFilaNueva(precioPuntoInicial: number | null = null): FormGroup {
    return this.fb.group({
      precioPunto: [precioPuntoInicial, [Validators.min(0)]],
    });
  }

  /** Reconstruye `filas` para que tenga exactamente una fila por cada ley
   *  del rango [leyInicial, leyFinal]. Si el usuario ya había tecleado
   *  USD/Punto y solo ajusta el rango, esos valores se conservan
   *  emparejándolos por ley real (no por posición). */
  private regenerarFilas(): void {
    const inicialRaw = this.form.get('leyInicial')?.value;
    const finalRaw = this.form.get('leyFinal')?.value;
    const inicial =
      inicialRaw === null || inicialRaw === '' ? null : Number(inicialRaw);
    const final =
      finalRaw === null || finalRaw === '' ? null : Number(finalRaw);

    const valoresPrevios = new Map<number, number>();
    if (this.leyInicialVigente !== null) {
      this.filas.controls.forEach((f, i) => {
        const valor = f.get('precioPunto')?.value;
        if (valor !== null && valor !== undefined && valor !== '') {
          valoresPrevios.set(this.leyInicialVigente! + i, Number(valor));
        }
      });
    }

    this.filas.clear();
    this.leyInicialVigente = inicial;

    if (inicial === null || final === null || final < inicial) return;

    const cantidad = Math.min(final - inicial + 1, this.MAX_FILAS);
    for (let i = 0; i < cantidad; i++) {
      const ley = inicial + i;
      this.filas.push(this.crearFilaNueva(valoresPrevios.get(ley) ?? null));
    }
  }

  /** Al menos una fila debe tener el USD/Punto cargado para poder guardar. */
  private static alMenosUnaFilaLlena(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const filas = (control as FormArray).controls;
      const tieneAlguna = filas.some((f) => {
        const valor = f.get('precioPunto')?.value;
        return valor !== null && valor !== undefined && valor !== '';
      });
      return tieneAlguna ? null : { sinFilas: true };
    };
  }

  private static vigenciaFinalPosterior(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const inicial = group.get('fechaVigenciaInicial')?.value;
      const final = group.get('fechaVigenciaFinal')?.value;
      if (!inicial || !final) return null;
      return final > inicial ? null : { vigenciaInvalida: true };
    };
  }

  private static rangoLeyValido(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const inicial = group.get('leyInicial')?.value;
      const final = group.get('leyFinal')?.value;
      if (inicial === null || inicial === '' || final === null || final === '')
        return null;
      return Number(final) >= Number(inicial) ? null : { rangoLeyInvalido: true };
    };
  }

  ngOnInit(): void {
    this.parametricasService.obtenerMinerales().subscribe({
      next: (data) => (this.minerales = data.filter((m) => m.activo !== false)),
      error: () =>
        this.snackBar.open('Error al cargar los minerales', 'Cerrar', {
          duration: 3000,
        }),
    });

    // Cada vez que se elige un mineral, se muestra su tabla vigente (ahora
    // mismo) debajo, y se limpia cualquier filtro de fecha que haya quedado
    // de un mineral anterior.
    this.form.get('idMineral')!.valueChanges.subscribe(() => {
      this.filaEditandoId = null;
      this.fechaConsultaControl.setValue('', { emitEvent: false });
      this.recargarTablaVigente();
    });

    if (this.data.idMineralPreseleccionado) {
      this.form.patchValue({ idMineral: this.data.idMineralPreseleccionado });
    }

    // El tamaño de la tabla sale directo del rango de ley: se regenera sola
    // apenas el usuario termina de escribir leyInicial o leyFinal.
    this.form.get('leyInicial')!.valueChanges.subscribe(() => this.regenerarFilas());
    this.form.get('leyFinal')!.valueChanges.subscribe(() => this.regenerarFilas());

    // Filtro de historial: con fecha, trae la tabla que regía ese día; vacío
    // vuelve a la vigente ahora mismo.
    this.fechaConsultaControl.valueChanges.subscribe(() => {
      this.filaEditandoId = null;
      this.recargarTablaVigente();
    });
  }

  private recargarTablaVigente(): void {
    const idMineral = this.form.get('idMineral')!.value;
    if (!idMineral) return;
    this.parametricasService.cargarEscalaPrecioVigente(
      idMineral,
      this.fechaConsultaControl.value || undefined,
    );
  }

  /** Vuelve a mostrar la tabla vigente ahora mismo (sale del modo histórico). */
  limpiarFechaConsulta(): void {
    this.fechaConsultaControl.setValue('');
  }

  /** Ley que le corresponde a la fila `i`: leyInicial + i (correlativa, no se teclea). */
  leyFila(i: number): number | null {
    const inicial = this.form.get('leyInicial')?.value;
    if (inicial === null || inicial === undefined || inicial === '')
      return null;
    return Number(inicial) + i;
  }

  /** USD/TM de la fila `i`: ley × USD/Punto, se recalcula solo. */
  usdTmFila(i: number): number {
    const ley = this.leyFila(i);
    const precioPunto = Number(this.filas.at(i)?.get('precioPunto')?.value ?? 0);
    if (ley === null || !precioPunto) return 0;
    return this.redondear(ley * precioPunto);
  }

  /** Evita el signo "-" (y notación "e") en los campos numéricos */
  bloquearNegativos(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const mineral = this.minerales.find(
      (m) => m.id === this.form.get('idMineral')!.value,
    );
    const cantidad = this.construirFilasParaEnviar().length;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Registrar tabla de escala de precio',
        message: `¿Confirmas registrar ${cantidad} tramo(s) de ley para "${mineral?.descripcion ?? ''}"?`,
        confirmLabel: 'Registrar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: 'add_circle_outline',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) this.persistir();
    });
  }

  /** Solo se mandan las filas donde el usuario cargó el USD/Punto; el resto
   *  (de las 10 que se muestran en blanco) se ignora. */
  private construirFilasParaEnviar(): FilaEscalaPrecioRequest[] {
    return this.filas.controls
      .map((f, i) => ({
        ley: this.leyFila(i),
        precioPunto: f.get('precioPunto')?.value,
      }))
      .filter(
        (f) =>
          f.ley !== null &&
          f.precioPunto !== null &&
          f.precioPunto !== undefined &&
          f.precioPunto !== '',
      )
      .map((f) => ({
        ley: f.ley as number,
        precioPunto: Number(f.precioPunto),
        precioTm: this.redondear((f.ley as number) * Number(f.precioPunto)),
      }));
  }

  private persistir(): void {
    this.guardando = true;
    const { idMineral, fechaVigenciaInicial, fechaVigenciaFinal } =
      this.form.getRawValue();

    this.parametricasService
      .crearEscalaPrecio({
        idMineral,
        fechaVigenciaInicial: this.fechaInicioISO(fechaVigenciaInicial),
        fechaVigenciaFinal: this.fechaFinISO(fechaVigenciaFinal),
        filas: this.construirFilasParaEnviar(),
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            'Tabla de escala de precio registrada correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          this.limpiarFilas();
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

  /** Deja mineral y fechas elegidos (para seguir cargando el mismo período) y solo limpia el rango/tramos. */
  private limpiarFilas(): void {
    this.form.patchValue(
      { leyInicial: null, leyFinal: null },
      { emitEvent: false },
    );
    this.leyInicialVigente = null;
    this.filas.clear();
    // El back ya recargó la tabla vigente ahora mismo (ver crearEscalaPrecio):
    // si había un filtro de fecha activo, se limpia para no mostrar un
    // título "histórico" con datos que en realidad son los recién guardados.
    this.fechaConsultaControl.setValue('', { emitEvent: false });
  }

  cancelar(): void {
    this.form.reset({
      idMineral: null,
      fechaVigenciaInicial: '',
      fechaVigenciaFinal: '',
      leyInicial: null,
      leyFinal: null,
    });
    this.leyInicialVigente = null;
    this.filas.clear();
    this.fechaConsultaControl.setValue('', { emitEvent: false });
  }

  // ==========================================================
  // TABLA VIGENTE (edición inline: solo precioPunto, precioTm se recalcula solo)
  // ==========================================================

  filaEditandoId: number | null = null;
  edicion = { precioPunto: 0 };

  editarFila(fila: EscalaPrecio): void {
    // Una tabla histórica es de solo lectura: el back solo deja modificar
    // tramos que siguen vigentes ahora mismo.
    if (this.modoHistorico) return;
    this.filaEditandoId = fila.id;
    this.edicion = { precioPunto: fila.precioPunto };
  }

  cancelarEdicion(): void {
    this.filaEditandoId = null;
  }

  /** precioTm de la fila en edición, recalculado en vivo (nunca se teclea a mano). */
  precioTmEdicion(ley: number): number {
    return this.redondear(ley * this.edicion.precioPunto);
  }

  guardarEdicion(fila: EscalaPrecio): void {
    const idMineral = this.form.get('idMineral')!.value;
    this.parametricasService
      .actualizarEscalaPrecio(
        {
          filas: [
            {
              id: fila.id,
              precioPunto: this.edicion.precioPunto,
              precioTm: this.precioTmEdicion(fila.ley),
            },
          ],
        },
        idMineral,
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Tramo actualizado correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.filaEditandoId = null;
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message ?? 'Ocurrió un error al actualizar',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  get escalaVigente(): EscalaPrecio[] {
    return this.parametricasService.escalaPrecioVigente();
  }

  get cargandoVigente(): boolean {
    return this.parametricasService.cargandoEscalaPrecio();
  }

  private obtenerFechaHoyLocal(): string {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** El back espera timestamps ISO con offset de Bolivia (-04:00) para que
   *  el día calendario no se corra al guardarse en UTC. */
  private fechaInicioISO(fecha: string): string {
    return `${fecha}T00:00:00.000-04:00`;
  }

  private fechaFinISO(fecha: string): string {
    return `${fecha}T23:59:59.999-04:00`;
  }

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const [year, month, day] = fecha.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}
