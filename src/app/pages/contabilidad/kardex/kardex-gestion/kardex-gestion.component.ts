// src/app/pages/contabilidad/kardex/kardex-gestion/kardex-gestion.component.ts
// Gestión del kardex de un destinatario (actor, persona o cliente) como
// página propia (/contabilidad/kardex/gestionar), igual que el formulario de
// recepción de mineral: se entra desde la bandeja de Kardex o desde el botón
// "Kardex" de actores/clientes/personal, y se sale con la flecha de volver.
import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { Kardex, TipoKardex } from '../../models/kardex.models';
import { MovimientoKardex } from '../../models/movimiento-kardex.models';
import { BienDacionPagoService } from '../../services/bien-dacion-pago.service';
import { KardexService } from '../../services/kardex.service';
import { MovimientoKardexService } from '../../services/movimiento-kardex.service';
import {
  BienesDacionDialogComponent,
  BienesDacionDialogData,
} from '../bienes-dacion-dialog/bienes-dacion-dialog.component';
import {
  MovimientoKardexFormDialogComponent,
  MovimientoKardexFormDialogData,
} from '../movimiento-kardex-form-dialog/movimiento-kardex-form-dialog.component';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { mensajeErrorBlob } from '../../../../shared/utils/descarga-archivo.util';

export interface KardexGestionData {
  tipo: TipoKardex;
  idActorProductivoMinero?: string;
  idPersona?: string;
  idCliente?: string;
  nombreDestinatario: string;
}

const RUTA_GESTION = '/contabilidad/kardex/gestionar';
const RUTA_BANDEJA = '/contabilidad/kardex';
const TIPOS_KARDEX: TipoKardex[] = ['ACTOR', 'PERSONAL', 'ASOCIADO', 'CLIENTE'];

/** Navega a la página de gestión del kardex del destinatario. Los datos van
 *  en la URL (query params) para que la página sobreviva a un F5. */
export function irAGestionKardex(router: Router, d: KardexGestionData): void {
  router.navigate([RUTA_GESTION], {
    queryParams: {
      tipo: d.tipo,
      idActor: d.idActorProductivoMinero || null,
      idPersona: d.idPersona || null,
      idCliente: d.idCliente || null,
      nombre: d.nombreDestinatario || null,
    },
  });
}

