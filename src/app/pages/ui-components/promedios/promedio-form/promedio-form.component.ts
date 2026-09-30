// src/app/pages/ui-components/promedios/promedio-form/promedio-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CodificacionCatalogo } from '../../models/registro-mineral.models';
import {
  CodificacionLote,
  EstadoDisponibles,
  PromedioMineral,
  ValorizacionDisponible,
} from '../../models/promedio-mineral.models';
import { PromedioMineralService } from '../../services/promedio-mineral.service';
import { RegistroMineralService } from '../../services/registro-mineral.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

interface LeyPreview {
  idMineral: string;
  mineral: string;
  unidad: string;
  ley: number;
  pesoBase: number;
}

@Component({
  selector: 'app-promedio-form',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTooltipModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule,
    MatPaginatorModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './promedio-form.component.html',
  styleUrl: './promedio-form.component.scss',
})
export class PromedioFormComponent implements OnInit {
  private readonly service = inject(PromedioMineralService);
  private readonly registroService = inject(RegistroMineralService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Sin `:id` en la ruta -> crear. Con `:id` -> editar. */
  private readonly idPromedio = this.route.snapshot.paramMap.get('id');
  readonly editando = !!this.idPromedio;
  readonly promedio = signal<PromedioMineral | null>(null);
  readonly cargandoPromedio = signal(this.editando);
  readonly columnas = [
    'sel',
    'codigo',
    'proveedor',
    'sacos',
    'peso',
    'humedad',
    'leyes',
    'monto',
    'estado',
  ];
  readonly columnasSel = [
    'codigo',
    'proveedor',
    'sacos',
    'peso',
    'humedad',
    'leyes',
    'monto',
    'estado',
    'quitar',
  ];

  readonly codificaciones = signal<CodificacionCatalogo[]>([]);
  readonly disponibles = signal<ValorizacionDisponible[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  pageIndex = 0;
  pageSize = 10;

  /** Selección que sobrevive a cambios de página y de filtros. */
  readonly seleccion = signal<Map<string, ValorizacionDisponible>>(new Map());
  readonly seleccionadas = computed(() => [...this.seleccion().values()]);

  /** Codificación del lote del promedio (no filtra valorizaciones). */
  readonly codificacionesLote = signal<CodificacionLote[]>([]);
  readonly codificacionLoteControl = new FormControl<string | null>(null, [
    Validators.required,
  ]);

  /** Filtro de valorizaciones disponibles por su codificación. */
  readonly codificacionControl = new FormControl<string | null>(null);
  readonly estadoControl = new FormControl<EstadoDisponibles>('ambas');
  readonly searchControl = new FormControl('');
  readonly descripcionControl = new FormControl('', { nonNullable: true });
  readonly fechaControl = new FormControl<Date | null>(new Date());
  readonly observacionesControl = new FormControl('', { nonNullable: true });

  readonly totalKg = computed(() =>
    this.seleccionadas().reduce((s, f) => s + f.pesoKg, 0),
  );
  readonly totalMonto = computed(() =>
    this.seleccionadas().reduce((s, f) => s + (f.valorNetoVentaBolivianos ?? 0), 0),
  );
  readonly totalSacos = computed(() =>
    this.seleccionadas().reduce((s, f) => s + (f.numeroSacos ?? 0), 0),
  );
  /** Filas ya incluidas en un promedio guardado no traen `leyes` (el detalle
   *  del back no las devuelve): la vista previa las deja fuera. */
  readonly sinLeyes = computed(
    () => this.seleccionadas().filter((f) => f.leyes.length === 0).length,
  );

  /** Σ(humedad × peso) / Σ(peso), solo con las filas que tienen humedad. */
  readonly humedadPromedio = computed<number | null>(() => {
    let sp = 0;
    let peso = 0;
    for (const f of this.seleccionadas()) {
      if (f.humedadPorcentaje == null) continue;
      sp += Number(f.humedadPorcentaje) * f.pesoKg;
      peso += f.pesoKg;
    }
    return peso ? sp / peso : null;
  });

  /** Σ(ley × peso) / Σ(peso) por mineral — igual que el SUMPRODUCT/SUM del Excel. */
  readonly preview = computed<LeyPreview[]>(() => {
    const acc = new Map<string, LeyPreview & { sp: number }>();
    for (const f of this.seleccionadas()) {
      for (const l of f.leyes) {
        const a = acc.get(l.idMineral) ?? {
          idMineral: l.idMineral,
          mineral: l.mineral,
          unidad: l.unidad,
          ley: 0,
          pesoBase: 0,
          sp: 0,
        };
        a.sp += l.ley * f.pesoKg;
        a.pesoBase += f.pesoKg;
        acc.set(l.idMineral, a);
      }
    }
    return [...acc.values()].map((a) => ({
      idMineral: a.idMineral,
      mineral: a.mineral,
      unidad: a.unidad,
      pesoBase: a.pesoBase,
      ley: a.pesoBase ? a.sp / a.pesoBase : 0,
    }));
  });

  ngOnInit(): void {
    // Las suscripciones van antes de cargar el catálogo: si este responde de
    // forma síncrona, el setValue por defecto debe disparar la carga.
    this.codificacionControl.valueChanges.subscribe(() => this.reiniciar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciar());
    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciar());

    this.registroService.getAllCodificaciones().subscribe({
      next: (cods) => {
        this.codificaciones.set(cods);
        if (!this.editando && cods.length) {
          this.codificacionControl.setValue(cods[0].codigo);
        }
      },
      error: () =>
        this.snackBar.open(
          'No se pudieron cargar las codificaciones',
          'Cerrar',
          { duration: 4000 },
        ),
    });

    this.service.codificacionesLote().subscribe({
      next: (cods) => this.codificacionesLote.set(cods),
      error: () =>
        this.snackBar.open(
          'No se pudieron cargar las codificaciones del lote',
          'Cerrar',
          { duration: 4000 },
        ),
    });

    // El listado no trae `detalles`: se pide el promedio completo.
    if (this.idPromedio) {
      this.service.obtener(this.idPromedio).subscribe({
        next: (p) => {
          this.precargar(p);
          this.cargandoPromedio.set(false);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message ?? 'No se pudo cargar el promedio',
            'Cerrar',
            { duration: 4000 },
          );
          this.cancelar();
        },
      });
    }
  }

