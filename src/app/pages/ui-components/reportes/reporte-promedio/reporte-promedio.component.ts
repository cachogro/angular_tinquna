// src/app/pages/ui-components/reportes/reporte-promedio/reporte-promedio.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { FechaInputDirective } from 'src/app/shared/directives/fecha-input.directive';
import { formatFechaIso } from 'src/app/pages/contabilidad/components/personal-interno.util';
import {
  descargarBlob,
  mensajeErrorBlob,
} from 'src/app/shared/utils/descarga-archivo.util';
import {
  CodificacionLote,
  ESTADOS_REPORTE_PROMEDIO,
  EstadoVentaReportePromedio,
  FiltroReportePromedio,
  PeriodoReportePromedio,
} from '../../models/promedio-mineral.models';
import { CodificacionCatalogo } from '../../models/registro-mineral.models';
import { PromedioMineralService } from '../../services/promedio-mineral.service';
import { RegistroMineralService } from '../../services/registro-mineral.service';

/**
 * Pantalla "Reportes › Promedios": solo filtros. Al pulsar "Generar Excel"
 * descarga el archivo que arma el backend (lotes del período, con su estado
 * de venta, codificación de lote y de valorización).
 */
@Component({
  selector: 'app-reporte-promedio',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FechaInputDirective,
  ],
  templateUrl: './reporte-promedio.component.html',
  styleUrl: './reporte-promedio.component.scss',
})
export class ReportePromedioComponent implements OnInit {
  private readonly promedioService = inject(PromedioMineralService);
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly snackBar = inject(MatSnackBar);

  readonly estados = ESTADOS_REPORTE_PROMEDIO;
  readonly codificacionesLote = signal<CodificacionLote[]>([]);
  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  readonly generando = signal(false);
  readonly hoy = new Date();

  readonly periodoControl = new FormControl<PeriodoReportePromedio>('diario', {
    nonNullable: true,
  });
  readonly fechaControl = new FormControl<Date | null>(new Date());
  readonly estadoControl = new FormControl<EstadoVentaReportePromedio>('todos', {
    nonNullable: true,
  });
  readonly codificacionLoteControl = new FormControl<string | null>(null);
  readonly codificacionControl = new FormControl<string | null>(null);

  private readonly periodo = toSignal(this.periodoControl.valueChanges, {
    initialValue: this.periodoControl.value,
  });
  private readonly fecha = toSignal(this.fechaControl.valueChanges, {
    initialValue: this.fechaControl.value,
  });

  /** Rango que va a cubrir el reporte, para que el usuario lo vea antes de generar. */
  readonly rangoTexto = computed(() => {
    const ref = this.fecha() ?? new Date();
    switch (this.periodo()) {
      case 'semanal': {
        // Semana de lunes a domingo que contiene la fecha.
        const lunes = new Date(ref);
        lunes.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        return `Del ${this.fmt(lunes)} al ${this.fmt(domingo)}`;
      }
      case 'mensual': {
        const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
        const fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        return `Del ${this.fmt(inicio)} al ${this.fmt(fin)}`;
      }
      default:
        return `Solo el ${this.fmt(ref)}`;
    }
  });

  ngOnInit(): void {
    this.promedioService
      .codificacionesLote()
      .subscribe((data) => this.codificacionesLote.set(data));
    this.registroMineralService
      .getAllCodificaciones()
      .subscribe((data) => this.codificaciones.set(data));
  }

  limpiarFiltros(): void {
    this.periodoControl.setValue('diario');
    this.fechaControl.setValue(new Date());
    this.estadoControl.setValue('todos');
    this.codificacionLoteControl.setValue(null);
    this.codificacionControl.setValue(null);
  }

  generarExcel(): void {
    if (!this.fechaControl.value || this.fechaControl.invalid) {
      this.avisar('Indica una fecha válida (dd/mm/aaaa)');
      return;
    }
    this.generando.set(true);
    this.promedioService.descargarReporteExcel(this.construirFiltros()).subscribe({
      next: (res) => {
        this.generando.set(false);
        if (!res.body) {
          this.avisar('El servidor no devolvió el archivo');
          return;
        }
        descargarBlob(res.body, this.nombreArchivo(res.headers.get('content-disposition')));
        this.snackBar.open('Reporte generado', 'Cerrar', { duration: 2500 });
      },
      error: async (err) => {
        this.generando.set(false);
        this.avisar(
          (await mensajeErrorBlob(err)) ??
            'No se pudo generar el reporte. Revisa los filtros.',
        );
      },
    });
  }

  private construirFiltros(): FiltroReportePromedio {
    const filtros: FiltroReportePromedio = {
      periodo: this.periodoControl.value,
      fecha: formatFechaIso(this.fechaControl.value!),
      estado: this.estadoControl.value,
    };
    if (this.codificacionLoteControl.value) {
      filtros.idCodificacionLote = this.codificacionLoteControl.value;
    }
    if (this.codificacionControl.value) {
      filtros.idCodificacion = Number(this.codificacionControl.value);
    }
    return filtros;
  }

  /** Nombre que manda el back en Content-Disposition; si no llega (p. ej. el
   *  header no está expuesto por CORS), uno armado con los filtros. */
  private nombreArchivo(disposition: string | null): string {
    const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
    const fecha = formatFechaIso(this.fechaControl.value ?? new Date());
    return `reporte-promedios-${this.periodoControl.value}-${this.estadoControl.value}-${fecha}.xlsx`;
  }

  private fmt(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${fecha.getFullYear()}`;
  }

  private avisar(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
  }
}
