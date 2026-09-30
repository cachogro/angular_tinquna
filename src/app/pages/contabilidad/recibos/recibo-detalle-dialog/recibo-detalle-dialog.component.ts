// src/app/pages/contabilidad/recibos/recibo-detalle-dialog/recibo-detalle-dialog.component.ts
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Observable } from 'rxjs';
import { DetalleRecibo, Recibo } from '../../models/recibo.models';
import { ReciboService } from '../../services/recibo.service';
import { mensajeErrorBlob } from '../../../../shared/utils/descarga-archivo.util';

export interface ReciboDetalleDialogData {
  id: string;
}

@Component({
  selector: 'app-recibo-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './recibo-detalle-dialog.component.html',
  styleUrl: './recibo-detalle-dialog.component.scss',
})
export class ReciboDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<ReciboDetalleDialogComponent>,
  );
  readonly data = inject<ReciboDetalleDialogData>(MAT_DIALOG_DATA);
  private readonly reciboService = inject(ReciboService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly descargandoPdf = signal(false);
  readonly recibo = signal<Recibo | null>(null);

  readonly columnas = ['destino', 'destinatario', 'destinoGasto', 'monto'];

  ngOnInit(): void {
    this.reciboService.obtener(this.data.id).subscribe({
      next: (recibo) => {
        this.recibo.set(recibo);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar el recibo',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  /** `idPersona`: contraparte física del recibo ("Recibí de" en un ingreso,
   *  "Entregué a" en un egreso), según la define el back. */
  labelContraparte(r: Recibo): string {
    return r.tipo === 'INGRESO' ? 'Recibí de' : 'Entregué a';
  }

  /** Código legible: "R-0020" / "C-0003" (serie + numero con 4 dígitos). */
  codigoRecibo(r: Recibo): string {
    return `${r.serie}-${String(r.numero).padStart(4, '0')}`;
  }

  nombrePersona(r: Recibo): string {
    const p = r.persona;
    if (p) {
      return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
        .trim()
        .replace(/\s+/g, ' ');
    }
    if (r.actorProductivoMinero) {
      return `${r.actorProductivoMinero.nombre} (actor productivo)`;
    }
    if (r.cliente) {
      return `${r.cliente.nombre} (cliente)`;
    }
    return r.nombresApellidos || '—';
  }

  nombrePersonaAutorizo(r: Recibo): string {
    const p = r.personaAutorizo;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  estadoLabel(r: Recibo): string {
    return { BORRADOR: 'Borrador', PROCESADO: 'Procesado', ANULADO: 'Anulado' }[
      r.estado
    ];
  }

  /** "BCP 0011-2233" — sigla (o nombre) de la entidad + n° de cuenta. */
  nombreCuenta(r: Recibo): string {
    const c = r.cuentaBancaria;
    if (!c) return '';
    const ent = c.entidadFinanciera?.sigla || c.entidadFinanciera?.nombre || '';
    return `${ent ? `${ent} ` : ''}${c.numeroCuenta}`;
  }

  destinatarioDetalle(d: DetalleRecibo): string {
    if (d.destino === 'EFECTIVO') return 'Efectivo';
    if (d.destino === 'ACTOR') {
      return d.actorProductivoMinero?.nombre ?? `Actor #${d.idActorProductivoMinero}`;
    }
    if (d.destino === 'CLIENTE') {
      return d.cliente?.nombre ?? `Cliente #${d.idCliente}`;
    }
    const p = d.persona;
    return p
      ? `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
          .trim()
          .replace(/\s+/g, ' ')
      : `Persona #${d.idPersona}`;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  /** `fechaHoraGeneracion` es un timestamp completo (con hora, en UTC) —
   *  a diferencia de `fecha` (solo fecha contable), acá sí conviene mostrar
   *  la hora, convertida a la hora local del navegador. */
  fechaHoraFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }

  num(v: string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  verPdf(): void {
    this.abrirPdf(this.reciboService.obtenerPdf(this.data.id));
  }

  verPdfDetallado(): void {
    this.abrirPdf(this.reciboService.obtenerPdfDetallado(this.data.id));
  }

  private abrirPdf(obs: Observable<Blob>): void {
    if (this.descargandoPdf()) return;
    this.descargandoPdf.set(true);
    obs.subscribe({
      next: (blob) => {
        this.descargandoPdf.set(false);
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      },
      error: async (err) => {
        this.descargandoPdf.set(false);
        this.snackBar.open(
          (await mensajeErrorBlob(err)) ?? 'No se pudo generar el PDF del recibo',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
