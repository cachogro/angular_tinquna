import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../../parametricas/shared/parametrica-dialog-shell.component';
import {
  Cliente,
  Municipio,
  TipoActorProductivoMinero,
} from '../../parametricas/models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

export interface ClienteFormDialogData {
  cliente?: Cliente;
}

/** Valor centinela del control "Tipo de actor": el back lo recibe como
 *  "sin tipo" (campo vacío), pero en el form arranca sin nada seleccionado
 *  para forzar que el usuario elija a conciencia entre un tipo real o esta
 *  opción, en vez de que "sin tipo" quede puesto por defecto sin que nadie
 *  lo haya tocado. */
const SIN_TIPO = 'SIN_TIPO';

/** Mayúsculas, letras (con acentos/ñ), números, espacio y los caracteres
 *  especiales de negocio: # / ° ' " . - _ , */
const CHARSET_NOMBRE_DIRECCION = /^[A-ZÁÉÍÓÚÑÜ0-9#/°'".,_\- ]*$/;
const CARACTERES_INVALIDOS_NOMBRE_DIRECCION = /[^A-ZÁÉÍÓÚÑÜ0-9#/°'".,_\- ]/g;

/** Solo dígitos y el signo "+" */
const CHARSET_TELEFONO = /^[0-9+]*$/;
const CARACTERES_INVALIDOS_TELEFONO = /[^0-9+]/g;

/** Solo dígitos, para el NIT */
const CHARSET_NIT = /^[0-9]*$/;
const CARACTERES_INVALIDOS_NIT = /[^0-9]/g;

/** Mayúsculas, espacios y números (búsqueda de municipio) */
const CARACTERES_INVALIDOS_MUNICIPIO = /[^A-Z0-9 ]/g;

/**
 * Diálogo SOLO de formulario para crear/editar un cliente (comprador del
 * mineral). La bandeja (lista + filtros + paginación) vive en
 * `ClientesCompradoresComponent`; este diálogo se abre desde ahí y se cierra
 * devolviendo el cliente guardado para que la lista se refresque.
 */
@Component({
  selector: 'app-cliente-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatTooltipModule,
    ParametricaDialogShellComponent,
  ],
  templateUrl: './cliente-form-dialog.component.html',
  styleUrl: './cliente-form-dialog.component.scss',
})
export class ClienteFormDialogComponent implements OnInit {
  /** Expuesto para el template: valor de la opción "Sin tipo" del select. */
  readonly SIN_TIPO = SIN_TIPO;

  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<ClienteFormDialogComponent>);
  private readonly data =
    inject<ClienteFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  guardando = false;

  /** Tope del datepicker: no se puede empezar a operar en el futuro. */
  readonly hoy = new Date();

  // ---------- Municipio: autocomplete buscable (departamento/provincia/municipio/código) ----------
  municipios: Municipio[] = [];
  municipiosFiltrados: Municipio[] = [];
  readonly municipioCtrl = new FormControl<Municipio | string | null>('');

  // ---------- Tipo de actor productivo minero: mismo catálogo que ActorProductivoMinero, solo etiqueta ----------
  tiposActor: TipoActorProductivoMinero[] = [];

  clienteEditando: Cliente | null = null;

  get modoEdicion(): boolean {
    return !!this.clienteEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(CHARSET_NOMBRE_DIRECCION),
      ],
    ],
    direccion: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(CHARSET_NOMBRE_DIRECCION),
      ],
    ],
    telefono: [
      '',
      [Validators.maxLength(15), Validators.pattern(CHARSET_TELEFONO)],
    ],
    idMunicipio: [null as number | null],
    // Arranca sin valor (ni siquiera "SIN_TIPO"): el `required` obliga a que
    // el usuario elija explícitamente, aunque termine eligiendo "Sin tipo".
    idTipoActorProductivoMinero: [
      null as number | string | null,
      [Validators.required],
    ],
    nit: ['', [Validators.maxLength(20), Validators.pattern(CHARSET_NIT)]],
    observaciones: ['', [Validators.maxLength(255)]],
    // Obligatoria en el front aunque el back la trate como opcional (default
    // hoy): el sistema migra el histórico del Excel, así que hay que forzar
    // a cargar la fecha real en vez de dejar que quede la de hoy por defecto.
    fechaInicioOperaciones: [null as Date | null, [Validators.required]],
  });

  ngOnInit(): void {
    this.cargarMunicipios();
    this.cargarTiposActor();

    this.registrarSaneador(this.form.get('nombre')!, (v) =>
      this.saneaNombreDireccion(v),
    );
    this.registrarSaneador(this.form.get('direccion')!, (v) =>
      this.saneaNombreDireccion(v),
    );
    this.registrarSaneador(this.form.get('telefono')!, (v) =>
      this.saneaTelefono(v),
    );
    this.registrarSaneador(this.form.get('nit')!, (v) => this.saneaNit(v));

    this.municipioCtrl.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') {
        this.municipiosFiltrados = this.filtrarMunicipios(
          this.mostrarMunicipio(valor),
        );
        return;
      }
      const limpio = this.saneaMunicipioTexto(valor);
      if (limpio !== valor) {
        this.municipioCtrl.setValue(limpio, { emitEvent: false });
      }
      this.municipiosFiltrados = this.filtrarMunicipios(limpio);
    });

    if (this.data.cliente) {
      this.editar(this.data.cliente);
    }
  }

  private saneaNombreDireccion(valor: string): string {
    return valor
      .toUpperCase()
      .replace(CARACTERES_INVALIDOS_NOMBRE_DIRECCION, '');
  }

  private saneaTelefono(valor: string): string {
    return valor.replace(CARACTERES_INVALIDOS_TELEFONO, '');
  }

  private saneaNit(valor: string): string {
    return valor.replace(CARACTERES_INVALIDOS_NIT, '');
  }

  private saneaMunicipioTexto(valor: string): string {
    return valor.toUpperCase().replace(CARACTERES_INVALIDOS_MUNICIPIO, '');
  }

  private registrarSaneador(
    control: AbstractControl,
    sanea: (valor: string) => string,
  ): void {
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = sanea(valor);
      if (limpio !== valor) {
        control.setValue(limpio, { emitEvent: false });
      }
    });
  }

  /** Tipo reservado a la propia empresa (TINKURIKUNA): no se ofrece acá,
   *  mismo criterio que `actor-productivo-minero-form-dialog`. */
  private static readonly ID_TIPO_EMPRESA = '1';

  private cargarTiposActor(): void {
    this.parametricasService.obtenerTiposActorProductivoMinero().subscribe({
      next: (data) => {
        this.tiposActor = data.filter(
          (t) =>
            t.activo !== false &&
            String(t.id) !== ClienteFormDialogComponent.ID_TIPO_EMPRESA,
        );
      },
      error: () =>
        this.snackBar.open('Error al cargar los tipos de actor', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  private cargarMunicipios(): void {
    this.parametricasService.obtenerMunicipios().subscribe({
      next: (data) => {
        this.municipios = data.filter((m) => m.activo !== false);
        this.municipiosFiltrados = this.municipios;
        this.sincronizarMunicipioCtrl();
      },
      error: () =>
        this.snackBar.open('Error al cargar los municipios', 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  private sincronizarMunicipioCtrl(): void {
    const id = this.form.get('idMunicipio')?.value;
    if (id == null) return;
    const municipio = this.municipios.find((m) => m.id === id);
    if (municipio) this.municipioCtrl.setValue(municipio, { emitEvent: false });
  }

  private filtrarMunicipios(texto: string): Municipio[] {
    const filtro = texto.trim().toLowerCase();
    if (!filtro) return this.municipios;
    return this.municipios.filter(
      (m) =>
        m.departamento.toLowerCase().includes(filtro) ||
        m.provincia.toLowerCase().includes(filtro) ||
        m.municipio.toLowerCase().includes(filtro) ||
        m.codigo.toLowerCase().includes(filtro),
    );
  }

  mostrarMunicipio = (municipio: Municipio | string | null): string => {
    if (!municipio) return '';
    if (typeof municipio === 'string') return municipio;
    return `${municipio.departamento} - ${municipio.provincia} - ${municipio.municipio} - ${municipio.codigo}`;
  };

  onMunicipioSeleccionado(event: MatAutocompleteSelectedEvent): void {
    const municipio = event.option.value as Municipio;
    this.form.get('idMunicipio')!.setValue(municipio.id);
  }

  onMunicipioBlur(): void {
    setTimeout(() => this.resolverMunicipioBlur(), 150);
  }

  private resolverMunicipioBlur(): void {
    const valor = this.municipioCtrl.value;
    if (valor && typeof valor === 'object') return;

    const texto = (valor ?? '').toString().trim().toLowerCase();
    const coincidencia = this.municipios.find(
      (m) => this.mostrarMunicipio(m).toLowerCase() === texto,
    );
    if (coincidencia) {
      this.municipioCtrl.setValue(coincidencia);
      this.form.get('idMunicipio')!.setValue(coincidencia.id);
    } else {
      this.municipioCtrl.setValue('');
      this.form.get('idMunicipio')!.setValue(null);
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion ? 'Actualizar cliente' : 'Crear cliente',
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
    const {
      nombre,
      direccion,
      telefono,
      idMunicipio,
      idTipoActorProductivoMinero,
      nit,
      observaciones,
      fechaInicioOperaciones,
    } = this.form.getRawValue();

    this.parametricasService
      .guardarCliente({
        id: this.clienteEditando?.id,
        nombre,
        direccion: direccion.trim(),
        telefono: telefono?.trim() || undefined,
        idMunicipio: idMunicipio ?? undefined,
        // "Sin tipo" es una elección consciente del usuario, pero al back se
        // le manda vacío (ahí es opcional de verdad).
        idTipoActorProductivoMinero:
          idTipoActorProductivoMinero === SIN_TIPO
            ? undefined
            : (idTipoActorProductivoMinero ?? undefined),
        nit: nit?.trim() || undefined,
        observaciones: observaciones?.trim() || undefined,
        fechaInicioOperaciones: this.formatFecha(fechaInicioOperaciones!),
      })
      .subscribe({
        next: (cliente) => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Cliente actualizado correctamente'
              : 'Cliente creado correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          this.dialogRef.close(cliente ?? true);
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

  private editar(cliente: Cliente): void {
    this.clienteEditando = cliente;
    this.form.patchValue({
      nombre: cliente.nombre,
      direccion: cliente.direccion ?? '',
      telefono: cliente.telefono ?? '',
      idMunicipio: cliente.idMunicipio ?? null,
      // Un cliente ya guardado sin tipo se precarga como "Sin tipo" explícito
      // (no en blanco): editar no debería forzar a re-elegir algo que ya
      // quedó decidido al crearlo.
      idTipoActorProductivoMinero: cliente.idTipoActorProductivoMinero ?? SIN_TIPO,
      nit: cliente.nit ?? '',
      observaciones: cliente.observaciones ?? '',
      fechaInicioOperaciones: this.parseFecha(cliente.fechaInicioOperaciones),
    });
    if (cliente.municipio) {
      this.municipioCtrl.setValue(cliente.municipio, { emitEvent: false });
    } else {
      this.sincronizarMunicipioCtrl();
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  /** Date -> "YYYY-MM-DD" con las partes locales (sin corrimiento por zona horaria) */
  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /** "YYYY-MM-DD" (u otra fecha ISO) -> Date local, o null si no hay valor */
  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }
}