  private precargar(p: PromedioMineral): void {
    this.promedio.set(p);
    this.codificacionLoteControl.setValue(
      p.idCodificacionLote ?? p.codificacionLote?.id ?? null,
    );
    {
      this.descripcionControl.setValue(p.descripcion ?? '');
      this.observacionesControl.setValue(p.observaciones ?? '');
      this.fechaControl.setValue(this.parseFecha(p.fecha));
      const map = new Map<string, ValorizacionDisponible>();
      for (const d of p.detalles ?? []) {
        const rec = d.valorizacion?.recepcionMineral;
        const per = rec?.persona;
        map.set(d.idValorizacion, {
          idValorizacion: d.idValorizacion,
          codigoOperacion: rec?.codigoOperacion ?? `#${d.idValorizacion}`,
          codificacion:
            d.valorizacion?.codificacionValorizacion?.codigo ??
            rec?.codificacion?.codigo ??
            '',
          codificacionRecepcion: rec?.codificacion?.codigo ?? null,
          proveedor: per
            ? `${per.nombres} ${per.apellidoPaterno} ${per.apellidoMaterno ?? ''}`
                .trim()
                .replace(/\s+/g, ' ')
            : '—',
          numeroSacos: d.numeroSacos,
          pesoKg: Number(d.pesoKilogramos),
          valorNetoVentaBolivianos: Number(d.valorNetoVentaBolivianos ?? 0),
          humedadPorcentaje:
            d.humedadPorcentaje != null ? Number(d.humedadPorcentaje) : null,
          leyes: [],
          idEstadoValorizacion: 0,
          estadoValorizacion: '',
          entregado: false,
          fechaValorizacion: '',
        });
      }
      this.seleccion.set(map);
    }
  }

