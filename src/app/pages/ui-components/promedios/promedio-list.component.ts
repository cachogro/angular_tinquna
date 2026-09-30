// src/app/pages/ui-components/promedios/promedio-list.component.ts
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { PromedioMineral } from '../models/promedio-mineral.models';
import { PromedioMineralService } from '../services/promedio-mineral.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-promedio-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './promedio-list.component.html',
  styleUrl: './promedio-list.component.scss',
})
export class PromedioListComponent implements OnInit {
  private readonly service = inject(PromedioMineralService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'codigo',
    'lote',
    'fecha',
    'descripcion',
    'cantidad',
    'sacos',
    'peso',
    'leyes',
    'humedad',
    'totalInvertido',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly registros = signal<PromedioMineral[]>([]);
  readonly total = signal(0);
  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly orderDirectionControl = new FormControl<'ASC' | 'DESC'>('DESC');

  ngOnInit(): void {
    this.searchControl.valueChanges
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
    this.service
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value?.trim() || undefined,
        orderBy: 'id',
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
            err?.error?.message ?? 'No se pudo cargar el listado de promedios',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  onPageChange(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargar();
  }

  toggleOrden(): void {
    this.orderDirectionControl.setValue(
      this.orderDirectionControl.value === 'ASC' ? 'DESC' : 'ASC',
    );
  }

  // ---------- Acciones ----------

  nuevo(): void {
    this.router.navigate(['/ui-components/promedios/nuevo']);
  }

  editar(p: PromedioMineral): void {
    this.router.navigate(['/ui-components/promedios/editar', p.id]);
  }

  anular(p: PromedioMineral): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Anular promedio ${p.codigo}`,
          message:
            'El promedio se anula y sus valorizaciones vuelven a quedar disponibles para otros promedios.',
          confirmLabel: 'Anular',
          tone: 'danger',
          icon: 'block',
        },
        width: '400px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.service.anular(p.id).subscribe({
          next: () => {
            this.snackBar.open(`Promedio ${p.codigo} anulado`, 'Cerrar', {
              duration: 3000,
            });
            this.cargar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo anular el promedio',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  // ---------- Presentación ----------

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }
}
