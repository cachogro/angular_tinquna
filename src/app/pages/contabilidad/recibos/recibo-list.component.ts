// src/app/pages/contabilidad/recibos/recibo-list.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  EstadoRecibo,
  OrdenRecibo,
  Recibo,
  TipoRecibo,
} from '../models/recibo.models';
import { ReciboService } from '../services/recibo.service';
import {
  ReciboDetalleDialogComponent,
  ReciboDetalleDialogData,
} from './recibo-detalle-dialog.component';
import {
  ReciboFormDialogComponent,
  ReciboFormDialogData,
  ReciboFormModo,
} from './recibo-form-dialog.component';

@Component({
  selector: 'app-recibo-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatDatepickerModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-BO' },
  ],
  templateUrl: './recibo-list.component.html',
  styleUrl: './recibo-list.component.scss',
})
export class ReciboListComponent implements OnInit {
  private readonly reciboService = inject(ReciboService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'numero',
    'tipo',
    'estado',
    'fecha',
    'persona',
    'concepto',
    'formaPago',
    'monto',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly registros = signal<Recibo[]>([]);
  readonly total = signal(0);

  pageIndex = 0;
  pageSize = 10;

  readonly tipoControl = new FormControl<TipoRecibo | null>(null);
  readonly estadoControl = new FormControl<EstadoRecibo | null>(null);
  readonly fechaDesdeControl = new FormControl<Date | null>(null);
  readonly fechaHastaControl = new FormControl<Date | null>(null);
  readonly searchControl = new FormControl('');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');
  readonly orderBy: OrdenRecibo = 'fecha';

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.tipoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaDesdeControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.fechaHastaControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.orderDirectionControl.valueChanges.subscribe(() =>
      this.reiniciarYcargar(),
    );

    this.cargar();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.reciboService
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        tipo: this.tipoControl.value ?? undefined,
        estado: this.estadoControl.value ?? undefined,
        fechaDesde: this.formatFecha(this.fechaDesdeControl.value),
        fechaHasta: this.formatFecha(this.fechaHastaControl.value),
        busqueda: this.searchControl.value?.trim() || undefined,
        orderBy: this.orderBy,
        orderDirection: this.orderDirectionControl.value ?? undefined,
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
            err?.error?.message ?? 'No se pudo cargar el listado de recibos',
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

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  limpiarFiltros(): void {
    this.tipoControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.fechaDesdeControl.setValue(null, { emitEvent: false });
    this.fechaHastaControl.setValue(null, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  // ---------- Acciones ----------

  /** Botón "Generar recibo": alta rápida en BORRADOR (solo cabecera). */
  generarRecibo(tipo: TipoRecibo): void {
    this.abrirFormulario(tipo, 'GENERAR');
  }

  /** Botón "Procesar recibo": alta directa procesada (one-shot). */
  procesarDirecto(tipo: TipoRecibo): void {
    this.abrirFormulario(tipo, 'PROCESAR');
  }

  /** Acción de fila: procesar un BORRADOR existente. */
  procesarBorrador(r: Recibo): void {
    this.abrirFormulario(r.tipo, 'PROCESAR', r);
  }

  private abrirFormulario(
    tipo: TipoRecibo,
    modo: ReciboFormModo,
    recibo?: Recibo,
  ): void {
    const data: ReciboFormDialogData = { tipo, modo, recibo };
    this.dialog
      .open(ReciboFormDialogComponent, {
        data,
        width: modo === 'GENERAR' ? '720px' : '860px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) this.reiniciarYcargar();
      });
  }

  anular(r: Recibo): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Anular recibo ${this.codigoRecibo(r)}`,
          message:
            'El recibo pasará a ANULADO. Solo se puede anular mientras está en borrador (no toca kardex ni caja).',
          confirmLabel: 'Anular',
          tone: 'danger',
          icon: 'block',
        },
        width: '400px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.reciboService.anular(r.id).subscribe({
          next: () => {
            this.snackBar.open('Recibo anulado', 'Cerrar', { duration: 3000 });
            this.cargar();
          },
          error: (err) => {
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo anular el recibo',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  verDetalle(r: Recibo): void {
    const data: ReciboDetalleDialogData = { id: r.id };
    this.dialog.open(ReciboDetalleDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  readonly descargandoPdf = signal<string | null>(null);

  /** Abre el PDF del recibo en una pestaña nueva (sirve en cualquier estado). */
  verPdf(r: Recibo): void {
    if (this.descargandoPdf()) return;
    this.descargandoPdf.set(r.id);
    this.reciboService.obtenerPdf(r.id).subscribe({
      next: (blob) => {
        this.descargandoPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      },
      error: (err) => {
        this.descargandoPdf.set(null);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo generar el PDF del recibo',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  // ---------- Presentación ----------

  /** Código legible: "R-0020" / "C-0003" (serie + numero con 4 dígitos). */
  codigoRecibo(r: Recibo): string {
    return `${r.serie}-${String(r.numero).padStart(4, '0')}`;
  }

  estadoLabel(estado: EstadoRecibo): string {
    return { BORRADOR: 'Borrador', PROCESADO: 'Procesado', ANULADO: 'Anulado' }[
      estado
    ];
  }

  nombrePersona(r: Recibo): string {
    if (r.persona) {
      return `${r.persona.nombres} ${r.persona.apellidoPaterno} ${
        r.persona.apellidoMaterno ?? ''
      }`
        .trim()
        .replace(/\s+/g, ' ');
    }
    if (r.actorProductivoMinero) return r.actorProductivoMinero.nombre;
    return r.nombresApellidos || '—';
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  num(v: string | null | undefined): number {
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
