import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
import { PersonasDeActorDialogComponent } from './personas-de-actor-dialog.component';
import {
  KardexDialogComponent,
  KardexDialogData,
} from '../../contabilidad/kardex/kardex-dialog.component';
import {
  ActorProductivoMinero,
  TipoActorProductivoMinero,
} from '../parametricas/models/parametricas.models';
import { ParametricasService } from '../services/parametricas.service';

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

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly tipoControl = new FormControl<number | string | null>(null);
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null
  // ASC por defecto: TINKURIKUNA (id 1) es el actor más antiguo, así que
  // debe aparecer primero, con N° 1, en vez de quedar enterrado en la
  // última página bajo el orden "más nuevos primero".
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('ASC');

  get actores(): ActorProductivoMinero[] {
    return this.parametricasService.actoresProductivosMineros();
  }
  get total(): number {
    return this.parametricasService.totalActoresProductivosMineros();
  }
  get loading(): boolean {
    return this.parametricasService.cargandoActoresProductivosMineros();
  }

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
    this.pageIndex = 0;
    this.cargar();
  }

  cargar(): void {
    const estado = this.estadoControl.value;
    this.parametricasService.cargarActoresProductivosMineros({
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value?.trim() || undefined,
      idTipoActorProductivoMinero: this.tipoControl.value ?? undefined,
      activo: estado === null ? undefined : estado === 'true',
      // El back, sin `orderBy`, ordena alfabéticamente por nombre — hay que
      // pedir 'id' explícito para que numeroFila() (que asume "más antiguo
      // = id más chico = N° 1") funcione, y así TINKURIKUNA (id 1) quede
      // primero en vez de enterrado según el alfabeto.
      orderBy: 'id',
      orderDirection: this.orderDirectionControl.value ?? undefined,
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargar();
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
    this.orderDirectionControl.setValue('ASC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  /** Numeración correlativa (no el id real, que queda con huecos por bajas):
   *  el más antiguo es 1 y el más nuevo es `total()`. Se invierte según el
   *  sentido del orden para que el número quede ligado al registro. */
  numeroFila(i: number): number {
    const offset = this.pageIndex * this.pageSize + i;
    return this.orderDirectionControl.value === 'ASC'
      ? offset + 1
      : this.total - offset;
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

  /** true si el actor es la propia empresa (id 1, "TINKURIKUNA"): no tiene
   *  kardex propio — sus personas relacionadas sí lo tienen. */
  esEmpresa(actor: ActorProductivoMinero): boolean {
    return (
      String(actor.id) === '1' &&
      (actor.nombre ?? '').trim().toUpperCase() === 'TINKURIKUNA'
    );
  }

  abrirKardex(actor: ActorProductivoMinero): void {
    const data: KardexDialogData = {
      tipo: 'ACTOR',
      idActorProductivoMinero: actor.id,
      nombreDestinatario: actor.nombre,
    };
    this.dialog.open(KardexDialogComponent, {
      data,
      width: '1000px',
      maxWidth: '95vw',
      autoFocus: false,
    });
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
            next: () =>
              this.snackBar.open(
                activar
                  ? 'Actor productivo activado correctamente'
                  : 'Actor productivo desactivado correctamente',
                'Cerrar',
                { duration: 3000 },
              ),
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
