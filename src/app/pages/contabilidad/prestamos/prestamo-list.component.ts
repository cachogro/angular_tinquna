// src/app/pages/contabilidad/prestamos/prestamo-list.component.ts
// Bandeja de préstamos al personal interno (/contabilidad/prestamos).
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PersonaCI } from '../../configurations/models/persona.models';
import { PersonaService } from '../../configurations/services/persona.service';
import { EstadoPrestamo, PrestamoPersonal } from '../models/prestamo-personal.models';
import { PrestamoPersonalService } from '../services/prestamo-personal.service';
import {
  cargarPersonalInterno,
  fechaFmt,
  nombrePersona,
  num,
} from '../components/personal-interno.util';
import {
  PrestamoFormDialogComponent,
  PrestamoFormDialogData,
} from './prestamo-form-dialog/prestamo-form-dialog.component';
import {
  PrestamoDetalleDialogComponent,
  PrestamoDetalleDialogData,
} from './prestamo-detalle-dialog/prestamo-detalle-dialog.component';
import {
  PrestamoOperacionDialogComponent,
  PrestamoOperacionDialogData,
} from './prestamo-operacion-dialog/prestamo-operacion-dialog.component';

@Component({
  selector: 'app-prestamo-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './prestamo-list.component.html',
  styleUrl: './prestamo-list.component.scss',
})
export class PrestamoListComponent implements OnInit {
  private readonly prestamoService = inject(PrestamoPersonalService);
  private readonly personaService = inject(PersonaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = ['fecha', 'numero', 'persona', 'descripcion', 'monto', 'cuota', 'saldo', 'estado', 'usuarioRegistro', 'acciones'];

  readonly cargando = signal(true);
  readonly registros = signal<PrestamoPersonal[]>([]);
  readonly total = signal(0);
  readonly personal = signal<PersonaCI[]>([]);
  readonly personaFiltro = signal<string | null>(null);
  readonly estadoFiltro = signal<EstadoPrestamo | null>('VIGENTE');
  pageIndex = 0;
  pageSize = 10;

  nombre = nombrePersona;
  fechaFmt = fechaFmt;
  num = num;

  ngOnInit(): void {
    cargarPersonalInterno(this.personaService).subscribe({
      next: (lista) => this.personal.set(lista),
      error: () => this.personal.set([]),
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.prestamoService
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        idPersona: this.personaFiltro() ?? undefined,
        estado: this.estadoFiltro() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.registros.set([]);
          this.total.set(0);
          this.snackBar.open(err?.error?.message ?? 'No se pudo cargar los préstamos', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  private reiniciar(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  onPersona(id: string | null): void {
    this.personaFiltro.set(id);
    this.reiniciar();
  }

  onEstado(estado: EstadoPrestamo | null): void {
    this.estadoFiltro.set(estado);
    this.reiniciar();
  }

  limpiar(): void {
    this.personaFiltro.set(null);
    this.estadoFiltro.set(null);
    this.reiniciar();
  }

  onPage(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargar();
  }

  otorgar(): void {
    const data: PrestamoFormDialogData = { idPersona: this.personaFiltro() };
    this.dialog
      .open(PrestamoFormDialogComponent, { data, width: '720px', maxWidth: '95vw', autoFocus: false })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.reiniciar();
      });
  }

  verDetalle(p: PrestamoPersonal): void {
    const data: PrestamoDetalleDialogData = { id: p.id };
    this.dialog
      .open(PrestamoDetalleDialogComponent, { data, width: '900px', maxWidth: '95vw', autoFocus: false })
      .afterClosed()
      // Recarga siempre: si se cerró con clic afuera tras un abono, el
      // diálogo no alcanza a avisar que hubo cambios.
      .subscribe(() => this.cargar());
  }

  operar(p: PrestamoPersonal, modo: 'ABONO' | 'CUOTA'): void {
    const data: PrestamoOperacionDialogData = { modo, prestamo: p };
    this.dialog
      .open(PrestamoOperacionDialogComponent, {
        data,
        width: modo === 'ABONO' ? '680px' : '560px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.cargar();
      });
  }
}
