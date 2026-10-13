// src/app/pages/contabilidad/cheques/chequeras-dialog/chequeras-dialog.component.ts
// Chequeras de una cuenta bancaria: talonarios que entregó el banco (con
// cuántos cheques le quedan a cada uno) y los cheques ya usados, para
// marcarlos como cobrados, revalidarlos o anular uno que no se usó.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, forkJoin } from 'rxjs';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import {
  Cheque,
  DIAS_COBRO_CHEQUE,
  EstadoCheque,
  TalonarioCheque,
} from '../../models/cheque.models';
import { ChequeService } from '../../services/cheque.service';

export interface ChequerasDialogData {
  idCuentaBancaria: number;
  /** Texto para el título, ej. "BANCO UNIÓN · 1000002925 (Bs)". */
  etiqueta: string;
}

type FiltroEstado = EstadoCheque | 'TODOS';

@Component({
  selector: 'app-chequeras-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './chequeras-dialog.component.html',
  styleUrl: './chequeras-dialog.component.scss',
})
export class ChequerasDialogComponent implements OnInit {
  readonly data = inject<ChequerasDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly chequeService = inject(ChequeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly diasCobro = DIAS_COBRO_CHEQUE;
  readonly hoy = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly talonarios = signal<TalonarioCheque[]>([]);
  readonly cheques = signal<Cheque[]>([]);

  readonly filtroEstado = signal<FiltroEstado>('TODOS');
  readonly chequesFiltrados = computed(() => {
    const estado = this.filtroEstado();
    return estado === 'TODOS'
      ? this.cheques()
      : this.cheques().filter((c) => c.estado === estado);
  });

  /** Talonarios activos, del más antiguo al más nuevo (orden en que se usan). */
  private readonly activos = computed(() =>
    this.talonarios()
      .filter((t) => t.activo)
      .sort(
        (a, b) => a.fechaRecepcion.localeCompare(b.fechaRecepcion) || a.id - b.id,
      ),
  );
  readonly disponibles = computed(() =>
    this.activos().reduce((suma, t) => suma + t.disponibles, 0),
  );
  readonly siguiente = computed(
    () => this.activos().find((t) => t.disponibles > 0) ?? null,
  );
  readonly sinCobrar = computed(
    () => this.cheques().filter((c) => c.estado === 'EMITIDO').length,
  );
  readonly vencidos = computed(() => this.cheques().filter((c) => c.vencido).length);

  /** Fecha que se usa al marcar un cheque como cobrado. */
  fechaCobro = this.hoy;

  // ---------- formulario de talonario ----------
  talonarioEditando: TalonarioCheque | null = null;
  mostrarFormTalonario = false;

  readonly talonarioForm = this.fb.group({
    serie: ['', [Validators.maxLength(20)]],
    numeroInicial: [null as number | null, [Validators.required, Validators.min(1)]],
    numeroFinal: [null as number | null, [Validators.required, Validators.min(1)]],
    fechaRecepcion: [this.hoy, [Validators.required]],
    fechaVencimiento: [''],
    observacion: ['', [Validators.maxLength(255)]],
  });

  /** Cantidad de cheques del rango que se está cargando. */
  get cantidadRango(): number | null {
    const { numeroInicial, numeroFinal } = this.talonarioForm.getRawValue();
    if (!numeroInicial || !numeroFinal || numeroFinal < numeroInicial) return null;
    return numeroFinal - numeroInicial + 1;
  }

  // ---------- anular un cheque sin usar ----------
  mostrarFormAnular = false;
  readonly anularForm = this.fb.group({
    idTalonarioCheque: [null as number | null, [Validators.required]],
    numero: [null as number | null, [Validators.required, Validators.min(1)]],
    motivo: ['', [Validators.required, Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.recargar();
  }

  recargar(): void {
    const id = this.data.idCuentaBancaria;
    forkJoin({
      talonarios: this.chequeService.listarTalonarios(id),
      cheques: this.chequeService.listarCheques({ idCuentaBancaria: id }),
    }).subscribe({
      next: ({ talonarios, cheques }) => {
        this.talonarios.set(talonarios);
        this.cheques.set(cheques);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.avisar(err, 'No se pudieron cargar las chequeras');
      },
    });
  }

  // ---------- talonarios ----------

  nuevoTalonario(): void {
    this.talonarioEditando = null;
    this.talonarioForm.reset({ serie: '', fechaRecepcion: this.hoy, fechaVencimiento: '', observacion: '' });
    this.mostrarFormTalonario = true;
  }

  editarTalonario(t: TalonarioCheque): void {
    this.talonarioEditando = t;
    this.talonarioForm.reset({
      serie: t.serie ?? '',
      numeroInicial: t.numeroInicial,
      numeroFinal: t.numeroFinal,
      fechaRecepcion: t.fechaRecepcion,
      fechaVencimiento: t.fechaVencimiento ?? '',
      observacion: t.observacion ?? '',
    });
    this.mostrarFormTalonario = true;
  }

  cancelarTalonario(): void {
    this.mostrarFormTalonario = false;
    this.talonarioEditando = null;
  }

  guardarTalonario(): void {
    if (this.talonarioForm.invalid) {
      this.talonarioForm.markAllAsTouched();
      return;
    }
    const v = this.talonarioForm.getRawValue();
    if (this.cantidadRango === null) {
      this.snackBar.open(
        'El número final no puede ser menor al número inicial',
        'Cerrar',
        { duration: 4000 },
      );
      return;
    }
    this.ejecutar(
      this.chequeService.guardarTalonario({
        ...(this.talonarioEditando ? { id: this.talonarioEditando.id } : {}),
        idCuentaBancaria: this.data.idCuentaBancaria,
        ...(v.serie?.trim() ? { serie: v.serie.trim() } : {}),
        numeroInicial: Number(v.numeroInicial),
        numeroFinal: Number(v.numeroFinal),
        fechaRecepcion: v.fechaRecepcion!,
        ...(v.fechaVencimiento ? { fechaVencimiento: v.fechaVencimiento } : {}),
        ...(v.observacion?.trim() ? { observacion: v.observacion.trim() } : {}),
      }),
      this.talonarioEditando
        ? 'Talonario actualizado correctamente'
        : 'Talonario registrado correctamente',
      () => this.cancelarTalonario(),
    );
  }

  cambiarEstadoTalonario(t: TalonarioCheque): void {
    const accion = t.activo ? 'Desactivar' : 'Activar';
    this.confirmar(
      `${accion} talonario`,
      t.activo
        ? `El talonario ${this.rango(t)} dejará de ofrecer sus ${t.disponibles} cheques sin usar. ¿Confirmas?`
        : `¿Confirmas activar el talonario ${this.rango(t)}?`,
      accion,
      t.activo ? 'toggle_off' : 'toggle_on',
      () =>
        this.ejecutar(
          this.chequeService.cambiarEstadoTalonario(t.id, !t.activo),
          `Talonario ${t.activo ? 'desactivado' : 'activado'} correctamente`,
        ),
    );
  }

  // ---------- cheques ----------

  cobrar(c: Cheque): void {
    if (!this.fechaCobro) {
      this.snackBar.open('Indica la fecha de cobro', 'Cerrar', { duration: 3000 });
      return;
    }
    this.ejecutar(
      this.chequeService.cobrar(c.id, this.fechaCobro),
      `Cheque N° ${c.numero} marcado como cobrado`,
    );
  }

  deshacerCobro(c: Cheque): void {
    this.ejecutar(
      this.chequeService.deshacerCobro(c.id),
      `El cheque N° ${c.numero} volvió a emitido`,
    );
  }

  revalidar(c: Cheque): void {
    this.confirmar(
      'Revalidar cheque',
      `El cheque N° ${c.numero} tendrá ${this.diasCobro} días más para cobrarse, contados desde hoy. ¿Confirmas?`,
      'Revalidar',
      'update',
      () =>
        this.ejecutar(
          this.chequeService.revalidar(c.id),
          `Cheque N° ${c.numero} revalidado`,
        ),
    );
  }

  abrirAnular(): void {
    const t = this.siguiente();
    this.anularForm.reset({
      idTalonarioCheque: t?.id ?? null,
      numero: t?.siguienteNumero ?? null,
      motivo: '',
    });
    this.mostrarFormAnular = true;
  }

  anular(): void {
    if (this.anularForm.invalid) {
      this.anularForm.markAllAsTouched();
      return;
    }
    const v = this.anularForm.getRawValue();
    this.confirmar(
      'Anular cheque',
      `El cheque N° ${v.numero} quedará anulado y no se podrá usar. ¿Confirmas?`,
      'Anular',
      'block',
      () =>
        this.ejecutar(
          this.chequeService.anularEnBlanco({
            idTalonarioCheque: Number(v.idTalonarioCheque),
            numero: Number(v.numero),
            motivo: v.motivo!.trim(),
          }),
          `Cheque N° ${v.numero} anulado`,
          () => (this.mostrarFormAnular = false),
        ),
    );
  }

  // ---------- presentación ----------

  rango(t: TalonarioCheque): string {
    const serie = t.serie ? `${t.serie} ` : '';
    return `${serie}${t.numeroInicial} – ${t.numeroFinal}`;
  }

  fecha(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }

  /** "vence en 3 días", "vence hoy", "venció hace 14 días". */
  plazo(c: Cheque): string {
    const dias = c.diasParaVencer;
    if (dias === null) return '';
    if (dias < 0) return `venció hace ${-dias} día${dias === -1 ? '' : 's'}`;
    if (dias === 0) return 'vence hoy';
    return `vence en ${dias} día${dias === 1 ? '' : 's'}`;
  }

  /** Talonario con fecha de vencimiento ya pasada. */
  talonarioVencido(t: TalonarioCheque): boolean {
    return !!t.fechaVencimiento && t.fechaVencimiento < this.hoy;
  }

  // ---------- helpers ----------

  private ejecutar<T>(peticion: Observable<T>, mensaje: string, alTerminar?: () => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    peticion.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
        alTerminar?.();
        this.recargar();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.avisar(err, 'No se pudo completar la operación');
      },
    });
  }

  private confirmar(
    title: string,
    message: string,
    confirmLabel: string,
    icon: string,
    alConfirmar: () => void,
  ): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: { title, message, confirmLabel, cancelLabel: 'Cancelar', tone: 'default', icon },
      })
      .afterClosed()
      .subscribe((confirmado: boolean) => {
        if (confirmado) alConfirmar();
      });
  }

  private avisar(err: any, porDefecto: string): void {
    const msg = err?.error?.message;
    this.snackBar.open(
      (Array.isArray(msg) ? msg.join(' · ') : msg) ?? porDefecto,
      'Cerrar',
      { duration: 6000 },
    );
  }
}