  private reiniciar(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  cargar(): void {
    const cod = this.codificacionControl.value;
    if (!cod) {
      this.disponibles.set([]);
      this.total.set(0);
      return;
    }
    this.cargando.set(true);
    this.service
      .disponibles({
        codificacion: cod,
        estado: this.estadoControl.value ?? 'ambas',
        busqueda: this.searchControl.value?.trim() || undefined,
        page: this.pageIndex + 1,
        limit: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.disponibles.set(res.data);
          this.total.set(res.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.disponibles.set([]);
          this.total.set(0);
          this.snackBar.open(
            err?.error?.message ?? 'No se pudieron cargar las valorizaciones',
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

  // ---------- Selección ----------

  estaSeleccionada(f: ValorizacionDisponible): boolean {
    return this.seleccion().has(f.idValorizacion);
  }

  toggle(f: ValorizacionDisponible): void {
    const m = new Map(this.seleccion());
    if (m.has(f.idValorizacion)) m.delete(f.idValorizacion);
    else m.set(f.idValorizacion, f);
    this.seleccion.set(m);
  }

  quitar(f: ValorizacionDisponible): void {
    const m = new Map(this.seleccion());
    m.delete(f.idValorizacion);
    this.seleccion.set(m);
  }

  paginaCompleta(): boolean {
    const d = this.disponibles();
    return d.length > 0 && d.every((f) => this.estaSeleccionada(f));
  }

  paginaParcial(): boolean {
    const d = this.disponibles();
    return !this.paginaCompleta() && d.some((f) => this.estaSeleccionada(f));
  }

  togglePagina(): void {
    const m = new Map(this.seleccion());
    const marcar = !this.paginaCompleta();
    for (const f of this.disponibles()) {
      if (marcar) m.set(f.idValorizacion, f);
      else m.delete(f.idValorizacion);
    }
    this.seleccion.set(m);
  }

  // ---------- Guardar ----------

  guardar(): void {
    if (this.seleccion().size === 0 || this.guardando()) return;
    if (this.codificacionLoteControl.invalid) {
      this.codificacionLoteControl.markAsTouched();
      return;
    }
    this.guardando.set(true);

    const body = {
      idCodificacionLote: this.codificacionLoteControl.value ?? undefined,
      descripcion: this.descripcionControl.value.trim() || undefined,
      fecha: this.formatFecha(this.fechaControl.value),
      observaciones: this.observacionesControl.value.trim() || undefined,
      idsValorizacion: [...this.seleccion().keys()],
    };

    const req = this.idPromedio
      ? this.service.actualizar(this.idPromedio, body)
      : this.service.crear(body);

    req.subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.snackBar.open(
          (this.editando
            ? `Promedio ${res.codigo} actualizado`
            : `Promedio ${res.codigo} creado`) +
            (res.codigoLote ? ` · Lote ${res.codigoLote}` : ''),
          'Cerrar',
          { duration: 3500 },
        );
        this.cancelar();
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err?.error?.message;
        this.snackBar.open(
          (Array.isArray(msg) ? msg.join(', ') : msg) ??
            'No se pudo guardar el promedio',
          'Cerrar',
          { duration: 6000 },
        );
        // Si otra persona tomó alguna valorización, refrescar la lista.
        if (err?.status === 400) this.cargar();
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/ui-components/promedios']);
  }

  // ---------- Presentación ----------

  numFmt(n: number | null | undefined): string {
    return n == null ? '—' : String(n);
  }

  private parseFecha(iso: string): Date {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  private formatFecha(fecha: Date | null): string | undefined {
    if (!fecha) return undefined;
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}
