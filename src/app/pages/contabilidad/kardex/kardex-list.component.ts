// src/app/pages/contabilidad/kardex/kardex-list.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  EstadoKardex,
  Kardex,
  OrdenKardex,
  TipoKardex,
} from '../models/kardex.models';
import { KardexService } from '../services/kardex.service';
import {
  descargarBlob,
  mensajeErrorBlob,
} from '../../../shared/utils/descarga-archivo.util';
import {
  KardexGestionData,
  irAGestionKardex,
} from './kardex-gestion/kardex-gestion.component';
import { AuthService } from 'src/app/core/auth/services/auth.service';
import { RolCodigo } from 'src/app/core/auth/models/auth.models';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

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
    MatTabsModule,
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
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly columnas = [
    'destinatario',
    'numero',
    'tipo',
    'apertura',
    'descripcion',
    'estado',
    'actividad',
    'saldoInicial',
    'saldo',
    'acciones',
  ];

  readonly cargando = signal(true);
  readonly descargandoDeudas = signal(false);
  readonly registros = signal<Kardex[]>([]);
  readonly total = signal(0);
  /** Id del kardex que se está reactivando (spinner del botón). */
  readonly reactivandoId = signal<string | null>(null);

  pageIndex = 0;
  pageSize = 10;

  /** Pestañas de la bandeja: cada una filtra por un tipo de kardex. */
  readonly pestanas: { label: string; tipo: TipoKardex | null }[] = [
    { label: 'Todos', tipo: null },
    { label: 'Compras (Actores)', tipo: 'ACTOR' },
    { label: 'Compras (Asociados)', tipo: 'ASOCIADO' },
    { label: 'Ventas (Clientes)', tipo: 'CLIENTE' },
    { label: 'Personal interno', tipo: 'PERSONAL' },
  ];
  pestanaIndex = 0;

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

  /** Excel del resumen de deudas de la pestaña activa: cada pestaña baja el
   *  de su tipo y "Todos" el de todos los kardex. El back marca "INACTIVO
   *  DESDE" con la misma regla de días del listado (KARDEX_DIAS_INACTIVIDAD). */
  descargarResumenDeudas(): void {
    if (this.descargandoDeudas()) return;
    const tipo = this.pestanas[this.pestanaIndex].tipo;
    this.descargandoDeudas.set(true);
    this.kardexService
      .descargarResumenDeudas(tipo ? { tipo } : {})
      .subscribe({
        next: (blob) => {
          this.descargandoDeudas.set(false);
          descargarBlob(
            blob,
            `resumen-deudas${tipo ? '-' + tipo.toLowerCase() : ''}.xlsx`,
          );
        },
        error: async (err) => {
          this.descargandoDeudas.set(false);
          this.snackBar.open(
            (await mensajeErrorBlob(err)) ??
              'No se pudo generar el resumen de deudas',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  onPestanaChange(index: number): void {
    this.pestanaIndex = index;
    this.tipoControl.setValue(this.pestanas[index].tipo);
  }

  etiquetaTipo(tipo: TipoKardex): string {
    switch (tipo) {
      case 'ACTOR':
        return 'Compra · Actor';
      case 'ASOCIADO':
        return 'Compra · Asociado';
      case 'CLIENTE':
        return 'Venta · Cliente';
      default:
        return 'Personal';
    }
  }

  limpiarFiltros(): void {
    this.pestanaIndex = 0;
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
    if (k.tipo === 'CLIENTE') {
      return k.cliente?.nombre ?? `Cliente #${k.idCliente}`;
    }
    const p = k.persona;
    return p
      ? `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`
          .trim()
          .replace(/\s+/g, ' ')
      : `Persona #${k.idPersona}`;
  }

  gestionarKardex(k: Kardex): void {
    const data: KardexGestionData = {
      tipo: k.tipo,
      idActorProductivoMinero: k.idActorProductivoMinero ?? undefined,
      idPersona: k.idPersona ?? undefined,
      idCliente: k.idCliente ?? undefined,
      nombreDestinatario: this.nombreDestinatario(k),
    };
    irAGestionKardex(this.router, data);
  }

  // ------------------------------------------------ actividad (baja lógica)
  /** Solo ADMINISTRADOR y OPERADOR pueden reactivar (el back también lo valida). */
  get puedeReactivar(): boolean {
    return this.authService.hasRole(
      RolCodigo.ADMINISTRADOR,
      RolCodigo.OPERADOR,
    );
  }

  esInactivo(k: Kardex): boolean {
    return k.actividad?.estado === 'INACTIVO';
  }

  /** ACTIVO con 7 días o menos para quedar inactivo. */
  porVencer(k: Kardex): boolean {
    const a = k.actividad;
    return !!a && a.estado === 'ACTIVO' && a.diasInactividad - a.diasSinActividad <= 7;
  }

  detalleActividad(k: Kardex): string {
    const a = k.actividad;
    if (!a) return 'No aplica (kardex cerrado o anulado)';
    if (a.estado === 'INACTIVO') {
      return (
        `Inactivo desde el ${this.fechaFmt(a.inactivoDesde)} · ${a.diasSinActividad} días sin movimientos ` +
        `(límite ${a.diasInactividad}). Último: ${this.fechaFmt(a.ultimaActividad)}. ` +
        'No admite transacciones hasta reactivarlo.'
      );
    }
    const restantes = a.diasInactividad - a.diasSinActividad;
    return (
      `Último movimiento: ${this.fechaFmt(a.ultimaActividad)} · pasa a inactivo el ` +
      `${this.fechaFmt(a.inactivoDesde)} (en ${restantes} días)`
    );
  }

  reactivar(k: Kardex): void {
    const a = k.actividad;
    if (!a || this.reactivandoId()) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Reactivar kardex',
          message:
            `"${this.nombreDestinatario(k)}" (kardex N° ${k.numero}) lleva ${a.diasSinActividad} días sin movimientos ` +
            `y tiene un saldo de Bs ${this.num(k.saldoActual).toFixed(2)}. ` +
            `¿Deseas reactivarlo? Podrá registrar transacciones otra vez por ${a.diasInactividad} días.`,
          confirmLabel: 'Sí, reactivar',
          icon: 'restart_alt',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.reactivandoId.set(k.id);
        this.kardexService.reactivar(k.id).subscribe({
          next: (actualizado) => {
            this.reactivandoId.set(null);
            this.registros.update((lista) =>
              lista.map((x) => (x.id === actualizado.id ? { ...x, ...actualizado } : x)),
            );
            this.snackBar.open('Kardex reactivado', 'Cerrar', { duration: 3000 });
          },
          error: (err) => {
            this.reactivandoId.set(null);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo reactivar el kardex',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
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
