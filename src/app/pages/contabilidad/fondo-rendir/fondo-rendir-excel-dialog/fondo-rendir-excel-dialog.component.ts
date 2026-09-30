// src/app/pages/contabilidad/fondo-rendir/fondo-rendir-excel-dialog/fondo-rendir-excel-dialog.component.ts
// Reporte Excel de rendición de cuentas de un destinatario (persona o actor),
// mensual o anual. Se abre desde la bandeja (vacío) o desde un fondo
// (precargado con su destinatario y período).
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, forkJoin, map, Observable, startWith } from 'rxjs';
import {
  ActorProductivoMinero,
  PersonaCI,
} from '../../../configurations/models/persona.models';
import { PersonaService } from '../../../configurations/services/persona.service';
import { ExcelFondoRendirRequest } from '../../models/fondo-rendir.models';
import { FondoRendirService } from '../../services/fondo-rendir.service';
import { mensajeErrorBlob } from '../../../../shared/utils/descarga-archivo.util';

type DestinatarioTipo = 'PERSONA' | 'ACTOR';
type Periodo = 'MENSUAL' | 'ANUAL';
type PersonaControlValue = PersonaCI | string | null;

export interface FondoRendirExcelDialogData {
  idPersona?: string | null;
  idActorProductivoMinero?: string | null;
  gestion?: number;
  mes?: number;
}

@Component({
  selector: 'app-fondo-rendir-excel-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './fondo-rendir-excel-dialog.component.html',
  styleUrl: './fondo-rendir-excel-dialog.component.scss',
})
export class FondoRendirExcelDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<FondoRendirExcelDialogComponent>,
  );
  readonly data =
    inject<FondoRendirExcelDialogData | null>(MAT_DIALOG_DATA, {
      optional: true,
    }) ?? {};
  private readonly fondoRendirService = inject(FondoRendirService);
  private readonly personaService = inject(PersonaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly descargandoExcel = signal(false);

  readonly personas = signal<PersonaCI[]>([]);
  readonly actores = signal<ActorProductivoMinero[]>([]);

  readonly meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  private readonly hoy = new Date();

  readonly form = new FormGroup({
    destinatarioTipo: new FormControl<DestinatarioTipo>(
      this.data.idActorProductivoMinero ? 'ACTOR' : 'PERSONA',
      { nonNullable: true },
    ),
    personaDestinatario: new FormControl<PersonaControlValue>(null),
    idActorDestinatario: new FormControl<string | null>(
      this.data.idActorProductivoMinero ?? null,
    ),
    periodo: new FormControl<Periodo>('MENSUAL', { nonNullable: true }),
    gestion: new FormControl<number | null>(
      this.data.gestion ?? this.hoy.getFullYear(),
      [Validators.required, Validators.min(2000), Validators.max(2100)],
    ),
    mes: new FormControl<number | null>(
      this.data.mes ?? this.hoy.getMonth() + 1,
    ),
  });

  get f() {
    return this.form.controls;
  }

  get destinatarioTipo(): DestinatarioTipo {
    return this.f.destinatarioTipo.value;
  }

  get esMensual(): boolean {
    return this.f.periodo.value === 'MENSUAL';
  }

  readonly personasFiltradas$: Observable<PersonaCI[]> = combineLatest([
    this.form.controls.personaDestinatario.valueChanges.pipe(startWith('')),
    toObservable(this.personas),
  ]).pipe(map(([valor, lista]) => this.filtrarPersonas(valor, lista)));

  ngOnInit(): void {
    this.f.destinatarioTipo.valueChanges.subscribe(() => {
      this.f.personaDestinatario.setValue(null, { emitEvent: false });
      this.f.idActorDestinatario.setValue(null, { emitEvent: false });
    });

    forkJoin({
      personas: this.personaService.listarPersonas({
        page: 1,
        limit: 1000,
        activo: true,
      }),
      actores: this.personaService.getAllActoresMineros(),
    }).subscribe({
      next: ({ personas, actores }) => {
        this.personas.set(personas.data ?? []);
        this.actores.set(actores);
        this.precargarPersona();
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  private precargarPersona(): void {
    const id = this.data.idPersona;
    if (!id) return;
    const p = this.personas().find((x) => String(x.id) === String(id));
    if (p) this.f.personaDestinatario.setValue(p);
  }

  // ---------- Destinatario ----------

  nombreCompleto(p: PersonaCI): string {
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  displayPersona = (valor: PersonaControlValue): string => {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    return `${this.nombreCompleto(valor)} — ${valor.numeroDocumento}`;
  };

  private filtrarPersonas(
    valor: PersonaControlValue,
    lista: PersonaCI[],
  ): PersonaCI[] {
    const texto = (
      typeof valor === 'string' ? valor : valor ? this.nombreCompleto(valor) : ''
    )
      .trim()
      .toLowerCase();
    if (!texto) return lista.slice(0, 50);
    return lista
      .filter(
        (p) =>
          this.nombreCompleto(p).toLowerCase().includes(texto) ||
          (p.numeroDocumento ?? '').toLowerCase().includes(texto),
      )
      .slice(0, 50);
  }

  private resolverDestinatario():
    | { idPersona?: string; idActorProductivoMinero?: string; nombre: string }
    | string {
    if (this.destinatarioTipo === 'ACTOR') {
      const idActor = this.f.idActorDestinatario.value;
      const actor = this.actores().find((a) => String(a.id) === String(idActor));
      return idActor
        ? { idActorProductivoMinero: idActor, nombre: actor?.nombre ?? idActor }
        : 'Elige el actor productivo destinatario';
    }
    const p = this.f.personaDestinatario.value;
    return p && typeof p === 'object'
      ? { idPersona: String(p.id), nombre: this.nombreCompleto(p) }
      : 'Elige la persona destinataria';
  }

  // ---------- Descargar ----------

  cancelar(): void {
    this.dialogRef.close();
  }

  descargarExcel(): void {
    if (this.descargandoExcel()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const destinatario = this.resolverDestinatario();
    if (typeof destinatario === 'string') {
      this.snackBar.open(destinatario, 'Cerrar', { duration: 4000 });
      return;
    }
    const gestion = Number(this.f.gestion.value);
    const mes = this.esMensual ? this.f.mes.value : null;
    if (this.esMensual && mes == null) {
      this.snackBar.open('Elige el mes del reporte', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    const { nombre, ...ids } = destinatario;
    const filtro: ExcelFondoRendirRequest = { ...ids, gestion };
    if (mes != null) filtro.mes = mes;

    this.descargandoExcel.set(true);
    this.fondoRendirService.descargarExcel(filtro).subscribe({
      next: (blob) => {
        this.descargandoExcel.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nombreArchivo = nombre.trim().replace(/\s+/g, '_').toUpperCase();
        const periodo =
          mes != null ? `${gestion}-${String(mes).padStart(2, '0')}` : `${gestion}`;
        a.download = `rendicion-cuentas-${nombreArchivo}-${periodo}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: async (err) => {
        this.descargandoExcel.set(false);
        this.snackBar.open(
          (await mensajeErrorBlob(err)) ??
            'No se pudo generar el Excel de rendición de cuentas',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }
}
