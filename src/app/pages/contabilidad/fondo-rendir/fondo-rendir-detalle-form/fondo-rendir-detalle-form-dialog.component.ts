// src/app/pages/contabilidad/fondo-rendir/fondo-rendir-detalle-form/fondo-rendir-detalle-form-dialog.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DestinoGasto } from '../../../configurations/parametricas/models/parametricas.models';
import { ParametricasService } from '../../../configurations/services/parametricas.service';
import {
  DetalleFondoRendir,
  FondoRendirCuentas,
  GuardarDetalleFondoRendirRequest,
} from '../../models/fondo-rendir.models';
import { FondoRendirService } from '../../services/fondo-rendir.service';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';

export interface FondoRendirDetalleFormDialogData {
  fondo: FondoRendirCuentas;
  detalle?: DetalleFondoRendir | null;
}

@Component({
  selector: 'app-fondo-rendir-detalle-form-dialog',
  standalone: true,
  imports: [
    FechaInputDirective,
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './fondo-rendir-detalle-form-dialog.component.html',
  styleUrl: './fondo-rendir-detalle-form-dialog.component.scss',
})
export class FondoRendirDetalleFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<FondoRendirDetalleFormDialogComponent>,
  );
  readonly data = inject<FondoRendirDetalleFormDialogData>(MAT_DIALOG_DATA);
  private readonly fondoRendirService = inject(FondoRendirService);
  private readonly parametricasService = inject(ParametricasService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly destinosGasto = signal<DestinoGasto[]>([]);

  get esEdicion(): boolean {
    return !!this.data.detalle;
  }

  /** Lo que falta justificar sin contar esta línea. Solo informativo: se
   *  puede justificar de más (el excedente queda como monto por reponer). */
  get saldoDisponible(): number {
    const otras = (this.data.fondo.detalles ?? [])
      .filter((d) => d.activo !== false && d.id !== this.data.detalle?.id)
      .reduce((acc, d) => acc + Number(d.monto), 0);
    return Number(this.data.fondo.montoEntregado) - otras;
  }

  /** Excedente que quedaría por reponer al destinatario con el monto cargado. */
  get excedente(): number {
    const monto = Number(this.f.monto.value) || 0;
    return Math.max(0, monto - Math.max(0, this.saldoDisponible));
  }

  readonly form = new FormGroup({
    fecha: new FormControl<Date | null>(null, [Validators.required]),
    concepto: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    monto: new FormControl<number | null>(null, [
      Validators.required,
      montoDosDecimales,
      Validators.min(0.01),
    ]),
    nroComprobante: new FormControl('', [Validators.maxLength(30)]),
    facturaRecibo: new FormControl('', [Validators.maxLength(30)]),
    idDestinoGasto: new FormControl<number | null>(null),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.f.concepto.valueChanges.subscribe((v) => {
      if (typeof v !== 'string') return;
      const up = v.toUpperCase();
      if (up !== v) this.f.concepto.setValue(up, { emitEvent: false });
    });

    this.parametricasService.obtenerDestinosGasto().subscribe({
      next: (destinosGasto) => {
        this.destinosGasto.set(destinosGasto.filter((d) => d.activo !== false));
        this.cargandoCatalogos.set(false);
        this.precargarSiEdicion();
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.snackBar.open('No se pudieron cargar los catálogos', 'Cerrar', {
          duration: 4000,
        });
        this.precargarSiEdicion();
      },
    });
  }

  private precargarSiEdicion(): void {
    const d = this.data.detalle;
    if (!d) return;
    this.form.patchValue({
      fecha: this.parseFecha(d.fecha),
      concepto: d.concepto,
      monto: Number(d.monto),
      nroComprobante: d.nroComprobante ?? '',
      facturaRecibo: d.facturaRecibo ?? '',
      idDestinoGasto: d.idDestinoGasto ?? null,
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();

    const request: GuardarDetalleFondoRendirRequest = {
      ...(this.data.detalle ? { id: this.data.detalle.id } : {}),
      idFondoRendir: this.data.fondo.id,
      fecha: this.formatFecha(v.fecha!),
      concepto: v.concepto!.trim(),
      monto: Number(v.monto),
    };
    const nroComprobante = (v.nroComprobante ?? '').trim();
    if (nroComprobante) request.nroComprobante = nroComprobante;
    const facturaRecibo = (v.facturaRecibo ?? '').trim();
    if (facturaRecibo) request.facturaRecibo = facturaRecibo;
    if (v.idDestinoGasto != null) request.idDestinoGasto = v.idDestinoGasto;

    this.fondoRendirService.guardarDetalle(request).subscribe({
      next: (fondo) => {
        this.guardando.set(false);
        this.snackBar.open(
          this.esEdicion ? 'Comprobante actualizado' : 'Comprobante agregado',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(fondo);
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo guardar el comprobante',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
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
