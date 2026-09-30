import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import {
  KardexGestionData,
  irAGestionKardex,
} from '../../contabilidad/kardex/kardex-gestion/kardex-gestion.component';
import { Cliente } from '../parametricas/models/parametricas.models';
import { ParametricasService } from '../services/parametricas.service';
import {
  ClienteFormDialogComponent,
  ClienteFormDialogData,
} from './cliente-form-dialog/cliente-form-dialog.component';

/**
 * Bandeja de clientes (compradores del mineral): mismo formato que la de
 * Actores productivos (toolbar de filtros + tabla + paginador). El alta/
 * edición abre `ClienteFormDialogComponent` (solo formulario); el kardex
 * se abre con tipo 'CLIENTE'.
 */
@Component({
  selector: 'app-clientes-compradores',
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
  templateUrl: './clientes-compradores.component.html',
  styleUrl: './clientes-compradores.component.scss',
})
export class ClientesCompradoresComponent implements OnInit {
  private readonly parametricasService = inject(ParametricasService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'id',
    'cliente',
    'direccion',
    'nit',
    'estado',
    'acciones',
  ];

  readonly clientes = signal<Cliente[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

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
    this.loading.set(true);
    const estado = this.estadoControl.value;

    this.parametricasService
      .listarClientes({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value?.trim() || undefined,
        activo: estado === null ? undefined : estado === 'true',
        orderBy: 'id',
        orderDirection: this.orderDirectionControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.clientes.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('No se pudo cargar el listado de clientes', 'Cerrar', {
            duration: 4000,
          });
        },
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
    this.estadoControl.setValue(null, { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  /** Numeración correlativa (no el id real, que queda con huecos por bajas):
   *  el más antiguo es 1 y el más nuevo es `total()`. Se invierte según el
   *  sentido del orden para que el número quede ligado al registro. */
  numeroFila(i: number): number {
    const offset = this.pageIndex * this.pageSize + i;
    return this.orderDirectionControl.value === 'ASC'
      ? offset + 1
      : this.total() - offset;
  }

  abrirKardex(cliente: Cliente): void {
    const data: KardexGestionData = {
      tipo: 'CLIENTE',
      idCliente: cliente.id,
      nombreDestinatario: cliente.nombre,
    };
    irAGestionKardex(this.router, data);
  }

  abrirDialogo(cliente: Cliente | null): void {
    const data: ClienteFormDialogData = { cliente: cliente ?? undefined };
    const esAlta = !cliente;

    this.dialog
      .open(ClienteFormDialogComponent, {
        data,
        width: '820px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (!resultado) return;
        if (esAlta) this.pageIndex = 0;
        this.cargar();
      });
  }

  confirmarCambioEstado(cliente: Cliente): void {
    const activar = !cliente.activo;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activar ? 'Activar cliente' : 'Desactivar cliente',
          message: activar
            ? `¿Deseas activar a "${cliente.nombre}"?`
            : `¿Deseas desactivar a "${cliente.nombre}"? No aparecerá disponible para nuevas operaciones.`,
          confirmLabel: activar ? 'Sí, activar' : 'Sí, desactivar',
          tone: activar ? 'default' : 'danger',
          icon: activar ? 'check_circle_outline' : 'block',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;

        this.parametricasService
          .cambiarEstadoCliente(cliente.id, activar)
          .subscribe({
            next: (actualizado) => {
              this.clientes.update((lista) =>
                lista.map((c) => (c.id === cliente.id ? actualizado : c)),
              );
              this.snackBar.open(
                activar
                  ? 'Cliente activado correctamente'
                  : 'Cliente desactivado correctamente',
                'Cerrar',
                { duration: 3000 },
              );
            },
            error: (err) => {
              this.snackBar.open(
                err?.error?.message ?? 'No se pudo cambiar el estado',
                'Cerrar',
                { duration: 4000 },
              );
            },
          });
      });
  }
}
