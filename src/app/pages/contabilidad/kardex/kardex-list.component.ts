// src/app/pages/contabilidad/kardex/kardex-list.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  EstadoKardex,
  Kardex,
  OrdenKardex,
  TipoKardex,
} from '../models/kardex.models';
import { KardexService } from '../services/kardex.service';
import { KardexDialogComponent, KardexDialogData } from './kardex-dialog.component';

@Component({
  selector: 'app-kardex-list',
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
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './kardex-list.component.html',
  styleUrl: './kardex-list.component.scss',
})
export class KardexListComponent implements OnInit {
  private readonly kardexService = inject(KardexService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'destinatario',
    'numero',
    'tipo',
    'apertura',
    'descripcion',
    'estado',
    'saldoInicial',
    'saldo',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly registros = signal<Kardex[]>([]);
  readonly total = signal(0);

  pageIndex = 0;
  pageSize = 10;

  readonly tipoControl = new FormControl<TipoKardex | null>(null);
  // Por defecto solo los kardex abiertos; "Limpiar" los muestra todos.
  readonly estadoControl = new FormControl<EstadoKardex | null>('ABIERTO');
  // Por defecto solo la gestión en curso; "Limpiar" las muestra todas.
  readonly gestionControl = new FormControl<number | null>(
    new Date().getFullYear(),
  );
  readonly searchControl = new FormControl('');
  // Por id, el más nuevo (id más alto) primero.
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');
  readonly orderBy: OrdenKardex = 'id';

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.tipoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.gestionControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());
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
    this.kardexService
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        tipo: this.tipoControl.value ?? undefined,
        estado: this.estadoControl.value ?? undefined,
        gestion: this.gestionControl.value ?? undefined,
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
            err?.error?.message ?? 'No se pudo cargar el listado de kardex',
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
    this.gestionControl.setValue(null, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.orderDirectionControl.setValue('DESC', { emitEvent: false });
    this.reiniciarYcargar();
  }

  nombreDestinatario(k: Kardex): string {
    if (k.tipo === 'ACTOR') {
      return (
        k.actorProductivoMinero?.nombre ??
        `Actor #${k.idActorProductivoMinero}`
      );
    }
    const p = k.persona;
    return p
      ? `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
          .trim()
          .replace(/\s+/g, ' ')
      : `Persona #${k.idPersona}`;
  }

  gestionarKardex(k: Kardex): void {
    const data: KardexDialogData = {
      tipo: k.tipo,
      idActorProductivoMinero: k.idActorProductivoMinero ?? undefined,
      idPersona: k.idPersona ?? undefined,
      nombreDestinatario: this.nombreDestinatario(k),
    };
    this.dialog
      .open(KardexDialogComponent, {
        data,
        width: '1000px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe(() => this.cargar());
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
}
