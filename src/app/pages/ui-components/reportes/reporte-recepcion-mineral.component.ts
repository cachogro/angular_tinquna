import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CodificacionCatalogo,
  ESTADOS_OPERACION,
  FiltrosRegistroMineral,
  OrdenDireccion,
  RegistroMineral,
} from '../models/registro-mineral.models';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { RegistroMineralService } from '../services/registro-mineral.service';
import { formatNumeroSinCeros } from 'src/app/shared/utils/numero.util';

interface OpcionOrden {
  value: string;
  label: string;
}

type ModoPeriodo = 'fechas' | 'mes' | 'semana';

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

@Component({
  selector: 'app-reporte-recepcion-mineral',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './reporte-recepcion-mineral.component.html',
  styleUrl: './reporte-recepcion-mineral.component.scss',
})
export class ReporteRecepcionMineralComponent implements OnInit {
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'id',
    'fecha',
    'operacion',
    'proveedor',
    'estado',
    'sacos',
    'balanzaL',
    'balanzaT',
    'anticipo',
    'humedad',
  ];

  readonly estados = ESTADOS_OPERACION;
  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  readonly meses = MESES;
  readonly opcionesOrden: OpcionOrden[] = [
    { value: 'id', label: 'ID' },
    { value: 'codigoOperacion', label: 'Código de operación' },
    { value: 'fechaRecepcion', label: 'Fecha de recepción' },
    { value: 'numeroDocumento', label: 'N° de documento' },
    { value: 'estado', label: 'Estado' },
  ];

  readonly registros = signal<RegistroMineral[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly exportando = signal(false);
  readonly exportandoPdf = signal(false);

  pageIndex = 0;
  pageSize = 10;

  /** No se permiten fechas futuras en los filtros. */
  readonly hoy = new Date();

  readonly searchControl = new FormControl('');
  readonly codigoControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly estadoControl = new FormControl<number | null>(null);
  readonly codificacionControl = new FormControl<string | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);

  /** Alternativa a fechaDesde/fechaHasta: fraccionar por mes o semana ISO
   *  (útil para exportar Excel de rangos grandes sin acotar por fecha exacta). */
  readonly periodoModoControl = new FormControl<ModoPeriodo>('fechas', {
    nonNullable: true,
  });
  readonly anioControl = new FormControl<number | null>(null);
  readonly mesControl = new FormControl<number | null>(null);
  readonly semanaControl = new FormControl<number | null>(null);

  readonly orderByControl = new FormControl<string>('fechaRecepcion');
  readonly orderDirectionControl = new FormControl<OrdenDireccion>('DESC');

  /** Totales de la página actual (el backend no devuelve agregados globales todavía). */
  readonly totalSacos = signal(0);
  readonly totalBalanzaL = signal(0);
  readonly totalBalanzaT = signal(0);
  readonly totalAnticipo = signal(0);

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
    this.codificacionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );
    this.fechaDesdeControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );
    this.fechaHastaControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.periodoModoControl.valueChanges.subscribe(() => {
      // Los tres modos son mutuamente excluyentes para el backend: al
      // cambiar de modo se limpian los campos de los otros dos.
      this.fechaDesdeControl.setValue(null, { emitEvent: false });
      this.fechaHastaControl.setValue(null, { emitEvent: false });
      this.anioControl.setValue(null, { emitEvent: false });
      this.mesControl.setValue(null, { emitEvent: false });
      this.semanaControl.setValue(null, { emitEvent: false });
      this.reiniciarYcargar();
    });
    this.anioControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.mesControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.semanaControl.valueChanges.subscribe(() => this.reiniciarYcargar());

    this.orderByControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.registroMineralService
      .getAllCodificaciones()
      .subscribe((data) => this.codificaciones.set(data));

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

  /** 'HH:mm - dd-MM-yyyy', tomando los componentes directo del ISO string. */
  formatFechaTabla(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fecha);
    if (!match) return fecha;
    const [, anio, mes, dia, hora, minuto] = match;
    return `${hora}:${minuto} - ${dia}-${mes}-${anio}`;
  }

  nombreProveedor(registro: RegistroMineral): string {
    const p = registro.persona;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  formatNumero(valor: number | string | null | undefined): string {
    return formatNumeroSinCeros(valor);
  }

  private filtrosActuales(): FiltrosRegistroMineral {
    const filtros: FiltrosRegistroMineral = {
      page: this.pageIndex + 1,
      limit: this.pageSize,
      busqueda: this.searchControl.value || undefined,
      codigoOperacion: this.codigoControl.value || undefined,
      numeroDocumento: this.documentoControl.value || undefined,
      idCodificacion: this.codificacionControl.value ?? undefined,
      idEstado: this.estadoControl.value ?? undefined,
      orderBy:
        (this.orderByControl.value as FiltrosRegistroMineral['orderBy']) ??
        undefined,
      orderDirection: this.orderDirectionControl.value ?? undefined,
    };

    switch (this.periodoModoControl.value) {
      case 'mes':
        filtros.anio = this.anioControl.value ?? undefined;
        filtros.mes = this.mesControl.value ?? undefined;
        break;
      case 'semana':
        filtros.anio = this.anioControl.value ?? undefined;
        filtros.semana = this.semanaControl.value ?? undefined;
        break;
      default:
        filtros.fechaDesde = this.formatFecha(this.fechaDesdeControl.value);
        filtros.fechaHasta = this.formatFecha(this.fechaHastaControl.value);
    }

    return filtros;
  }

  cargarRegistros(): void {
    this.loading.set(true);

    this.registroMineralService
      .listarRegistros(this.filtrosActuales())
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.total);
          this.calcularTotalesPagina(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('No se pudo cargar el reporte', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  private calcularTotalesPagina(registros: RegistroMineral[]): void {
    this.totalSacos.set(
      registros.reduce((acc, r) => acc + (r.numeroSacos ?? 0), 0),
    );
    this.totalBalanzaL.set(
      registros.reduce((acc, r) => acc + Number(r.balanzaL ?? 0), 0),
    );
    this.totalBalanzaT.set(
      registros.reduce((acc, r) => acc + Number(r.balanzaT ?? 0), 0),
    );
    this.totalAnticipo.set(
      registros.reduce((acc, r) => acc + Number(r.anticipo ?? 0), 0),
    );
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
    this.codificacionControl.setValue(null, { emitEvent: false });
    this.periodoModoControl.setValue('fechas', { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.anioControl.setValue(null, { emitEvent: false });
    this.mesControl.setValue(null, { emitEvent: false });
    this.semanaControl.setValue(null, { emitEvent: false });
    this.orderByControl.setValue('fechaRecepcion', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  exportarExcel(): void {
    this.exportando.set(true);
    this.registroMineralService
      .exportarExcel(this.filtrosActuales())
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recepcion-mineral-${this.formatFecha(new Date()) ?? 'reporte'}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.exportando.set(false);
          console.error(error);
          this.snackBar.open('No se pudo generar el Excel', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  exportarPdf(): void {
    this.exportandoPdf.set(true);
    this.registroMineralService
      .exportarReportePdf(this.filtrosActuales())
      .subscribe({
        next: (blob) => {
          this.exportandoPdf.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recepcion-mineral-${this.formatFecha(new Date()) ?? 'reporte'}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.exportandoPdf.set(false);
          console.error(error);
          this.snackBar.open('No se pudo generar el PDF', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }
}
