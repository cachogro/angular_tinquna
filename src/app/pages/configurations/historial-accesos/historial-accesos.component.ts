import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import { BitacoraAccesoService } from '../services/bitacora-acceso.service';
import {
  FiltrosBitacoraAcceso,
  OPCIONES_TIPO_EVENTO,
  RegistroBitacoraAcceso,
  TIPO_EVENTO_MAP,
  TipoEventoBitacora,
} from './models/bitacora-acceso.models';

interface OpcionOrden {
  value: string;
  label: string;
}

@Component({
  selector: 'app-historial-accesos',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './historial-accesos.component.html',
  styleUrl: './historial-accesos.component.scss',
})
export class HistorialAccesosComponent implements OnInit {
  private readonly bitacoraService = inject(BitacoraAccesoService);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'fecha',
    'usuario',
    'tipoEvento',
    'exitoso',
    'ip',
    'userAgent',
  ];

  readonly opcionesTipoEvento = OPCIONES_TIPO_EVENTO;
  readonly opcionesOrden: OpcionOrden[] = [
    { value: 'fechaRegistro', label: 'Fecha' },
    { value: 'tipoEvento', label: 'Tipo de evento' },
    { value: 'usuarioIngresado', label: 'Usuario' },
  ];

  readonly registros = signal<RegistroBitacoraAcceso[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);

  pageIndex = 0;
  pageSize = 20;

  /** No se permiten fechas futuras en los filtros. */
  readonly hoy = new Date();

  readonly searchControl = new FormControl('');
  readonly tipoEventoControl = new FormControl<TipoEventoBitacora | null>(null);
  readonly exitosoControl = new FormControl<string | null>(null); // 'true' | 'false' | null
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);
  readonly orderByControl = new FormControl<string>('fechaRegistro');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.tipoEventoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.exitosoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaDesdeControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaHastaControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderByControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

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

    const exitoso = this.exitosoControl.value;

    const filtros: FiltrosBitacoraAcceso = {
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value || undefined,
      tipoEvento: this.tipoEventoControl.value ?? undefined,
      exitoso: exitoso === null ? undefined : exitoso === 'true',
      fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
      fechaHasta: this.formatFecha(this.fechaHastaControl.value),
      orderBy:
        (this.orderByControl.value as FiltrosBitacoraAcceso['orderBy']) ??
        undefined,
      orderDirection: this.orderDirectionControl.value ?? undefined,
    };

    this.bitacoraService.listar(filtros).subscribe({
      next: (res) => {
        this.registros.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('No se pudo cargar el historial de accesos', 'Cerrar', {
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

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.tipoEventoControl.setValue(null, { emitEvent: false });
    this.exitosoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('fechaRegistro', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  opcionTipoEvento(tipoEvento: TipoEventoBitacora) {
    return TIPO_EVENTO_MAP[tipoEvento];
  }

  /** 'HH:mm - dd-MM-yyyy', tomando los componentes directo del ISO string. */
  formatFechaTabla(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia, hora, minuto] = match;
    return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
  }
}
