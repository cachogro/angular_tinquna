// src/app/pages/contabilidad/kardex/bienes-dacion-dialog/bienes-dacion-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BienDacionPago,
  EstadoBienDacion,
} from '../../models/bien-dacion-pago.models';
import { BienDacionPagoService } from '../../services/bien-dacion-pago.service';
import {
  BienDacionFormDialogComponent,
  BienDacionFormDialogData,
  ModoBienDacion,
} from '../bien-dacion-form-dialog/bien-dacion-form-dialog.component';
import {
  BienDacionGastosDialogComponent,
  BienDacionGastosDialogData,
} from '../bien-dacion-gastos-dialog/bien-dacion-gastos-dialog.component';

export interface BienesDacionDialogData {
  nombreDestinatario: string;
  /** Uno de los dos (excluyentes). */
  idActorProductivoMinero?: string;
  idPersona?: string;
  /** Registrar, tomar en pago y la venta directa exigen kardex ABIERTO;
   *  devolver, cargar gastos y vender un bien ya tomado en pago, no. */
  tieneKardexAbierto: boolean;
}

@Component({
  selector: 'app-bienes-dacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './bienes-dacion-dialog.component.html',
  styleUrl: './bienes-dacion-dialog.component.scss',
})
export class BienesDacionDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<BienesDacionDialogComponent>,
  );
  readonly data = inject<BienesDacionDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(BienDacionPagoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly bienes = signal<BienDacionPago[]>([]);
  readonly total = signal(0);

  estado: EstadoBienDacion | '' = '';
  pageIndex = 0;
  pageSize = 10;

  /** Si hubo altas o transiciones, el kardex recarga su resumen al cerrar. */
  private huboCambios = false;

  readonly columnas = [
    'fechaRecepcion',
    'descripcion',
    'valorReferencial',
    'estado',
    'costo',
    'resolucion',
    'observaciones',
    'acciones',
  ];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service
      .listar({
        idActorProductivoMinero: this.data.idActorProductivoMinero,
        idPersona: this.data.idPersona,
        estado: this.estado || undefined,
        page: this.pageIndex + 1,
        limit: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.bienes.set(res.data);
          this.total.set(res.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.bienes.set([]);
          this.total.set(0);
          this.cargando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudieron cargar los bienes',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  onEstadoChange(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargar();
  }

  registrar(): void {
    if (!this.data.tieneKardexAbierto) return;
    this.abrirForm('REGISTRAR');
  }

  /** La empresa se queda con el bien: abona el valor acordado a su kardex. */
  tomarEnPago(b: BienDacionPago): void {
    this.abrirForm('TOMAR_EN_PAGO', b);
  }

  vender(b: BienDacionPago): void {
    this.abrirForm('VENDER', b);
  }

  /** Gastos del bien: se cargan con el bien tomado en pago; vendido, solo
   *  se consultan. */
  gastos(b: BienDacionPago): void {
    const data: BienDacionGastosDialogData = {
      bien: b,
      nombreDestinatario: this.data.nombreDestinatario,
    };
    this.dialog
      .open(BienDacionGastosDialogComponent, {
        data,
        width: '820px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((huboCambios: boolean) => {
        if (!huboCambios) return;
        this.huboCambios = true;
        this.cargar();
      });
  }

  /** Vender o tomar en pago abonan al kardex: necesitan uno abierto, salvo
   *  vender un bien ya tomado en pago (ahí solo entra el dinero). */
  puedeVender(b: BienDacionPago): boolean {
    return (
      b.estado === 'TOMADO_EN_PAGO' ||
      (b.estado === 'EN_POSESION' && this.data.tieneKardexAbierto)
    );
  }

  puedeTomarEnPago(b: BienDacionPago): boolean {
    return b.estado === 'EN_POSESION' && this.data.tieneKardexAbierto;
  }

  tieneGastos(b: BienDacionPago): boolean {
    return (b.gastos?.length ?? 0) > 0;
  }

  devolver(b: BienDacionPago): void {
    this.abrirForm('DEVOLVER', b);
  }

  private abrirForm(modo: ModoBienDacion, bien?: BienDacionPago): void {
    const data: BienDacionFormDialogData = {
      modo,
      bien,
      nombreDestinatario: this.data.nombreDestinatario,
      idActorProductivoMinero: this.data.idActorProductivoMinero,
      idPersona: this.data.idPersona,
    };
    this.dialog
      .open(BienDacionFormDialogComponent, {
        data,
        width: '620px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        this.huboCambios = true;
        this.cargar();
      });
  }

  cerrarDialogo(): void {
    this.dialogRef.close(this.huboCambios);
  }

  estadoLabel(e: EstadoBienDacion): string {
    if (e === 'EN_POSESION') return 'EN POSESIÓN';
    if (e === 'TOMADO_EN_PAGO') return 'TOMADO EN PAGO';
    return e;
  }

  /** Valor absoluto, para mostrar la pérdida sin el signo. */
  abs(n: number): number {
    return Math.abs(n);
  }

  num(v: number | string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }
}
