import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CodificacionCatalogo } from '../models/registro-mineral.models';
import {
  EntregadoReporteValorizacion,
  EstadoReporteValorizacion,
  FiltroReporteValorizacion,
} from '../models/valorizacion-mineral.models';
import { RegistroMineralService } from '../services/registro-mineral.service';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';

/** Formas de acotar por fecha; el backend las trata como excluyentes. */
type ModoPeriodo = 'todos' | 'fechas' | 'mes' | 'semana';

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

/**
 * Pantalla "Reportes Valorización": solo filtros. No lista resultados en la
 * app — al pulsar "Generar Excel" descarga directamente el archivo que arma
 * el backend con los filtros elegidos.
 */
@Component({
  selector: 'app-reporte-valorizacion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reporte-valorizacion.component.html',
  styleUrl: './reporte-valorizacion.component.scss',
})
export class ReporteValorizacionComponent implements OnInit {
  private readonly valorizacionService = inject(ValorizacionMineralService);
  private readonly registroMineralService = inject(RegistroMineralService);
  private readonly snackBar = inject(MatSnackBar);

  readonly meses = MESES;
  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  readonly generando = signal(false);

  /** No se permiten fechas futuras en los filtros. */
  readonly hoy = new Date();

  readonly estadoControl = new FormControl<EstadoReporteValorizacion>('ambas', {
    nonNullable: true,
  });
  readonly entregadoControl = new FormControl<EntregadoReporteValorizacion>(
    'ambos',
    { nonNullable: true },
  );
  readonly codificacionControl = new FormControl<string | null>(null);

  readonly periodoModoControl = new FormControl<ModoPeriodo>('todos', {
    nonNullable: true,
  });
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);
  readonly anioControl = new FormControl<number | null>(
    this.hoy.getFullYear(),
  );
  readonly mesControl = new FormControl<number | null>(this.hoy.getMonth() + 1);
  readonly semanaControl = new FormControl<number | null>(null);

  ngOnInit(): void {
    this.registroMineralService
      .getAllCodificaciones()
      .subscribe((data) => this.codificaciones.set(data));

    // Los modos de fecha son mutuamente excluyentes para el backend: al
    // cambiar de modo se limpian los campos de los otros.
    this.periodoModoControl.valueChanges.subscribe((modo) => {
      this.fechaDesdeControl.setValue(null, { emitEvent: false });
      this.fechaHastaControl.setValue(null, { emitEvent: false });
      this.semanaControl.setValue(null, { emitEvent: false });
      if (modo === 'mes' || modo === 'semana') {
        if (!this.anioControl.value)
          this.anioControl.setValue(this.hoy.getFullYear(), {
            emitEvent: false,
          });
        if (modo === 'mes' && !this.mesControl.value)
          this.mesControl.setValue(this.hoy.getMonth() + 1, {
            emitEvent: false,
          });
      }
    });
  }

  limpiarFiltros(): void {
    this.estadoControl.setValue('ambas', { emitEvent: false });
    this.entregadoControl.setValue('ambos', { emitEvent: false });
    this.codificacionControl.setValue(null, { emitEvent: false });
    this.periodoModoControl.setValue('todos', { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.anioControl.setValue(this.hoy.getFullYear(), { emitEvent: false });
    this.mesControl.setValue(this.hoy.getMonth() + 1, { emitEvent: false });
    this.semanaControl.setValue(null, { emitEvent: false });
  }

  generarExcel(): void {
    const modo = this.periodoModoControl.value;

    if ((modo === 'mes' || modo === 'semana') && !this.anioControl.value) {
      this.avisar('Indica el año para filtrar por mes o semana');
      return;
    }
    if (modo === 'mes' && !this.mesControl.value) {
      this.avisar('Elige el mes');
      return;
    }
    if (modo === 'semana' && !this.semanaControl.value) {
      this.avisar('Indica el número de semana (1-53)');
      return;
    }
    if (
      modo === 'fechas' &&
      !this.fechaDesdeControl.value &&
      !this.fechaHastaControl.value
    ) {
      this.avisar('Indica al menos una fecha del rango');
      return;
    }

    this.generando.set(true);
    this.valorizacionService
      .descargarReporteExcel(this.construirFiltros())
      .subscribe({
        next: (blob) => {
          this.generando.set(false);
          this.descargar(
            blob,
            `reporte-valorizaciones-${this.formatFecha(new Date()) ?? 'reporte'}.xlsx`,
          );
          this.snackBar.open('Reporte generado', 'Cerrar', { duration: 2500 });
        },
        error: () => {
          this.generando.set(false);
          this.avisar('No se pudo generar el reporte. Revisa los filtros.');
        },
      });
  }

  private construirFiltros(): FiltroReporteValorizacion {
    const filtros: FiltroReporteValorizacion = {
      estado: this.estadoControl.value,
      entregado: this.entregadoControl.value,
      idCodificacion: this.codificacionControl.value
        ? Number(this.codificacionControl.value)
        : undefined,
    };

    switch (this.periodoModoControl.value) {
      case 'fechas':
        filtros.fechaDesde = this.formatFecha(this.fechaDesdeControl.value);
        filtros.fechaHasta = this.formatFecha(this.fechaHastaControl.value);
        break;
      case 'mes':
        filtros.anio = this.anioControl.value ?? undefined;
        filtros.mes = this.mesControl.value ?? undefined;
        break;
      case 'semana':
        filtros.anio = this.anioControl.value ?? undefined;
        filtros.semana = this.semanaControl.value ?? undefined;
        break;
      // 'todos' → sin parámetros de fecha → todo el histórico.
    }

    return filtros;
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private formatFecha(fecha: Date | null): string | undefined {
    if (!fecha) return undefined;
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private avisar(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 3500 });
  }
}
