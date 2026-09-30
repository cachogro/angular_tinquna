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

export interface BienesDacionDialogData {
  nombreDestinatario: string;
  /** Uno de los dos (excluyentes). */
  idActorProductivoMinero?: string;
  idPersona?: string;
  /** Registrar un bien exige kardex ABIERTO; vender/devolver no. */
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

  vender(b: BienDacionPago): void {
    this.abrirForm('VENDER', b);
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
    return e === 'EN_POSESION' ? 'EN POSESIÓN' : e;
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
