// src/app/pages/contabilidad/boletas-pago/boleta-list.component.ts
// Bandeja de boletas de pago del personal interno (/contabilidad/boletas-pago).
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { PersonaCI } from '../../configurations/models/persona.models';
import { PersonaService } from '../../configurations/services/persona.service';
import { RangoFechasComponent } from '../../../shared/components/rango-fechas/rango-fechas.component';
import { mensajeErrorBlob } from '../../../shared/utils/descarga-archivo.util';
import { BoletaPago, ResumenBoletasMes } from '../models/boleta-pago.models';
import { BoletaPagoService } from '../services/boleta-pago.service';
import { ReciboService } from '../services/recibo.service';
import {
  cargarPersonalInterno,
  fechaFmt,
  formatFechaIso,
  nombrePersona,
  num,
} from '../components/personal-interno.util';
import {
  BoletaFormDialogComponent,
  BoletaFormDialogData,
} from './boleta-form-dialog/boleta-form-dialog.component';
import {
  BoletaDetalleDialogComponent,
  BoletaDetalleDialogData,
} from './boleta-detalle-dialog/boleta-detalle-dialog.component';
import { abrirPdfBoleta } from './boleta-pdf.util';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-boleta-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RangoFechasComponent,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './boleta-list.component.html',
  styleUrl: './boleta-list.component.scss',
})
export class BoletaListComponent implements OnInit {
  private readonly boletaService = inject(BoletaPagoService);
  private readonly reciboService = inject(ReciboService);
  private readonly personaService = inject(PersonaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = ['fechaPago', 'numero', 'persona', 'periodo', 'totalGanado', 'descPrestamos', 'montoPagado', 'estado', 'acciones'];

  readonly cargando = signal(true);
  readonly registros = signal<BoletaPago[]>([]);
  readonly total = signal(0);
  readonly personal = signal<PersonaCI[]>([]);
  readonly personaFiltro = signal<string | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);
  readonly descargandoPdf = signal<string | null>(null);
  readonly resumen = signal<ResumenBoletasMes | null>(null);
  pageIndex = 0;
  pageSize = 10;

  nombre = nombrePersona;
  fechaFmt = fechaFmt;
  num = num;

  ngOnInit(): void {
    this.fechaDesdeControl.valueChanges.subscribe(() => this.reiniciar());
    this.fechaHastaControl.valueChanges.subscribe(() => this.reiniciar());
    cargarPersonalInterno(this.personaService).subscribe({
      next: (lista) => this.personal.set(lista),
      error: () => this.personal.set([]),
    });
    this.cargar();
    this.cargarResumen();
  }

  cargar(): void {
    this.cargando.set(true);
    const desde = this.fechaDesdeControl.value;
    const hasta = this.fechaHastaControl.value;
    this.boletaService
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        idPersona: this.personaFiltro() ?? undefined,
        fechaDesde: desde ? formatFechaIso(desde) : undefined,
        fechaHasta: hasta ? formatFechaIso(hasta) : undefined,
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
          this.snackBar.open(err?.error?.message ?? 'No se pudo cargar las boletas', 'Cerrar', {
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

  limpiar(): void {
    this.personaFiltro.set(null);
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.reiniciar();
  }

  onPage(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargar();
  }

  /** `idPersona`: desde el resumen, abre la boleta de ese pendiente. */
  nueva(idPersona?: string): void {
    const data: BoletaFormDialogData = { idPersona: idPersona ?? this.personaFiltro() };
    this.dialog
      .open(BoletaFormDialogComponent, { data, width: '900px', maxWidth: '95vw', autoFocus: false })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        this.reiniciar();
        this.cargarResumen();
      });
  }

  // ---------- Resumen del mes ----------

  /** Cuántos del personal ya cobraron el mes actual y quiénes faltan. Si
   *  falla, simplemente no se muestra el aviso. */
  private cargarResumen(): void {
    this.boletaService.resumen().subscribe({
      next: (r) => this.resumen.set(r),
      error: () => this.resumen.set(null),
    });
  }

  nombreMes(mes: number): string {
    return [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ][mes - 1] ?? '';
  }

  verDetalle(b: BoletaPago): void {
    const data: BoletaDetalleDialogData = { id: b.id };
    this.dialog.open(BoletaDetalleDialogComponent, {
      data,
      width: '820px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  /** interno = true: con préstamos, neto y saldos; false: solo la parte de ley. */
  verPdfBoleta(b: BoletaPago, interno: boolean): void {
    if (this.descargandoPdf()) return;
    this.descargandoPdf.set(b.id);
    abrirPdfBoleta(this.boletaService, this.snackBar, b.id, interno, () =>
      this.descargandoPdf.set(null),
    );
  }

  verPdfRecibo(b: BoletaPago): void {
    if (!b.idRecibo || this.descargandoPdf()) return;
    this.descargandoPdf.set(b.id);
    const obs: Observable<Blob> = this.reciboService.obtenerPdf(b.idRecibo);
    obs.subscribe({
      next: (blob) => {
        this.descargandoPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      },
      error: async (err) => {
        this.descargandoPdf.set(null);
        this.snackBar.open(
          (await mensajeErrorBlob(err)) ?? 'No se pudo generar el PDF del recibo',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }
}
