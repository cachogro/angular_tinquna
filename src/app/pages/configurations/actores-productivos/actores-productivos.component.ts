import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { ActorProductivoMineroFormDialogComponent } from '../parametricas/actor-productivo-minero/actor-productivo-minero-form-dialog.component';
import { PersonasDeActorDialogComponent } from './personas-de-actor-dialog/personas-de-actor-dialog.component';
import {
  KardexGestionData,
  irAGestionKardex,
} from '../../contabilidad/kardex/kardex-gestion/kardex-gestion.component';
import {
  ActorProductivoMinero,
  TipoActorProductivoMinero,
} from '../parametricas/models/parametricas.models';
import { ParametricasService } from '../services/parametricas.service';

/** Id del actor productivo minero que representa a la propia empresa
 *  (TINKURIKUNA): esta bandeja es "Compras (Actores productivos)" — la
 *  empresa no se compra mineral a sí misma, así que no se lista acá. Su
 *  personal vive en la pestaña dedicada "Personal interno". */
const ID_ACTOR_EMPRESA = '1';

/**
 * Bandeja de actores productivos mineros: mismo formato que la de
 * Personas/Clientes (toolbar de filtros + tabla + paginador). El alta/edición
 * abre `ActorProductivoMineroFormDialogComponent` (solo formulario).
 */
@Component({
  selector: 'app-actores-productivos',
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
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './actores-productivos.component.html',
  styleUrl: './actores-productivos.component.scss',
})
export class ActoresProductivosComponent implements OnInit {
  private readonly parametricasService = inject(ParametricasService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'id',
    'actor',
    'tipo',
    'direccion',
    'estado',
    'acciones',
  ];

  tipos: TipoActorProductivoMinero[] = [];

  /** Todos los actores que matchean los filtros de backend, ya excluida
   *  TINKURIKUNA (id 1). */
  readonly actoresTodos = signal<ActorProductivoMinero[]>([]);
  readonly loading = signal(false);

  // Señales (no propiedades planas): `actores`/`total` las leen dentro de
  // un `computed()`, que solo se reinvalida cuando cambia una señal.
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  readonly searchControl = new FormControl('');
  readonly tipoControl = new FormControl<number | string | null>(null);
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null
  // DESC por defecto: el último actor registrado aparece primero.
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  readonly total = computed(() => this.actoresTodos().length);

  readonly actores = computed(() => {
    const inicio = this.pageIndex() * this.pageSize();
    return this.actoresTodos().slice(inicio, inicio + this.pageSize());
  });

  ngOnInit(): void {
    this.parametricasService.obtenerTiposActorProductivoMinero().subscribe({
      next: (tipos) => (this.tipos = tipos),
      error: () => (this.tipos = []),
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.tipoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.cargar();
  }

  private reiniciarYcargar(): void {
    this.pageIndex.set(0);
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    const estado = this.estadoControl.value;

    // El back no filtra actores excluyendo un id puntual, así que se trae
    // todo lo que matchea el resto de filtros (volumen chico, mismo criterio
    // que en GestionClientesComponent/PersonalInternoComponent) y se excluye
    // acá a TINKURIKUNA; la paginación también queda del lado del cliente
    // para que el total mostrado sea el correcto.
    this.parametricasService
      .listarActoresProductivosMineros({
        page: 1,
        limit: 1000,
        busqueda: this.searchControl.value?.trim() || undefined,
        idTipoActorProductivoMinero: this.tipoControl.value ?? undefined,
        activo: estado === null ? undefined : estado === 'true',
        orderBy: 'id',
        orderDirection: this.orderDirectionControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.actoresTodos.set(
            (res.data ?? []).filter(
              (a) => String(a.id) !== ID_ACTOR_EMPRESA,
            ),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de actores productivos',
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

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.tipoControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  /** Numeración correlativa (no el id real, que queda con huecos por bajas):
   *  el más antiguo es 1 y el más nuevo es `total()`. Se invierte según el
   *  sentido del orden para que el número quede ligado al registro. */
  numeroFila(i: number): number {
    const offset = this.pageIndex() * this.pageSize() + i;
    return this.orderDirectionControl.value === 'ASC'
      ? offset + 1
      : this.total() - offset;
  }

  /** Descripción del tipo, usando el catálogo cacheado si el back no lo
   *  devuelve anidado en cada fila. */
  descripcionTipo(row: ActorProductivoMinero): string {
    if (row.tipoActorProductivoMinero?.descripcion) {
      return row.tipoActorProductivoMinero.descripcion;
    }
    const tipo = this.tipos.find(
      (t) => String(t.id) === String(row.idTipoActorProductivoMinero),
    );
    return tipo?.descripcion ?? '—';
  }

  abrirKardex(actor: ActorProductivoMinero): void {
    const data: KardexGestionData = {
      tipo: 'ACTOR',
      idActorProductivoMinero: actor.id,
      nombreDestinatario: actor.nombre,
    };
    irAGestionKardex(this.router, data);
  }

  verPersonas(actor: ActorProductivoMinero): void {
    this.dialog.open(PersonasDeActorDialogComponent, {
      data: { actor },
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  abrirDialogo(actor: ActorProductivoMinero | null): void {
    this.dialog
      .open(ActorProductivoMineroFormDialogComponent, {
        data: { actorProductivoMinero: actor ?? undefined },
        width: '1100px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) this.cargar();
      });
  }

  confirmarCambioEstado(actor: ActorProductivoMinero): void {
    const activar = !actor.activo;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activar
            ? 'Activar actor productivo'
            : 'Desactivar actor productivo',
          message: activar
            ? `¿Deseas activar a "${actor.nombre}"?`
            : `¿Deseas desactivar a "${actor.nombre}"? No aparecerá disponible para nuevas operaciones.`,
          confirmLabel: activar ? 'Sí, activar' : 'Sí, desactivar',
          tone: activar ? 'default' : 'danger',
          icon: activar ? 'check_circle_outline' : 'block',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;

        this.parametricasService
          .cambiarEstadoActorProductivoMinero(actor.id, activar)
          .subscribe({
            next: () => {
              this.snackBar.open(
                activar
                  ? 'Actor productivo activado correctamente'
                  : 'Actor productivo desactivado correctamente',
                'Cerrar',
                { duration: 3000 },
              );
              this.cargar();
            },
            error: (err) =>
              this.snackBar.open(
                err?.error?.message ?? 'No se pudo cambiar el estado',
                'Cerrar',
                { duration: 4000 },
              ),
          });
      });
  }
}
