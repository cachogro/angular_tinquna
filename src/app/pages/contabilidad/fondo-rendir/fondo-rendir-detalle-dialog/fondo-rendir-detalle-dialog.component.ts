// src/app/pages/contabilidad/fondo-rendir/fondo-rendir-detalle-dialog/fondo-rendir-detalle-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  DetalleFondoRendir,
  EstadoFondoRendir,
  FondoRendirCuentas,
} from '../../models/fondo-rendir.models';
import { FondoRendirService } from '../../services/fondo-rendir.service';
import {
  FondoRendirDetalleFormDialogComponent,
  FondoRendirDetalleFormDialogData,
} from '../fondo-rendir-detalle-form/fondo-rendir-detalle-form-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  FondoRendirExcelDialogComponent,
  FondoRendirExcelDialogData,
} from '../fondo-rendir-excel-dialog/fondo-rendir-excel-dialog.component';

export interface FondoRendirDetalleDialogData {
  id: string | number;
}

@Component({
  selector: 'app-fondo-rendir-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './fondo-rendir-detalle-dialog.component.html',
  styleUrl: './fondo-rendir-detalle-dialog.component.scss',
})
export class FondoRendirDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<FondoRendirDetalleDialogComponent>,
  );
  readonly data = inject<FondoRendirDetalleDialogData>(MAT_DIALOG_DATA);
  private readonly fondoRendirService = inject(FondoRendirService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'fecha',
    'concepto',
    'nroComprobante',
    'destinoGasto',
    'monto',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly fondo = signal<FondoRendirCuentas | null>(null);
  /** Se marca en true en cuanto se hace algún cambio, para avisarle a la
   *  lista que debe recargar al cerrar este diálogo. */
  private huboCambios = false;

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.fondoRendirService.obtener(this.data.id).subscribe({
      next: (fondo) => {
        this.fondo.set(fondo);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar el fondo',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }

  // ---------- Comprobantes ----------

  readonly detalles = () =>
    [...(this.fondo()?.detalles ?? [])].sort(
      (a, b) => Number(b.id) - Number(a.id),
    );

  agregarComprobante(): void {
    const fondo = this.fondo();
    if (!fondo) return;
    const data: FondoRendirDetalleFormDialogData = { fondo };
    this.dialog
      .open(FondoRendirDetalleFormDialogComponent, {
        data,
        width: '560px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((fondoActualizado: FondoRendirCuentas | undefined) => {
        if (!fondoActualizado) return;
        this.huboCambios = true;
        this.cargar();
      });
  }

  editarComprobante(d: DetalleFondoRendir): void {
    const fondo = this.fondo();
    if (!fondo) return;
    const data: FondoRendirDetalleFormDialogData = { fondo, detalle: d };
    this.dialog
      .open(FondoRendirDetalleFormDialogComponent, {
        data,
        width: '560px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((fondoActualizado: FondoRendirCuentas | undefined) => {
        if (!fondoActualizado) return;
        this.huboCambios = true;
        this.cargar();
      });
  }

  anularComprobante(d: DetalleFondoRendir): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Anular comprobante',
          message: `¿Confirmas anular el comprobante "${d.concepto}" por ${this.num(d.monto).toFixed(2)}? Deja de contar como justificado.`,
          confirmLabel: 'Anular',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.fondoRendirService.cambiarEstadoDetalle(d.id, false).subscribe({
          next: (fondo) => {
            this.fondo.set(fondo);
            this.huboCambios = true;
            this.snackBar.open('Comprobante anulado', 'Cerrar', {
              duration: 3000,
            });
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo anular el comprobante',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  // ---------- Cargar a kardex ----------

  get puedeCerrarConDeuda(): boolean {
    const f = this.fondo();
    // Solo tiene sentido si el destinatario todavía debe rendir cuentas.
    return (
      !!f &&
      (f.estado === 'PENDIENTE' || f.estado === 'RENDIDO_PARCIAL') &&
      this.num(f.saldoPendiente) > 0
    );
  }

  cerrarConDeuda(): void {
    const f = this.fondo();
    if (!f) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Cargar saldo pendiente al kardex',
          message: `Se cargará ${this.num(f.saldoPendiente).toFixed(2)} como deuda en el kardex de ${this.nombreDestinatario(f)}. Esta acción no se puede deshacer justificando después — requiere que el destinatario tenga un kardex ABIERTO. ¿Confirmas?`,
          confirmLabel: 'Cargar a kardex',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'warning_amber',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.fondoRendirService.cerrarConDeuda(f.id).subscribe({
          next: (fondo) => {
            this.fondo.set(fondo);
            this.huboCambios = true;
            this.snackBar.open('Saldo pendiente cargado al kardex', 'Cerrar', {
              duration: 4000,
            });
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo cargar el saldo al kardex',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  // ---------- Excel ----------

  /** Abre el reporte precargado con el destinatario y el mes del fondo. */
  exportarExcel(f: FondoRendirCuentas): void {
    const [anio, mes] = (f.fecha ?? '').slice(0, 10).split('-').map(Number);
    const data: FondoRendirExcelDialogData = {
      idPersona: f.idPersona ?? f.persona?.id ?? null,
      idActorProductivoMinero:
        f.idActorProductivoMinero ?? f.actorProductivoMinero?.id ?? null,
      ...(anio ? { gestion: anio } : {}),
      ...(mes ? { mes } : {}),
    };
    this.dialog.open(FondoRendirExcelDialogComponent, {
      data,
      width: '520px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  // ---------- Presentación ----------

  /** Quien aprobó la entrega, tomado del recibo generado al entregar el fondo. */
  nombreAprobador(f: FondoRendirCuentas): string {
    const p = f.recibo?.personaAutorizo;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

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
}
