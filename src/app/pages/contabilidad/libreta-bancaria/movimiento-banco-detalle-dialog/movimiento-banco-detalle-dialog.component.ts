// src/app/pages/contabilidad/libreta-bancaria/movimiento-banco-detalle-dialog/movimiento-banco-detalle-dialog.component.ts
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
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MonedaCuenta,
  etiquetaMonedaCuenta,
} from '../../../configurations/parametricas/models/parametricas.models';
import {
  MovimientoBancoDetalle,
  PersonaMovimientoRef,
} from '../../models/libreta-banco.models';
import { LibretaBancoService } from '../../services/libreta-banco.service';
import {
  ReciboDetalleDialogComponent,
  ReciboDetalleDialogData,
} from '../../recibos/recibo-detalle-dialog/recibo-detalle-dialog.component';
import {
  TraspasoDetalleDialogComponent,
  TraspasoDetalleDialogData,
} from '../../traspasos/traspaso-detalle-dialog/traspaso-detalle-dialog.component';

export interface MovimientoBancoDetalleDialogData {
  id: string;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-movimiento-banco-detalle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './movimiento-banco-detalle-dialog.component.html',
  styleUrl: './movimiento-banco-detalle-dialog.component.scss',
})
export class MovimientoBancoDetalleDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<MovimientoBancoDetalleDialogComponent>,
  );
  readonly data = inject<MovimientoBancoDetalleDialogData>(MAT_DIALOG_DATA);
  private readonly libretaService = inject(LibretaBancoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly movimiento = signal<MovimientoBancoDetalle | null>(null);

  ngOnInit(): void {
    this.libretaService.obtener(this.data.id).subscribe({
      next: (m) => {
        this.movimiento.set(m);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar el movimiento',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  esHaber(m: MovimientoBancoDetalle): boolean {
    return this.num(m.haber) > 0;
  }

  monto(m: MovimientoBancoDetalle): number {
    return this.esHaber(m) ? this.num(m.haber) : this.num(m.debe);
  }

  moneda(m: MovimientoBancoDetalle): string {
    const mon = m.cuentaBancaria?.moneda;
    return mon ? etiquetaMonedaCuenta(mon as MonedaCuenta) : '';
  }

  /** "BNB · 1234567" — sigla (o nombre) del banco + n° de cuenta. */
  cuentaLabel(m: MovimientoBancoDetalle): string {
    const c = m.cuentaBancaria;
    if (!c) return '—';
    const ent = c.entidadFinanciera?.sigla || c.entidadFinanciera?.nombre || '';
    const alias = c.alias ? ` "${c.alias}"` : '';
    return `${ent}${alias} · ${c.numeroCuenta}`.trim();
  }

  periodoLabel(m: MovimientoBancoDetalle): string {
    const p = m.periodoBanco;
    if (!p) return '—';
    const nombre =
      p.tipo === 'MENSUAL' && p.mes ? `${MESES[p.mes - 1]} ${p.gestion}` : `Gestión ${p.gestion}`;
    return `${nombre} · ${p.estado === 'CERRADO' ? 'Cerrado' : 'Abierto'}`;
  }

  beneficiario(m: MovimientoBancoDetalle): string {
    return m.persona ? this.nombrePersona(m.persona) : m.nombresApellidos || '—';
  }

  nombrePersona(p: PersonaMovimientoRef): string {
    return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  codigoRecibo(m: MovimientoBancoDetalle): string {
    const r = m.recibo;
    return r ? `${r.serie}-${String(r.numero).padStart(4, '0')}` : '';
  }

  titularKardex(m: MovimientoBancoDetalle): string {
    const k = m.movimientoKardex?.kardex;
    if (!k) return '—';
    if (k.persona) return this.nombrePersona(k.persona);
    if (k.actorProductivoMinero) return k.actorProductivoMinero.nombre;
    if (k.cliente) return k.cliente.nombre;
    return '—';
  }

  verRecibo(id: string): void {
    const data: ReciboDetalleDialogData = { id };
    this.dialog.open(ReciboDetalleDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  verTraspaso(id: string): void {
    const data: TraspasoDetalleDialogData = { id };
    this.dialog.open(TraspasoDetalleDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, mes, d] = iso.slice(0, 10).split('-');
    return d && mes && a ? `${d}/${mes}/${a}` : iso;
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

  num(v: string | number | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
