import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
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
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import {
  ESTADOS_VALORIZACION,
  ESTADO_VALORIZACION_BORRADOR_ID,
  FiltrosValorizacionMineral,
  OrdenDireccionValorizacion,
  ValorizacionMineral,
} from '../models/valorizacion-mineral.models';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';

interface OpcionOrden {
  value: string;
  label: string;
}

@Component({
  selector: 'app-valorizacion',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './valorizacion.component.html',
  styleUrl: './valorizacion.component.scss',
})
export class ValorizacionComponent implements OnInit {
  private readonly valorizacionMineralService = inject(
    ValorizacionMineralService,
  );
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  /** Fecha máxima seleccionable en los filtros "Desde"/"Hasta": no se permiten fechas futuras. */
  readonly hoy = new Date();

  readonly displayedColumns = [
    'id',
    'operacion',
    'proveedor',
    'detalle',
    'estado',
    'acciones',
  ];
  readonly estados = ESTADOS_VALORIZACION;
  readonly ESTADO_VALORIZACION_BORRADOR_ID = ESTADO_VALORIZACION_BORRADOR_ID;

  readonly registros = signal<ValorizacionMineral[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly codigoControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly estadoControl = new FormControl<number | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);

  readonly opcionesOrden: OpcionOrden[] = [
    { value: 'id', label: 'ID' },
    { value: 'codigoOperacion', label: 'Código de operación' },
    { value: 'fechaValorizacion', label: 'Fecha de valorización' },
    { value: 'numeroDocumento', label: 'N° de documento' },
    { value: 'estado', label: 'Estado' },
  ];
  readonly orderByControl = new FormControl<string>('id');
  readonly orderDirectionControl =
    new FormControl<OrdenDireccionValorizacion>('DESC');

  /** Solo ADMINISTRADOR y OPERADOR tienen acceso al módulo de valorización. */
  get puedeGestionar(): boolean {
    return this.authService.hasRole(
      RolCodigo.ADMINISTRADOR,
      RolCodigo.OPERADOR,
    );
  }

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.codigoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.documentoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaDesdeControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );
    this.fechaHastaControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );
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

  /** Igual que en recepción: extrae hora/fecha directo del ISO string para no
   *  depender del huso horario del navegador. */
  formatFechaTabla(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia, hora, minuto] = match;
    return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
  }

  cargarRegistros(): void {
    this.loading.set(true);

    this.valorizacionMineralService
      .listarValorizaciones({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value || undefined,
        codigoOperacion: this.codigoControl.value || undefined,
        numeroDocumento: this.documentoControl.value || undefined,
        idEstadoValorizacion: this.estadoControl.value ?? undefined,
        fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
        fechaHasta: this.formatFecha(this.fechaHastaControl.value),
        orderBy: (this.orderByControl.value as FiltrosValorizacionMineral['orderBy']) ?? undefined,
        orderDirection: this.orderDirectionControl.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de valorizaciones',
            'Cerrar',
            { duration: 4000 },
          );
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
    this.codigoControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('id', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  nombreProveedor(v: ValorizacionMineral): string {
    const p = v.recepcionMineral?.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  detalleTexto(v: ValorizacionMineral): string {
    const r = v.recepcionMineral;
    if (!r) return '—';
    return `${r.codificacion?.codigo ?? '—'} · ${r.numeroSacos ?? 0} sacos · ${r.balanzaL} kg`;
  }

  /** Mientras esté en BORRADOR se puede entrar a editar; en el resto de estados, no. */
  puedeEditar(v: ValorizacionMineral): boolean {
    return v.idEstadoValorizacion === ESTADO_VALORIZACION_BORRADOR_ID;
  }

  claseEstado(idEstadoValorizacion: number): string {
    switch (idEstadoValorizacion) {
      case ESTADO_VALORIZACION_BORRADOR_ID:
        return 'estado-chip--pendiente'; // BORRADOR
      case 2:
        return 'estado-chip--proceso'; // PRE-VALORIZADO
      case 3:
        return 'estado-chip--aprobado'; // VALORIZADO
      default:
        return '';
    }
  }
}
