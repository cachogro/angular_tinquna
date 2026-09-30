// src/app/pages/contabilidad/traspasos/traspaso-detalle-dialog/traspaso-detalle-dialog.component.ts
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
import { etiquetaMonedaCuenta } from '../../../configurations/parametricas/models/parametricas.models';
import { Traspaso } from '../../models/traspaso.models';
import { TraspasoService } from '../../services/traspaso.service';

export interface TraspasoDetalleDialogData {
  id: string;
}

@Component({
  selector: 'app-traspaso-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './traspaso-detalle-dialog.component.html',
  styleUrl: './traspaso-detalle-dialog.component.scss',
})
export class TraspasoDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<TraspasoDetalleDialogComponent>,
  );
  readonly data = inject<TraspasoDetalleDialogData>(MAT_DIALOG_DATA);
  private readonly traspasoService = inject(TraspasoService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly traspaso = signal<Traspaso | null>(null);

  ngOnInit(): void {
    this.traspasoService.obtener(this.data.id).subscribe({
      next: (t) => {
        this.traspaso.set(t);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar el traspaso',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  tipoLabel(t: Traspaso): string {
    return t.tipo === 'DEPOSITO'
      ? 'Depósito · Caja → Banco'
      : 'Retiro · Banco → Caja';
  }

  /** Origen y destino de los fondos según el tipo. */
  origen(t: Traspaso): string {
    return t.tipo === 'DEPOSITO' ? this.cajaLabel(t) : this.cuentaLabel(t);
  }

  destino(t: Traspaso): string {
    return t.tipo === 'DEPOSITO' ? this.cuentaLabel(t) : this.cajaLabel(t);
  }

  cajaLabel(t: Traspaso): string {
    return t.caja?.nombre || '—';
  }

  cuentaLabel(t: Traspaso): string {
    const c = t.cuentaBancaria;
    if (!c) return '—';
    const banco = c.entidadFinanciera?.nombre ?? '';
    const alias = c.alias ? ` "${c.alias}"` : '';
    return `${banco}${alias} · ${c.numeroCuenta}`.trim();
  }

  moneda(t: Traspaso): string {
    return etiquetaMonedaCuenta(t.moneda);
  }

  nombreAutorizo(t: Traspaso): string {
    const p = t.personaAutorizo;
    if (!p) return '—';
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  /** `fechaRegistro` es timestamp completo: se muestra con hora local. */
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

  cerrar(): void {
    this.dialogRef.close();
  }
}
