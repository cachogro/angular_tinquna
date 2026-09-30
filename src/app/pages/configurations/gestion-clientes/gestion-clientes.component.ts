import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  FiltrosPersona,
  PersonaCI,
  PersonaTipoCatalogo,
} from '../models/persona.models';
import { PersonaService } from '../services/persona.service';
import {
  PersonaFormDialogComponent,
  PersonaFormDialogData,
} from './persona-form-dialog/persona-form-dialog.component';
import {
  KardexGestionData,
  irAGestionKardex,
} from '../../contabilidad/kardex/kardex-gestion/kardex-gestion.component';

interface OpcionOrden {
  value: string;
  label: string;
}

/** Id del actor productivo minero que representa a la propia empresa
 *  (TINKURIKUNA). Su personal vive en la pestaña dedicada "Personal interno"
 *  (`PersonalInternoComponent`); esta bandeja ("Compras (Internos)") es para
 *  el resto: proveedores, choferes, socios, etc. de otros actores. */
const ID_ACTOR_EMPRESA = '1';

@Component({
  selector: 'app-gestion-clientes',
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatButtonModule,
    MatCardModule,
    CommonModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './gestion-clientes.component.html',
  styleUrl: './gestion-clientes.component.scss',
})
export class GestionClientesComponent implements OnInit {
  private readonly personaService = inject(PersonaService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'id',
    'persona',
    'documento',
    'tipos',
    'estado',
    'acciones',
  ];

  /** Todas las personas que matchean los filtros de backend, ya excluido el
   *  personal propio de TINKURIKUNA. */
  readonly personasTodas = signal<PersonaCI[]>([]);
  readonly loading = signal(true);
  readonly tiposPersona = signal<PersonaTipoCatalogo[]>([]);

  // Señales (no propiedades planas): `personas`/`total` las leen dentro de
  // un `computed()`, que solo se reinvalida cuando cambia una señal.
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  readonly searchControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly tipoControl = new FormControl<number | null>(null);
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null

  readonly opcionesOrden: OpcionOrden[] = [
    // { value: 'id', label: 'ID' }, // se sigue ordenando por id por defecto (ver orderByControl), pero no se ofrece como filtro manual porque el id real ya no se muestra en la tabla (ver columna "N°")
    { value: 'nombres', label: 'Nombres' },
    { value: 'numeroDocumento', label: 'N° de documento' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  readonly total = computed(() => this.personasTodas().length);

  readonly personas = computed(() => {
    const inicio = this.pageIndex() * this.pageSize();
    return this.personasTodas().slice(inicio, inicio + this.pageSize());
  });

  ngOnInit(): void {
    this.personaService.getAllPersonaTipo().subscribe({
      next: (tipos) => this.tiposPersona.set(tipos),
      error: () => this.tiposPersona.set([]),
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.documentoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.tipoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderByControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.cargarPersonas();
  }

  private reiniciarYcargar(): void {
    this.pageIndex.set(0);
    this.cargarPersonas();
  }

  cargarPersonas(): void {
    this.loading.set(true);
    const estado = this.estadoControl.value;

    // El back no filtra personas por actor, así que se trae todo lo que
    // matchea el resto de filtros (volumen chico, igual que en
    // PersonasDeActorDialogComponent / PersonalInternoComponent) y se
    // excluye acá al personal de TINKURIKUNA; la paginación también queda
    // del lado del cliente para que el total mostrado sea el correcto.
    this.personaService
      .listarPersonas({
        page: 1,
        limit: 1000,
        busqueda: this.searchControl.value || undefined,
        numeroDocumento: this.documentoControl.value || undefined,
        idTipoPersona: this.tipoControl.value ?? undefined,
        activo: estado === null ? undefined : estado === 'true',
        orderBy: (this.orderByControl.value as FiltrosPersona['orderBy']) ?? undefined,
        orderDirection: this.orderDirectionControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.personasTodas.set(
            (res.data ?? []).filter(
              (p) =>
                String(
                  p.actorProductivoMinero?.id ?? p.idActorProductivoMinero ?? '',
                ) !== ID_ACTOR_EMPRESA,
            ),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de personas',
            'Cerrar',
            {
              duration: 4000,
            },
          );
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.tipoControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('id', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  /** Numeración correlativa (no el id real, que queda con huecos por bajas):
   *  el más antiguo es 1 y el más nuevo es `total()`, sin importar en qué
   *  posición de la página caiga. Se invierte según el sentido del orden
   *  actual para que ese número no cambie con la fila, sino que se mantenga
   *  ligado al mismo registro al togglear ascendente/descendente. */
  numeroFila(i: number): number {
    const offset = this.pageIndex() * this.pageSize() + i;
    return this.orderDirectionControl.value === 'ASC'
      ? offset + 1
      : this.total() - offset;
  }

  nombreCompleto(persona: PersonaCI): string {
    return `${persona.nombres} ${persona.apellidoPaterno} ${persona.apellidoMaterno}`.trim();
  }

  abrirDialogo(persona: PersonaCI | null): void {
    const data: PersonaFormDialogData = { persona };
    const esAlta = !persona;

    this.dialog
      .open(PersonaFormDialogComponent, {
        data,
        width: '820px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (!resultado) return;
        // En alta, volvemos a la primera página (orden por defecto DESC: la
        // recién creada queda arriba); en edición mantenemos la página actual.
        if (esAlta) this.pageIndex.set(0);
        this.cargarPersonas();
      });
  }

  abrirKardex(persona: PersonaCI): void {
    // Esta bandeja ("Compras (Internos)") excluye al personal de TINKURIKUNA
    // (ver GestionClientesComponent.cargarPersonas): todo lo que se lista
    // acá es, por definición, tipo ASOCIADO en el kardex.
    const data: KardexGestionData = {
      tipo: 'ASOCIADO',
      idPersona: persona.id,
      nombreDestinatario: this.nombreCompleto(persona),
    };
    irAGestionKardex(this.router, data);
  }

  confirmarCambioEstado(persona: PersonaCI): void {
    const activar = !persona.activo;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activar ? 'Activar persona' : 'Desactivar persona',
          message: activar
            ? `¿Deseas activar a ${this.nombreCompleto(persona)}?`
            : `¿Deseas desactivar a ${this.nombreCompleto(persona)}? No aparecerá disponible para nuevas operaciones.`,
          confirmLabel: activar ? 'Sí, activar' : 'Sí, desactivar',
          tone: activar ? 'default' : 'danger',
          icon: activar ? 'check_circle_outline' : 'block',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;

        this.personaService.cambiarEstado(persona.id, activar).subscribe({
          next: (actualizada) => {
            this.personasTodas.update((lista) =>
              lista.map((p) => (p.id === persona.id ? actualizada : p)),
            );
            this.snackBar.open(
              activar
                ? 'Persona activada correctamente'
                : 'Persona desactivada correctamente',
              'Cerrar',
              { duration: 3000 },
            );
          },
          error: () => {
            this.snackBar.open('No se pudo cambiar el estado', 'Cerrar', {
              duration: 4000,
            });
          },
        });
      });
  }
}
