import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  ESTADOS_OPERACION,
  ESTADO_LIQUIDADO_ID,
  RegistroMineral,
} from '../models/registro-mineral.models';
import { RegistroMineralService } from '../services/registro-mineral.service';
import {
  RegistroFormDialogComponent,
  RegistroFormDialogData,
} from './registro-form-dialog/registro-form-dialog.component';

@Component({
  selector: 'app-recepcion-mineral',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatCheckboxModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './recepcion-mineral.component.html',
  styleUrl: './recepcion-mineral.component.scss',
})
export class RecepcionMineralComponent implements OnInit {
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['operacion', 'proveedor', 'detalle', 'estado', 'acciones'];
  readonly estados = ESTADOS_OPERACION;
  readonly ESTADO_LIQUIDADO_ID = ESTADO_LIQUIDADO_ID;

  readonly registros = signal<RegistroMineral[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly estadoControl = new FormControl<number | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.documentoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaDesdeControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaHastaControl.valueChanges.subscribe(() => this.reiniciarYcargar());

    this.cargarRegistros();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargarRegistros();
  }

  private formatFecha(fecha: Date | null): string | undefined {
    if (!fecha) return undefined;
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  cargarRegistros(): void {
    this.loading.set(true);

    this.registroMineralService
      .listarRegistros({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value || undefined,
        numeroDocumento: this.documentoControl.value || undefined,
        idEstado: this.estadoControl.value ?? undefined,
        fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
        fechaHasta: this.formatFecha(this.fechaHastaControl.value),
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('No se pudo cargar el listado de recepciones', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarRegistros();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.reiniciarYcargar();
  }

  nombreProveedor(registro: RegistroMineral): string {
    const p = registro.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  estaLiquidado(registro: RegistroMineral): boolean {
    return registro.idEstado === ESTADO_LIQUIDADO_ID;
  }

  claseEstado(idEstado: number): string {
    switch (idEstado) {
      case 1: // PENDIENTE
        return 'estado-chip--pendiente';
      case 2: // EN RECEPCIÓN
      case 3: // EN REVISIÓN
        return 'estado-chip--proceso';
      case 4: // APROBADO
        return 'estado-chip--aprobado';
      case 7: // LIQUIDADO
        return 'estado-chip--liquidado';
      case 5: // RECHAZADO A TOL
      case 6: // CANCELADO
        return 'estado-chip--rechazado';
      default:
        return '';
    }
  }

  abrirDialogo(registro: RegistroMineral | null): void {
    if (registro && this.estaLiquidado(registro)) return; // defensa extra, el botón ya está deshabilitado

    const data: RegistroFormDialogData = { registro };

    this.dialog
      .open(RegistroFormDialogComponent, { data, width: '680px' })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) {
          this.cargarRegistros();
        }
      });
  }

  cambiarEstado(registro: RegistroMineral, nuevoEstadoId: number): void {
    if (this.estaLiquidado(registro)) return;

    this.registroMineralService.cambiarEstado(registro.id, nuevoEstadoId).subscribe({
      next: (actualizado) => {
        this.registros.update((lista) =>
          lista.map((r) => (r.id === registro.id ? actualizado : r))
        );
        this.snackBar.open('Estado actualizado correctamente', 'Cerrar', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('No se pudo cambiar el estado', 'Cerrar', { duration: 4000 });
      },
    });
  }
}
