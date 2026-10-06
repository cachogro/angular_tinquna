// src/app/pages/contabilidad/traspasos/traspaso-list.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { Subject, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  Caja,
  MonedaCuentaBancaria,
  etiquetaMonedaCuenta,
} from '../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../configurations/services/parametricas.service';
import { Traspaso, TipoTraspaso } from '../models/traspaso.models';
import { TraspasoService } from '../services/traspaso.service';
import {
  descargarBlob,
  extensionReporte,
  FormatoReporte,
  mensajeErrorBlob,
} from '../../../shared/utils/descarga-archivo.util';
import {
  TraspasoFormDialogComponent,
  TraspasoFormDialogData,
} from './traspaso-form-dialog/traspaso-form-dialog.component';
import {
  TraspasoDetalleDialogComponent,
  TraspasoDetalleDialogData,
} from './traspaso-detalle-dialog/traspaso-detalle-dialog.component';

interface CuentaOpcion {
  idCuenta: number;
  numeroCuenta: string;
  moneda: MonedaCuentaBancaria;
  nombreEntidad: string;
  activo: boolean;
}

@Component({
  selector: 'app-traspaso-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatDialogModule,
  ],
  templateUrl: './traspaso-list.component.html',
  styleUrl: './traspaso-list.component.scss',
})
export class TraspasoListComponent implements OnInit {
  private readonly parametricasService = inject(ParametricasService);
  private readonly traspasoService = inject(TraspasoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly columnas = [
    'fecha',
    'tipo',
    'cuentaBancaria',
    'nroComprobante',
    'concepto',
    'destinoGasto',
    'personaAutorizo',
    'usuarioRegistro',
    'monto',
    'acciones',
  ];

  /** Primer nombre + primer apellido del autorizador congelado en el
   *  traspaso; "—" en los anteriores a la migración 069 (personaAutorizo null). */
  nombreAutorizo(t: Traspaso): string {
    const p = t.personaAutorizo;
    if (!p) return '—';
    const primerNombre = p.nombres?.trim().split(/\s+/)[0] ?? '';
    const apellido =
      p.apellidoPaterno?.trim() || p.apellidoMaterno?.trim() || '';
    return `${primerNombre} ${apellido}`.trim() || '—';
  }

  readonly cargandoCatalogos = signal(true);
  readonly cargando = signal(false);

  readonly cajas = signal<Caja[]>([]);
  readonly cuentas = signal<CuentaOpcion[]>([]);
  readonly traspasos = signal<Traspaso[]>([]);

  readonly cajaFiltro = signal<number | null>(null);
  readonly cuentaFiltro = signal<number | null>(null);
  readonly tipoFiltro = signal<TipoTraspaso | null>(null);
  readonly gestionFiltro = signal<number | null>(null);
  readonly busqueda = signal('');
  private readonly busqueda$ = new Subject<string>();

  readonly total = signal(0);
  pageIndex = 0;
  pageSize = 10;

  readonly cajasActivas = computed(() =>
    this.cajas().filter((c) => c.activo !== false),
  );
  readonly cuentasActivas = computed(() =>
    this.cuentas().filter((c) => c.activo),
  );

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.cargandoCatalogos.set(true);
    forkJoin({
      cajas: this.parametricasService.obtenerCajas(),
      entidades: this.parametricasService.obtenerEntidadesFinancieras(),
    }).subscribe({
      next: ({ cajas, entidades }) => {
        this.cajas.set(cajas);
        const opciones: CuentaOpcion[] = [];
        for (const e of entidades) {
          for (const c of e.cuentas ?? []) {
            opciones.push({
              idCuenta: c.id,
              numeroCuenta: c.numeroCuenta,
              moneda: c.moneda,
              nombreEntidad: e.nombre,
              activo: c.activo !== false,
            });
          }
        }
        opciones.sort((a, b) => a.nombreEntidad.localeCompare(b.nombreEntidad));
        this.cuentas.set(opciones);
        this.cargandoCatalogos.set(false);
        this.cargar();
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar cajas/cuentas', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  /** Por id (orden real de registro), no por fecha: la fecha es editable y
   *  un traspaso cargado con fecha atrasada quedaría enterrado en el listado;
   *  mismo criterio que la bandeja de recibos. */
  cargar(): void {
    this.cargando.set(true);
    this.traspasoService
      .listar({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        idCaja: this.cajaFiltro() ?? undefined,
        idCuentaBancaria: this.cuentaFiltro() ?? undefined,
        tipo: this.tipoFiltro() ?? undefined,
        gestion: this.gestionFiltro() ?? undefined,
        busqueda: this.busqueda().trim() || undefined,
        orderBy: 'id',
        orderDirection: 'DESC',
      })
      .subscribe({
        next: (res) => {
          this.traspasos.set(res.data);
          this.total.set(res.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.traspasos.set([]);
          this.total.set(0);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar el listado de traspasos',
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

  onBusquedaChange(texto: string): void {
    this.busqueda.set(texto ?? '');
    this.busqueda$.next((texto ?? '').trim());
  }

  onCajaFiltroChange(id: number | null): void {
    this.cajaFiltro.set(id);
    this.reiniciarYcargar();
  }

  onCuentaFiltroChange(id: number | null): void {
    this.cuentaFiltro.set(id);
    this.reiniciarYcargar();
  }

  onTipoFiltroChange(tipo: TipoTraspaso | null): void {
    this.tipoFiltro.set(tipo);
    this.reiniciarYcargar();
  }

  onGestionFiltroChange(gestion: number | null): void {
    this.gestionFiltro.set(gestion);
    this.reiniciarYcargar();
  }

  // ---------- Libro de traspasos (Excel) ----------

  readonly descargandoLibro = signal(false);

  /** Excel "Libro de traspasos" con los filtros de la bandeja. El endpoint no
   *  recibe idCaja ni gestion: la gestión se manda como rango de fechas del
   *  año completo y el filtro de caja no se aplica al Excel. */
  descargarLibro(formato: FormatoReporte = 'EXCEL'): void {
    if (this.descargandoLibro()) return;
    const gestion = this.gestionFiltro();
    const fechaDesde = gestion ? `${gestion}-01-01` : undefined;
    const fechaHasta = gestion ? `${gestion}-12-31` : undefined;
    const conFiltroCaja = this.cajaFiltro() != null;

    this.descargandoLibro.set(true);
    this.traspasoService
      .descargarLibroExcel({
        idCuentaBancaria: this.cuentaFiltro() ?? undefined,
        tipo: this.tipoFiltro() ?? undefined,
        busqueda: this.busqueda().trim() || undefined,
        fechaDesde,
        fechaHasta,
      }, formato)
      .subscribe({
        next: (blob) => {
          this.descargandoLibro.set(false);
          descargarBlob(
            blob,
            gestion
              ? `libro-traspasos-${fechaDesde}_al_${fechaHasta}.${extensionReporte(formato)}`
              : `libro-traspasos.${extensionReporte(formato)}`,
          );
          if (conFiltroCaja) {
            this.snackBar.open(
              'El libro de traspasos no filtra por caja: incluye los traspasos de todas las cajas.',
              'Cerrar',
              { duration: 6000 },
            );
          }
        },
        error: async (err) => {
          this.descargandoLibro.set(false);
          this.snackBar.open(
            (await mensajeErrorBlob(err)) ??
              'No se pudo generar el libro de traspasos',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  limpiarFiltros(): void {
    this.cajaFiltro.set(null);
    this.cuentaFiltro.set(null);
    this.tipoFiltro.set(null);
    this.gestionFiltro.set(null);
    this.busqueda.set('');
    this.reiniciarYcargar();
  }

  // ---------- Acciones ----------

  nuevoTraspaso(tipo: TipoTraspaso): void {
    const data: TraspasoFormDialogData = { tipo };
    this.dialog
      .open(TraspasoFormDialogComponent, {
        data,
        width: '640px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.cargar();
      });
  }

  verDetalle(t: Traspaso): void {
    console.log('verDetalle', t);
    const data: TraspasoDetalleDialogData = { id: t.id };

    this.dialog.open(TraspasoDetalleDialogComponent, {
      data,
      width: '720px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  editar(t: Traspaso): void {
    const data: TraspasoFormDialogData = { tipo: t.tipo, traspaso: t };
    this.dialog
      .open(TraspasoFormDialogComponent, {
        data,
        width: '640px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.cargar();
      });
  }

  cambiarEstado(t: Traspaso): void {
    const activo = t.activo !== false;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activo ? 'Anular traspaso' : 'Reactivar traspaso',
          message: activo
            ? `¿Confirmas anular el traspaso del ${this.fechaFmt(t.fecha)} — "${t.concepto}"? Se desactivan también sus movimientos en caja y banco.`
            : `¿Confirmas reactivar el traspaso del ${this.fechaFmt(t.fecha)} — "${t.concepto}"?`,
          confirmLabel: activo ? 'Anular' : 'Reactivar',
          cancelLabel: 'Cancelar',
          tone: activo ? 'danger' : 'default',
          icon: activo ? 'block' : 'restore',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.traspasoService.cambiarEstado(t.id, !activo).subscribe({
          next: () => {
            this.snackBar.open(
              activo ? 'Traspaso anulado' : 'Traspaso reactivado',
              'Cerrar',
              { duration: 3000 },
            );
            this.cargar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo cambiar el estado',
              'Cerrar',
              { duration: 5000 },
            ),
        });
      });
  }

  // ---------- Presentación ----------

  tipoLabel(tipo: TipoTraspaso): string {
    return tipo === 'DEPOSITO'
      ? 'Depósito · Caja → Banco'
      : 'Retiro · Banco → Caja';
  }

  /** Sigla del banco (cae al nombre si la entidad no tiene sigla). */
  cuentaLabel(t: Traspaso): string {
    const c = t.cuentaBancaria;
    if (!c) return '—';
    const banco =
      c.entidadFinanciera?.sigla || c.entidadFinanciera?.nombre || '';
    const alias = c.alias ? ` "${c.alias}"` : '';
    return `${banco}${alias} · ${c.numeroCuenta}`.trim();
  }

  etiquetaCuenta(c: CuentaOpcion): string {
    return `${c.nombreEntidad} · ${c.numeroCuenta} (${etiquetaMonedaCuenta(c.moneda)})`;
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
