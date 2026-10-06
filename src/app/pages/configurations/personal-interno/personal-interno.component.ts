// src/app/pages/configurations/personal-interno/personal-interno.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  ActorProductivoMinero,
  PersonaCI,
  PersonaTipoCatalogo,
} from '../models/persona.models';
import { PersonaService } from '../services/persona.service';
import {
  PersonaFormDialogComponent,
  PersonaFormDialogData,
} from '../gestion-clientes/persona-form-dialog/persona-form-dialog.component';
import {
  KardexGestionData,
  irAGestionKardex,
} from '../../contabilidad/kardex/kardex-gestion/kardex-gestion.component';

/** Id del actor productivo minero que representa a la propia empresa
 *  (TINKURIKUNA). Mismo criterio que `persona-form-dialog.component.ts`. */
const ID_ACTOR_EMPRESA = '1';

/**
 * Bandeja de personal INTERNO: solo personas vinculadas al actor productivo
 * minero propio (TINKURIKUNA, id 1), a diferencia de "Internos (Personal)"
 * que mezcla personal propio con contactos de otros actores (proveedores,
 * choferes, etc.). El back no filtra personas por actor, así que se trae
 * todo (volumen chico) y se filtra en el cliente — mismo criterio que
 * `PersonasDeActorDialogComponent`. Búsqueda/filtros/paginación son locales.
 */
@Component({
  selector: 'app-personal-interno',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
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
  templateUrl: './personal-interno.component.html',
  styleUrl: './personal-interno.component.scss',
})
export class PersonalInternoComponent implements OnInit {
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

  readonly loading = signal(true);
  readonly tiposPersona = signal<PersonaTipoCatalogo[]>([]);
  /** Todo el personal de TINKURIKUNA, sin filtrar (ya recortado del total). */
  readonly personasEmpresa = signal<PersonaCI[]>([]);
  /** Actor TINKURIKUNA, para preseleccionarlo al dar de alta desde acá. */
  actorEmpresa: ActorProductivoMinero | null = null;

  // Señales (no propiedades planas): `personasPagina` las lee adentro de un
  // `computed()`, que solo se reinvalida cuando cambia una señal.
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  readonly searchControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly tipoControl = new FormControl<number | null>(null);
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null

  /** Filtro aplicado en el cliente (búsqueda, documento, tipo, estado). */
  readonly personasFiltradas = computed(() => {
    const busqueda = (this.searchTexto() ?? '').trim().toLowerCase();
    const documento = (this.documentoTexto() ?? '').trim().toLowerCase();
    const idTipo = this.tipoTexto();
    const estado = this.estadoTexto();

    return this.personasEmpresa().filter((p) => {
      if (busqueda && !this.nombreCompleto(p).toLowerCase().includes(busqueda)) {
        return false;
      }
      if (
        documento &&
        !p.numeroDocumento.toLowerCase().includes(documento)
      ) {
        return false;
      }
      if (
        idTipo != null &&
        !p.personaTipos.some((pt) => pt.idPersonaTipo === idTipo)
      ) {
        return false;
      }
      if (estado === 'true' && !p.activo) return false;
      if (estado === 'false' && p.activo) return false;
      return true;
    });
  });

  readonly total = computed(() => this.personasFiltradas().length);

  readonly personasPagina = computed(() => {
    const pageIndex = this.pageIndex();
    const pageSize = this.pageSize();
    const inicio = pageIndex * pageSize;
    return this.personasFiltradas().slice(inicio, inicio + pageSize);
  });

  // Señales espejo de los FormControl (para poder leerlas dentro de `computed`).
  private readonly searchTexto = signal('');
  private readonly documentoTexto = signal('');
  private readonly tipoTexto = signal<number | null>(null);
  private readonly estadoTexto = signal<string | null>(null);

  ngOnInit(): void {
    this.personaService.getAllPersonaTipo().subscribe({
      next: (tipos) => this.tiposPersona.set(tipos),
      error: () => this.tiposPersona.set([]),
    });

    this.personaService.getAllActoresMineros().subscribe({
      next: (actores) =>
        (this.actorEmpresa =
          actores.find((a) => String(a.id) === ID_ACTOR_EMPRESA) ?? null),
      error: () => (this.actorEmpresa = null),
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((v) => {
        this.searchTexto.set(v ?? '');
        this.pageIndex.set(0);
      });
    this.documentoControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((v) => {
        this.documentoTexto.set(v ?? '');
        this.pageIndex.set(0);
      });
    this.tipoControl.valueChanges.subscribe((v) => {
      this.tipoTexto.set(v);
      this.pageIndex.set(0);
    });
    this.estadoControl.valueChanges.subscribe((v) => {
      this.estadoTexto.set(v);
      this.pageIndex.set(0);
    });

    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    // El back no filtra personas por actor: se trae todo y se filtra acá
    // (mismo criterio que PersonasDeActorDialogComponent). orderBy 'id' DESC:
    // el último registrado aparece primero (el filtro de actor preserva ese
    // orden porque Array.filter no reordena).
    this.personaService
      .listarPersonas({
        page: 1,
        limit: 1000,
        orderBy: 'id',
        orderDirection: 'DESC',
      })
      .subscribe({
        next: (res) => {
          this.personasEmpresa.set(
            (res.data ?? []).filter(
              (p) =>
                String(
                  p.actorProductivoMinero?.id ?? p.idActorProductivoMinero ?? '',
                ) === ID_ACTOR_EMPRESA,
            ),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de personal interno',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.tipoControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.searchTexto.set('');
    this.documentoTexto.set('');
    this.tipoTexto.set(null);
    this.estadoTexto.set(null);
    this.pageIndex.set(0);
  }

  /** Numeración correlativa por antigüedad (no el id real): el primer
   *  registrado es el 1 y el último alta lleva el número más alto, aunque la
   *  lista se muestre del más nuevo al más antiguo. Se calcula sobre todo el
   *  personal (no sobre lo filtrado) para que cada persona conserve su número
   *  al buscar o filtrar. */
  readonly numeroPorId = computed(() => {
    const personas = this.personasEmpresa(); // viene id DESC
    return new Map(personas.map((p, i) => [p.id, personas.length - i]));
  });

  nombreCompleto(persona: PersonaCI): string {
    // El apellido materno es opcional: sin él no debe aparecer "null".
    return [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ');
  }

  abrirDialogo(persona: PersonaCI | null): void {
    const data: PersonaFormDialogData = {
      persona,
      actorPreseleccionado: persona ? undefined : (this.actorEmpresa ?? undefined),
    };

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
        this.cargar();
      });
  }

  abrirKardex(persona: PersonaCI): void {
    const data: KardexGestionData = {
      tipo: 'PERSONAL',
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
            this.personasEmpresa.update((lista) =>
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