@Component({
  selector: 'app-kardex-gestion',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
  ],
  templateUrl: './kardex-gestion.component.html',
  styleUrl: './kardex-gestion.component.scss',
})
export class KardexGestionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  /** Destinatario leído de la URL. `nombreDestinatario` se completa desde el
   *  kardex cargado si no vino en la URL. */
  readonly data: KardexGestionData = this.leerDestinatario();
  /** false si la URL no trae un destinatario válido (se vuelve a la bandeja). */
  readonly destinatarioValido =
    TIPOS_KARDEX.includes(this.data.tipo) &&
    !!(this.data.idActorProductivoMinero || this.data.idPersona || this.data.idCliente);
  readonly nombre = signal(this.data.nombreDestinatario);
  private readonly kardexService = inject(KardexService);
  private readonly movimientoService = inject(MovimientoKardexService);
  private readonly bienDacionService = inject(BienDacionPagoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly descargandoExcel = signal(false);
  readonly registros = signal<Kardex[]>([]);

  readonly cargandoMovimientos = signal(false);
  readonly movimientos = signal<MovimientoKardex[]>([]);

  /** Bienes en dación de pago: solo aplican a actor y persona (no a cliente). */
  readonly soportaBienes = this.data.tipo !== 'CLIENTE';
  readonly bienesTotal = signal(0);
  readonly bienesEnPosesion = signal(0);

  /** Más reciente primero (N° de línea descendente); el saldo de cada fila
   *  sigue siendo el de su momento. */
  readonly movimientosOrdenados = computed(() =>
    [...this.movimientos()].sort((a, b) => b.numeroLinea - a.numeroLinea),
  );

  /** Paginado de movimientos (lo hace el back, última línea primero). */
  readonly movimientosTotal = signal(0);
  movPageIndex = 0;
  movPageSize = 10;

  readonly columnasMovimientos = [
    'numeroLinea',
    'fecha',
    'nroComprobante',
    'detalle',
    'subcuenta',
    'formaPago',
    'debeUsd',
    'haberUsd',
    'tipoCambio',
    'debe',
    'haber',
    'saldo',
    'acciones',
  ];

  /** Tope del datepicker: no se abre un kardex con fecha futura. */
  readonly hoy = new Date();

  readonly columnas = [
    'numero',
    'gestion',
    'descripcion',
    'estado',
    'saldoInicial',
    'saldo',
    'acciones',
  ];

  readonly hayKardex = computed(() => this.registros().length > 0);

  readonly ordenados = computed(() =>
    [...this.registros()].sort((a, b) => b.numero - a.numero),
  );

  readonly kardexAbierto = computed(
    () => this.registros().find((k) => k.estado === 'ABIERTO') ?? null,
  );

  readonly maxNumero = computed(() =>
    this.registros().length
      ? Math.max(...this.registros().map((k) => k.numero))
      : 0,
  );

  /** La baja lógica solo tiene sentido cuando el único registro es el N°1 (sin historial). */
  readonly puedeDarBaja = computed(() => {
    const regs = this.registros();
    return regs.length === 1 && regs[0].numero === 1;
  });

  readonly form = new FormGroup({
    descripcion: new FormControl('', [Validators.maxLength(150)]),
    /** Fecha de apertura completa (día/mes/año); al guardar solo se envía
     *  el año como `gestion` (es lo único que pide el back). */
    fechaApertura: new FormControl<Date | null>(new Date(), [
      Validators.required,
    ]),
    // Arranca en blanco: el usuario siempre escribe el dato, incluso si es 0.
    saldoInicial: new FormControl<number | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0),
    ]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.f.descripcion.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.descripcion.setValue(up, { emitEvent: false });
    });
    if (!this.destinatarioValido) {
      this.snackBar.open('No se indicó de quién es el kardex', 'Cerrar', {
        duration: 4000,
      });
      this.router.navigate([RUTA_BANDEJA]);
      return;
    }
    this.cargar();
  }

  private leerDestinatario(): KardexGestionData {
    const q = this.route.snapshot.queryParamMap;
    return {
      tipo: (q.get('tipo') ?? '') as TipoKardex,
      idActorProductivoMinero: q.get('idActor') ?? undefined,
      idPersona: q.get('idPersona') ?? undefined,
      idCliente: q.get('idCliente') ?? undefined,
      nombreDestinatario: q.get('nombre') ?? '',
    };
  }

  /** Nombre del titular tomado del kardex, por si la URL no lo trae. */
  private nombreDesdeKardex(k: Kardex): string {
    if (k.actorProductivoMinero) return k.actorProductivoMinero.nombre;
    if (k.cliente) return k.cliente.nombre;
    const p = k.persona;
    return p
      ? `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
          .trim()
          .replace(/\s+/g, ' ')
      : '';
  }

  /** Flecha de volver: regresa a la pantalla de origen (bandeja de Kardex,
   *  actores, clientes…); si se entró directo por URL, va a la bandeja. */
  volver(): void {
    const nav = this.location.getState() as { navigationId?: number } | null;
    if ((nav?.navigationId ?? 1) > 1) {
      this.location.back();
    } else {
      this.router.navigate([RUTA_BANDEJA]);
    }
  }

  private cargar(): void {
    this.cargando.set(true);
    this.kardexService
      .listar({
        tipo: this.data.tipo,
        idActorProductivoMinero: this.data.idActorProductivoMinero,
        idPersona: this.data.idPersona,
        idCliente: this.data.idCliente,
        // Historial completo de este destinatario: no debería pasar de unos
        // pocos números, pero por si acaso pedimos harto margen.
        limit: 100,
        orderBy: 'numero',
        orderDirection: 'ASC',
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          if (!this.nombre() && res.data.length) {
            this.nombre.set(this.nombreDesdeKardex(res.data[0]));
            this.data.nombreDestinatario = this.nombre();
          }
          this.cargando.set(false);
          const abierto = res.data.find((k) => k.estado === 'ABIERTO');
          if (abierto) this.cargarMovimientos(abierto.id);
          else this.movimientos.set([]);
          if (res.data.length) this.cargarResumenBienes();
        },
        error: (err) => {
          this.cargando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar el kardex',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  private cargarMovimientos(idKardex: string): void {
    this.cargandoMovimientos.set(true);
    this.movimientoService
      .listar(idKardex, this.movPageIndex + 1, this.movPageSize)
      .subscribe({
        next: (res) => {
          // Si la página quedó vacía (p. ej. se desactivó la única línea de
          // la última página), retrocede una.
          if (!res.data.length && this.movPageIndex > 0) {
            this.movPageIndex--;
            this.cargarMovimientos(idKardex);
            return;
          }
          this.movimientos.set(res.data);
          this.movimientosTotal.set(res.total);
          this.cargandoMovimientos.set(false);
        },
        error: () => {
          this.movimientos.set([]);
          this.movimientosTotal.set(0);
          this.cargandoMovimientos.set(false);
        },
      });
  }

  onMovimientosPage(event: PageEvent): void {
    this.movPageIndex = event.pageIndex;
    this.movPageSize = event.pageSize;
    const ka = this.kardexAbierto();
    if (ka) this.cargarMovimientos(ka.id);
  }

  /** Solo los conteos (limit=1, se usa `total`) para el tile y el botón. */
  private cargarResumenBienes(): void {
    if (!this.soportaBienes) return;
    const destinatario = this.destinatarioBienes();
    forkJoin({
      todos: this.bienDacionService.listar({ ...destinatario, limit: 1 }),
      enPosesion: this.bienDacionService.listar({
        ...destinatario,
        estado: 'EN_POSESION',
        limit: 1,
      }),
    }).subscribe({
      next: ({ todos, enPosesion }) => {
        this.bienesTotal.set(todos.total);
        this.bienesEnPosesion.set(enPosesion.total);
      },
      error: () => {
        this.bienesTotal.set(0);
        this.bienesEnPosesion.set(0);
      },
    });
  }

  private destinatarioBienes(): {
    idActorProductivoMinero?: string;
    idPersona?: string;
  } {
    return this.data.tipo === 'ACTOR'
      ? { idActorProductivoMinero: this.data.idActorProductivoMinero }
      : { idPersona: this.data.idPersona };
  }

  abrirBienes(): void {
    if (!this.soportaBienes) return;
    const data: BienesDacionDialogData = {
      ...this.destinatarioBienes(),
      nombreDestinatario: this.data.nombreDestinatario,
      tieneKardexAbierto: !!this.kardexAbierto(),
    };
    this.dialog
      .open(BienesDacionDialogComponent, {
        data,
        width: '980px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((huboCambios) => {
        // Vender un bien postea un HABER en el kardex: recargar saldo y
        // movimientos, no solo el resumen de bienes (cargar() incluye ambos).
        if (huboCambios) this.cargar();
      });
  }

  abrir(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();
    const descripcion = (v.descripcion ?? '').trim();

    this.kardexService
      .abrir({
        tipo: this.data.tipo,
        idActorProductivoMinero: this.data.idActorProductivoMinero,
        idPersona: this.data.idPersona,
        idCliente: this.data.idCliente,
        ...(descripcion ? { descripcion } : {}),
        gestion: v.fechaApertura!.getFullYear(),
        saldoInicial: Number(v.saldoInicial),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open('Kardex N°1 abierto correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo abrir el kardex',
            'Cerrar',
            { duration: 5000 },
          );
        },
      });
  }

  cerrar(k: Kardex): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Cerrar kardex',
          message: `¿Confirmas cerrar el N°${k.numero}? El saldo actual (Bs ${this.num(k.saldoActual).toFixed(2)}) queda como saldo de cierre y se abre el N°${k.numero + 1} arrastrándolo.`,
          confirmLabel: 'Cerrar',
          cancelLabel: 'Cancelar',
          tone: 'default',
          icon: 'lock',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.kardexService.cerrar(k.id).subscribe({
          next: (res) => {
            this.guardando.set(false);
            this.movPageIndex = 0; // cambia el kardex abierto
            this.snackBar.open(
              `Cerrado N°${res.cerrado?.numero ?? k.numero}. Abierto N°${res.nuevo?.numero ?? k.numero + 1}`,
              'Cerrar',
              { duration: 4000 },
            );
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo cerrar el kardex',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  reabrir(k: Kardex): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Reabrir kardex',
          message: `¿Confirmas reabrir el N°${k.numero}? Si el N°${k.numero + 1} no tiene movimientos, se elimina.`,
          confirmLabel: 'Reabrir',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'lock_open',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.kardexService.reabrir(k.id).subscribe({
          next: () => {
            this.guardando.set(false);
            this.movPageIndex = 0; // cambia el kardex abierto
            this.snackBar.open('Kardex reabierto', 'Cerrar', {
              duration: 3000,
            });
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo reabrir el kardex',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  toggleActivo(k: Kardex): void {
    const activar = k.activo === false;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activar ? 'Activar kardex' : 'Dar de baja el kardex',
          message: activar
            ? `¿Confirmas activar el N°${k.numero}?`
            : `¿Confirmas dar de baja el N°${k.numero}? Solo aplica porque todavía no tiene historial.`,
          confirmLabel: activar ? 'Activar' : 'Dar de baja',
          cancelLabel: 'Cancelar',
          tone: activar ? 'default' : 'danger',
          icon: activar ? 'check_circle_outline' : 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.kardexService.cambiarEstado(k.id, activar).subscribe({
          next: () => {
            this.guardando.set(false);
            this.snackBar.open(
              activar ? 'Kardex activado' : 'Kardex dado de baja',
              'Cerrar',
              { duration: 3000 },
            );
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo cambiar el estado',
              'Cerrar',
              { duration: 5000 },
            );
          },
        });
      });
  }

  // ---------- Movimientos del kardex abierto ----------

  nuevoMovimiento(): void {
    const ka = this.kardexAbierto();
    if (!ka) return;
    const data: MovimientoKardexFormDialogData = {
      idKardex: ka.id,
      nombreDestinatario: this.data.nombreDestinatario,
      idPersonaPropietario:
        this.data.tipo === 'PERSONAL' || this.data.tipo === 'ASOCIADO'
          ? this.data.idPersona
          : undefined,
    };
    this.dialog
      .open(MovimientoKardexFormDialogComponent, {
        data,
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        // La línea nueva es la última: queda arriba en la página 1.
        this.movPageIndex = 0;
        this.cargar();
      });
  }

  editarMovimiento(m: MovimientoKardex): void {
    const data: MovimientoKardexFormDialogData = {
      idKardex: m.idKardex,
      movimiento: m,
      nombreDestinatario: this.data.nombreDestinatario,
    };
    this.dialog
      .open(MovimientoKardexFormDialogComponent, {
        data,
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((r) => {
        if (r) this.cargar();
      });
  }

  desactivarMovimiento(m: MovimientoKardex): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Desactivar movimiento',
          message: `¿Confirmas desactivar el movimiento "${m.detalle}"? Se recalcula el saldo del kardex sin él.`,
          confirmLabel: 'Desactivar',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.movimientoService.cambiarEstado(m.id, false).subscribe({
          next: () => {
            this.snackBar.open('Movimiento desactivado', 'Cerrar', {
              duration: 3000,
            });
            this.cargar();
          },
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo desactivar el movimiento',
              'Cerrar',
              { duration: 4000 },
            ),
        });
      });
  }

  descargarExcel(k: Kardex): void {
    if (this.descargandoExcel()) return;
    this.descargandoExcel.set(true);
    this.kardexService.descargarExcel(k.id).subscribe({
      next: (blob) => {
        this.descargandoExcel.set(false);
        const url = window.URL.createObjectURL(blob);
        const nombre = this.data.nombreDestinatario
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `KARDEX_N${k.numero}_${nombre}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: async (err) => {
        this.descargandoExcel.set(false);
        this.snackBar.open(
          (await mensajeErrorBlob(err)) ?? 'No se pudo generar el Excel del kardex',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  num(v: string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Importe en $us de una línea USD; 0 en líneas Bs (celda vacía). */
  usd(m: MovimientoKardex, v: string | null | undefined): number {
    return m.moneda === 'USD' ? this.num(v) : 0;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }
}
