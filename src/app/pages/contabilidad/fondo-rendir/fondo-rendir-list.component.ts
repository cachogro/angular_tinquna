// src/app/pages/contabilidad/fondo-rendir/fondo-rendir-list.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
import {
  EstadoFondoRendir,
  FondoRendirCuentas,
} from '../models/fondo-rendir.models';
import { FondoRendirService } from '../services/fondo-rendir.service';
import { ReciboService } from '../services/recibo.service';
import { mensajeErrorBlob } from '../../../shared/utils/descarga-archivo.util';
import { Observable } from 'rxjs';
import { MatMenuModule } from '@angular/material/menu';
import type { FondoRendirDetalleDialogData } from './fondo-rendir-detalle-dialog/fondo-rendir-detalle-dialog.component';
import type { FondoRendirExcelDialogData } from './fondo-rendir-excel-dialog/fondo-rendir-excel-dialog.component';
import { RangoFechasComponent } from '../../../shared/components/rango-fechas/rango-fechas.component';

@Component({
  selector: 'app-fondo-rendir-list',
  standalone: true,
  imports: [
    RangoFechasComponent,
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatDatepickerModule,
  ],
  templateUrl: './fondo-rendir-list.component.html',
  styleUrl: './fondo-rendir-list.component.scss',
})
export class FondoRendirListComponent implements OnInit {
  private readonly fondoRendirService = inject(FondoRendirService);
  private readonly reciboService = inject(ReciboService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'fecha',
    'destinatario',
    'concepto',
    'entregado',
    'justificado',
    'pendiente',
    'estado',
    'usuarioRegistro',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly registros = signal<FondoRendirCuentas[]>([]);
  readonly total = signal(0);

  pageIndex = 0;
  pageSize = 10;

  readonly estadoControl = new FormControl<EstadoFondoRendir | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);

  ngOnInit(): void {
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaDesdeControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaHastaControl.valueChanges.subscribe(() => this.reiniciarYcargar());

    this.cargar();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fondoRendirService
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        estado: this.estadoControl.value ?? undefined,
        fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
        fechaHasta: this.formatFecha(this.fechaHastaControl.value),
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
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar el listado de fondos',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.estadoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.reiniciarYcargar();
  }

  // ---------- Acciones ----------

  async entregarFondo(): Promise<void> {
    const { FondoRendirFormDialogComponent } = await import(
      './fondo-rendir-form-dialog/fondo-rendir-form-dialog.component'
    );
    this.dialog
      .open(FondoRendirFormDialogComponent, {
        width: '680px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.reiniciarYcargar();
      });
  }

  /** Sin fondo abre el reporte vacío; con fondo lo precarga con su
   *  destinatario y el mes de entrega. */
  async exportarExcel(f?: FondoRendirCuentas): Promise<void> {
    const { FondoRendirExcelDialogComponent } = await import(
      './fondo-rendir-excel-dialog/fondo-rendir-excel-dialog.component'
    );
    const data: FondoRendirExcelDialogData = {};
    if (f) {
      data.idPersona = f.idPersona ?? f.persona?.id ?? null;
      data.idActorProductivoMinero =
        f.idActorProductivoMinero ?? f.actorProductivoMinero?.id ?? null;
      const [anio, mes] = (f.fecha ?? '').slice(0, 10).split('-').map(Number);
      if (anio) data.gestion = anio;
      if (mes) data.mes = mes;
    }
    this.dialog.open(FondoRendirExcelDialogComponent, {
      data,
      width: '520px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  async verDetalle(f: FondoRendirCuentas): Promise<void> {
    const { FondoRendirDetalleDialogComponent } = await import(
      './fondo-rendir-detalle-dialog/fondo-rendir-detalle-dialog.component'
    );
    const data: FondoRendirDetalleDialogData = { id: f.id };
    this.dialog
      .open(FondoRendirDetalleDialogComponent, {
        data,
        width: '820px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((huboCambios: boolean) => {
        if (huboCambios) this.cargar();
      });
  }

  // ---------- PDF del recibo de entrega ----------

  /** Id del fondo cuyo PDF se está generando (deshabilita su botón). */
  readonly descargandoPdf = signal<string | null>(null);

  /** PDF del recibo generado al entregar el fondo. */
  verPdfRecibo(f: FondoRendirCuentas): void {
    if (!f.idRecibo) return;
    this.abrirPdf(f, this.reciboService.obtenerPdf(f.idRecibo));
  }

  /** PDF del recibo procesado, con el detalle del reparto. */
  verPdfReciboDetallado(f: FondoRendirCuentas): void {
    if (!f.idRecibo) return;
    this.abrirPdf(f, this.reciboService.obtenerPdfDetallado(f.idRecibo));
  }

  /** PDF del recibo de egreso con que se repuso el excedente del fondo. */
  verPdfReciboReposicion(f: FondoRendirCuentas): void {
    if (!f.idReciboReposicion) return;
    this.abrirPdf(f, this.reciboService.obtenerPdf(f.idReciboReposicion));
  }

  private abrirPdf(f: FondoRendirCuentas, obs: Observable<Blob>): void {
    if (this.descargandoPdf()) return;
    this.descargandoPdf.set(f.id);
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

  /** "C-0003" — código del recibo de entrega. */
  codigoRecibo(f: FondoRendirCuentas): string {
    const r = f.recibo;
    return r ? `${r.serie}-${String(r.numero).padStart(4, '0')}` : '';
  }

  // ---------- Presentación ----------

  nombreDestinatario(f: FondoRendirCuentas): string {
    if (f.persona) {
      return `${f.persona.nombres} ${f.persona.apellidoPaterno} ${f.persona.apellidoMaterno ?? ''}`
        .trim()
        .replace(/\s+/g, ' ');
    }
    if (f.actorProductivoMinero) return f.actorProductivoMinero.nombre;
    return '—';
  }

  estadoLabel(estado: EstadoFondoRendir): string {
    return {
      PENDIENTE: 'Pendiente',
      RENDIDO_PARCIAL: 'Rendido parcial',
      RENDIDO_TOTAL: 'Rendido total',
      RENDIDO_EN_EXCESO: 'Rendido en exceso',
      CERRADO_CON_DEUDA: 'Cerrado con deuda',
    }[estado];
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  num(v: number | string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private formatFecha(fecha: Date | null): string | undefined {
    if (!fecha) return undefined;
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
