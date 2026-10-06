// Lista todas las cotizaciones registradas de un mineral para elegir con cuál
// valorizar. Por defecto la valorización usa la cotización vigente hoy; esto
// permite usar una anterior (ej. la que regía cuando se recepcionó el
// mineral, si recién se valoriza semanas después).
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Cotizacion } from 'src/app/pages/configurations/parametricas/models/parametricas.models';
import { ParametricasService } from 'src/app/pages/configurations/services/parametricas.service';
import {
  estaVigente,
  formatearFechaBolivia,
} from 'src/app/shared/utils/fecha-bolivia.util';

export interface ElegirCotizacionDialogData {
  idMineral: number;
  /** "Plata (Ag)" — para el título. */
  mineral: string;
  /** Cotización que la valorización está usando ahora, si tiene. */
  idCotizacionEnUso: number | null;
  /** Fecha de recepción del mineral: se marca la cotización que regía ese día. */
  fechaRecepcion?: string | null;
}

/** Cuántas cotizaciones se traen como máximo (de la más nueva a la más vieja). */
const LIMITE = 200;

@Component({
  selector: 'app-elegir-cotizacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './elegir-cotizacion-dialog.component.html',
  styleUrl: './elegir-cotizacion-dialog.component.scss',
})
export class ElegirCotizacionDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<ElegirCotizacionDialogComponent, Cotizacion>,
  );
  readonly data = inject<ElegirCotizacionDialogData>(MAT_DIALOG_DATA);
  private readonly parametricasService = inject(ParametricasService);

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly cotizaciones = signal<Cotizacion[]>([]);
  /** true si el mineral tiene más cotizaciones que las que se muestran. */
  readonly hayMas = signal(false);

  ngOnInit(): void {
    this.parametricasService
      .listarCotizaciones({
        page: 1,
        limit: LIMITE,
        idMineral: this.data.idMineral,
        orderBy: 'fechaVigenciaInicial',
        orderDirection: 'DESC',
      })
      .subscribe({
        next: (res) => {
          this.cotizaciones.set(res.data ?? []);
          this.hayMas.set((res.total ?? 0) > (res.data?.length ?? 0));
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(true);
          this.cargando.set(false);
        },
      });
  }

  esVigente(c: Cotizacion): boolean {
    return estaVigente(c);
  }

  /** Dada de baja: se muestra pero no se puede usar. */
  esInactiva(c: Cotizacion): boolean {
    return c.activo === false;
  }

  enUso(c: Cotizacion): boolean {
    return Number(c.id) === Number(this.data.idCotizacionEnUso);
  }

  /** La cotización que regía el día en que se recepcionó el mineral. */
  regiaAlRecepcionar(c: Cotizacion): boolean {
    if (!this.data.fechaRecepcion || this.esInactiva(c)) return false;
    const recepcion = new Date(this.data.fechaRecepcion);
    if (isNaN(recepcion.getTime())) return false;
    return estaVigente(c, recepcion);
  }

  estado(c: Cotizacion): string {
    if (this.esInactiva(c)) return 'Dada de baja';
    return this.esVigente(c) ? 'Vigente' : 'Vencida';
  }

  fecha(valor: string | null | undefined): string {
    return formatearFechaBolivia(valor);
  }

  elegir(c: Cotizacion): void {
    if (this.esInactiva(c)) return;
    this.dialogRef.close(c);
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
