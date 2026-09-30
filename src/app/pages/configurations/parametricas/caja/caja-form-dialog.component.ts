// src/app/pages/configurations/parametricas/caja/caja-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

import { ParametricaDialogShellComponent } from '../shared/parametrica-dialog-shell.component';
import { Caja } from '../models/parametricas.models';
import { ParametricasService } from '../../services/parametricas.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

/** Mayúsculas, letras (con acentos/ñ), números, espacios y . - */
const CHARSET_NOMBRE = /^[A-ZÁÉÍÓÚÑÜ0-9 .\-]*$/;
const CARACTERES_INVALIDOS_NOMBRE = /[^A-ZÁÉÍÓÚÑÜ0-9 .\-]/g;

@Component({
  selector: 'app-caja-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
    MatDatepickerModule,
    ParametricaDialogShellComponent,
  ],
  templateUrl: './caja-form-dialog.component.html',
  styleUrl: './caja-form-dialog.component.scss',
})
export class CajaFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<CajaFormDialogComponent>);

  guardando = false;
  columnas = [
    'id',
    'nombre',
    'saldoBs',
    'saldoUsd',
    'estado',
    'acciones',
  ];

  // Estado propio del componente: permite pasar de "nueva" a "edición"
  // sin depender de datos inyectados en el modal.
  cajaEditando: Caja | null = null;

  get modoEdicion(): boolean {
    return !!this.cajaEditando;
  }

  form: FormGroup = this.fb.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(CHARSET_NOMBRE),
      ],
    ],
    saldoInicialBs: [0, [montoDosDecimales, Validators.min(0)]],
    fechaSaldoInicialBs: [null as Date | null],
    saldoInicialUsd: [0, [montoDosDecimales, Validators.min(0)]],
    fechaSaldoInicialUsd: [null as Date | null],
  });

  ngOnInit(): void {
    this.recargarTabla();

    this.registrarSaneador(this.form.get('nombre')!, (v) => this.saneaNombre(v));
  }

  private saneaNombre(valor: string): string {
    return valor.toUpperCase().replace(CARACTERES_INVALIDOS_NOMBRE, '');
  }

  private registrarSaneador(
    control: AbstractControl,
    sanea: (valor: string) => string,
  ): void {
    control.valueChanges.subscribe((valor) => {
      if (typeof valor !== 'string') return;
      const limpio = sanea(valor);
      if (limpio !== valor) {
        control.setValue(limpio, { emitEvent: false });
      }
    });
  }

  private recargarTabla(): void {
    // Máximo unas pocas cajas esperadas: se listan todas sin paginación.
    this.parametricasService.cargarCajas();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre } = this.form.getRawValue();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.modoEdicion ? 'Actualizar caja' : 'Crear caja',
        message: this.modoEdicion
          ? `¿Confirmas actualizar "${nombre}"?`
          : `¿Confirmas crear "${nombre}"?`,
        confirmLabel: this.modoEdicion ? 'Actualizar' : 'Crear',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: this.modoEdicion ? 'edit' : 'add_circle_outline',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.persistir();
      }
    });
  }

  private persistir(): void {
    this.guardando = true;
    const v = this.form.getRawValue();

    // Un solo POST: si hay caja en edición, se manda su id y el back
    // actualiza; si no, la crea.
    this.parametricasService
      .guardarCaja({
        id: this.cajaEditando?.id,
        nombre: v.nombre,
        saldoInicialBs: Number(v.saldoInicialBs ?? 0),
        ...(v.fechaSaldoInicialBs
          ? { fechaSaldoInicialBs: this.formatFecha(v.fechaSaldoInicialBs) }
          : {}),
        saldoInicialUsd: Number(v.saldoInicialUsd ?? 0),
        ...(v.fechaSaldoInicialUsd
          ? { fechaSaldoInicialUsd: this.formatFecha(v.fechaSaldoInicialUsd) }
          : {}),
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.modoEdicion
              ? 'Caja actualizada correctamente'
              : 'Caja creada correctamente',
            'Cerrar',
            { duration: 3000 },
          );
          this.guardando = false;
          // No cerramos el modal: la tabla vive adentro, solo limpiamos
          // el formulario para dejarlo listo para un nuevo registro.
          this.limpiar();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message ?? 'Ocurrió un error al guardar',
            'Cerrar',
            { duration: 4000 },
          );
          this.guardando = false;
        },
      });
  }

  /** Pone el formulario en modo edición con los datos de la fila seleccionada */
  editar(caja: Caja): void {
    this.cajaEditando = caja;
    this.form.patchValue({
      nombre: caja.nombre,
      saldoInicialBs: Number(caja.saldoInicialBs ?? 0),
      fechaSaldoInicialBs: this.parseFecha(caja.fechaSaldoInicialBs),
      saldoInicialUsd: Number(caja.saldoInicialUsd ?? 0),
      fechaSaldoInicialUsd: this.parseFecha(caja.fechaSaldoInicialUsd),
    });
  }

  /** Limpia el formulario y sale del modo edición, sin cerrar el modal */
  limpiar(): void {
    this.form.reset({
      nombre: '',
      saldoInicialBs: 0,
      fechaSaldoInicialBs: null,
      saldoInicialUsd: 0,
      fechaSaldoInicialUsd: null,
    });
    this.cajaEditando = null;
  }

  cancelar(): void {
    this.limpiar();
  }

  /** Activa o desactiva una caja, con confirmación previa */
  cambiarEstado(caja: Caja): void {
    const accion = caja.activo ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: caja.activo ? 'Desactivar' : 'Activar',
        message: `¿Confirmas ${accion} "${caja.nombre}"?`,
        confirmLabel: caja.activo ? 'Desactivar' : 'Activar',
        cancelLabel: 'Cancelar',
        tone: 'default',
        icon: caja.activo ? 'toggle_off' : 'toggle_on',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;
      this.parametricasService
        .cambiarEstadoCaja(caja.id, !caja.activo)
        .subscribe({
          next: () =>
            this.snackBar.open(
              `${caja.activo ? 'Desactivada' : 'Activada'} correctamente`,
              'Cerrar',
              { duration: 3000 },
            ),
          error: (err) =>
            this.snackBar.open(
              err?.error?.message ?? 'Ocurrió un error al cambiar el estado',
              'Cerrar',
              { duration: 4000 },
            ),
        });
    });
  }

  get cajas(): Caja[] {
    return [...this.parametricasService.cajas()].sort(
      (a, b) => b.id - a.id,
    );
  }

  get cargando(): boolean {
    return this.parametricasService.cargandoCajas();
  }

  num(v: string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  private formatFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private parseFecha(valor?: string | null): Date | null {
    if (!valor) return null;
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    return new Date(anio, mes - 1, dia);
  }
}
