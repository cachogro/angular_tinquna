// src/app/pages/contabilidad/pago-valorizacion/pago-valorizacion-dialog/pago-valorizacion-dialog.component.ts
//
// Pago del líquido pagable de una valorización VALORIZADA. No genera recibo:
// el respaldo es el PDF de la valorización firmado por ambas partes.
//  - Lo que se paga (líquido − lo que se deja a kardex) sale de la caja de
//    flujo (efectivo) o de la libreta bancaria, y no se anota en ningún kardex.
//  - "Dejar a kardex" (opcional): HABER en el kardex elegido.
//  - Los anticipos que la valorización ya descontó se cancelan (HABER): el de
//    la recepción, solo, en el kardex donde su recibo lo cargó; los "otros
//    anticipos", en el kardex que se elija acá.
// Con el pago ya registrado el diálogo lo muestra y permite anularlo.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, forkJoin, of } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { FechaInputDirective } from '../../../../shared/directives/fecha-input.directive';
import { MontoInputDirective } from '../../../../shared/directives/monto-input.directive';
import { montoDosDecimales } from '../../../../shared/utils/numero.util';
import {
  DatosPagoFieldsComponent,
  crearFormDatosPago,
  leerDatosPago,
} from '../../components/datos-pago-fields/datos-pago-fields.component';
import { formatFechaIso } from '../../components/personal-interno.util';
import { Kardex, KardexPaginado } from '../../models/kardex.models';
import {
  ConceptoPagoValorizacion,
  DestinoKardexPago,
  KardexDestinoRequest,
  PagoValorizacion,
  PagoValorizacionDetalle,
  PrepararPagoValorizacion,
  RegistrarPagoValorizacionRequest,
} from '../../models/pago-valorizacion.models';
import { KardexService } from '../../services/kardex.service';
import { PagoValorizacionService } from '../../services/pago-valorizacion.service';

export interface PagoValorizacionDialogData {
  idValorizacion: string;
}

/** Kardex ABIERTO elegible: se muestra y se busca por código y nombre. */
interface OpcionKardex {
  destino: DestinoKardexPago;
  /** Id del dueño (persona, actor o cliente), que es lo que pide el back. */
  idDueno: string;
  idKardex: string;
  label: string;
  buscar: string;
}

/** El kardex elegido del autocomplete, o el texto que se está escribiendo. */
type KardexControlValue = OpcionKardex | string | null;

/** Obligatorio y elegido de la lista (un texto suelto no vale). */
function kardexDeLaLista(c: AbstractControl) {
  const v = c.value as KardexControlValue;
  if (!v) return { required: true };
  return typeof v === 'object' ? null : { noSeleccionado: true };
}

@Component({
  selector: 'app-pago-valorizacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    FechaInputDirective,
    MontoInputDirective,
    DatosPagoFieldsComponent,
  ],
  templateUrl: './pago-valorizacion-dialog.component.html',
  styleUrl: './pago-valorizacion-dialog.component.scss',
})
export class PagoValorizacionDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PagoValorizacionDialogComponent>);
  readonly data = inject<PagoValorizacionDialogData>(MAT_DIALOG_DATA);
  private readonly pagoService = inject(PagoValorizacionService);
  private readonly kardexService = inject(KardexService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly prep = signal<PrepararPagoValorizacion | null>(null);
  readonly kardexAbiertos = signal<OpcionKardex[]>([]);
  /** true si se registró o anuló algo: la bandeja debe recargar. */
  private huboCambios = false;

  readonly hoy = new Date();
  readonly fecha = new FormControl<Date | null>(new Date(), [Validators.required]);
  readonly pago = crearFormDatosPago();
  /** Lo que el proveedor deja a kardex de su líquido (opcional). */
  readonly abonos = new FormArray<FormGroup>([]);
  /** Kardex donde se cancelan los "otros anticipos" (solo si los hay). */
  readonly kardexOtros = new FormControl<KardexControlValue>(null, [kardexDeLaLista]);

  get filas(): FormGroup[] {
    return this.abonos.controls;
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    forkJoin({
      prep: this.pagoService.preparar(this.data.idValorizacion),
      // Si falla, el pago igual se puede registrar sin dejar nada a kardex.
      kardex: this.kardexService
        .listar({ estado: 'ABIERTO', limit: 1000 })
        .pipe(catchError(() => of({ data: [] } as unknown as KardexPaginado))),
    }).subscribe({
      next: ({ prep, kardex }) => {
        this.prep.set(prep);
        this.kardexAbiertos.set(
          (kardex.data ?? [])
            .filter((k) => k.activo !== false)
            .map((k) => this.opcionDe(k))
            .filter((o): o is OpcionKardex => !!o),
        );
        this.proponerKardexOtros(prep);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.snackBar.open(
          err?.error?.message ?? 'No se pudo cargar el pago de la valorización',
          'Cerrar',
          { duration: 5000 },
        );
        this.dialogRef.close(this.huboCambios);
      },
    });
  }

  private opcionDe(k: Kardex): OpcionKardex | null {
    let destino: DestinoKardexPago;
    let idDueno: string | null | undefined;
    let nombre: string;
    if (k.tipo === 'ACTOR') {
      destino = 'ACTOR';
      idDueno = k.idActorProductivoMinero ?? k.actorProductivoMinero?.id;
      nombre = `${k.actorProductivoMinero?.nombre ?? 'Actor'} · actor productivo`;
    } else if (k.tipo === 'CLIENTE') {
      destino = 'CLIENTE';
      idDueno = k.idCliente ?? k.cliente?.id;
      nombre = `${k.cliente?.nombre ?? 'Cliente'} · cliente`;
    } else {
      destino = 'PERSONAL';
      idDueno = k.idPersona ?? k.persona?.id;
      const p = k.persona;
      nombre = p
        ? `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
            .trim()
            .replace(/\s+/g, ' ')
        : 'Persona';
    }
    if (!idDueno) return null;
    const label = `${k.codigo} · ${nombre}`;
    return {
      destino,
      idDueno: String(idDueno),
      idKardex: String(k.id),
      label,
      buscar: label.toLowerCase(),
    };
  }

  /** Otros anticipos: se propone el kardex del anticipo o el del proveedor. */
  private proponerKardexOtros(prep: PrepararPagoValorizacion): void {
    if (!(prep.otrosAnticipos > 0) || this.kardexOtros.value) return;
    const lista = this.kardexAbiertos();
    const delAnticipo = prep.anticipoEnKardex[0]?.idKardex;
    const propuesto =
      lista.find((o) => o.idKardex === String(delAnticipo)) ??
      lista.find(
        (o) =>
          (o.destino === 'PERSONAL' &&
            o.idDueno === String(prep.proveedor.idPersona ?? '')) ||
          (o.destino === 'ACTOR' &&
            o.idDueno === String(prep.proveedor.idActorProductivoMinero ?? '')),
      );
    if (propuesto) this.kardexOtros.setValue(propuesto);
  }

  // ---------- Autocomplete de kardex ----------

  displayKardex = (v: KardexControlValue): string => {
    if (!v) return '';
    return typeof v === 'string' ? v : v.label;
  };

  opcionesKardex(control: AbstractControl | null): OpcionKardex[] {
    const v = control?.value as KardexControlValue;
    const texto = (typeof v === 'string' ? v : '').trim().toLowerCase();
    const lista = this.kardexAbiertos();
    return (texto ? lista.filter((o) => o.buscar.includes(texto)) : lista).slice(0, 50);
  }

  // ---------- Abonos a kardex ----------

  agregarAbono(): void {
    this.abonos.push(
      new FormGroup({
        kardex: new FormControl<KardexControlValue>(null, [kardexDeLaLista]),
        monto: new FormControl<string | null>(null, [
          Validators.required,
          montoDosDecimales,
          Validators.min(0.01),
        ]),
      }),
    );
  }

  quitarAbono(i: number): void {
    this.abonos.removeAt(i);
  }

  private redondear(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  sumaAbonos(): number {
    return this.redondear(
      this.filas.reduce((s, f) => {
        const m = Number(f.getRawValue().monto);
        return s + (Number.isFinite(m) && m > 0 ? m : 0);
      }, 0),
    );
  }

  /** Lo que sale de verdad de caja o de la libreta. */
  aPagar(): number {
    return this.redondear((this.prep()?.montoAPagar ?? 0) - this.sumaAbonos());
  }

  excede(): boolean {
    return this.aPagar() < -0.005;
  }

  // ---------- Pago ya registrado ----------

  etiquetaConcepto(c: ConceptoPagoValorizacion): string {
    switch (c) {
      case 'ANTICIPO':
        return 'Descuento de anticipo';
      case 'OTROS_ANTICIPOS':
        return 'Descuento de otros anticipos';
      default:
        return 'Abono a kardex';
    }
  }

  nombreKardex(d: PagoValorizacionDetalle): string {
    const k = d.kardex;
    if (!k) return `Kardex #${d.idKardex}`;
    const p = k.persona;
    const nombre =
      k.actorProductivoMinero?.nombre ??
      k.cliente?.nombre ??
      (p
        ? `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
            .trim()
            .replace(/\s+/g, ' ')
        : '');
    return `${k.codigo} · ${nombre}`;
  }

  origenPago(p: PagoValorizacion): string {
    if (this.num(p.montoPagado) <= 0) return 'No salió dinero: todo quedó en kardex';
    if (p.cuentaBancaria) {
      const banco =
        p.cuentaBancaria.entidadFinanciera?.sigla ||
        p.cuentaBancaria.entidadFinanciera?.nombre ||
        'Banco';
      return `Libreta bancaria · ${banco} ${p.cuentaBancaria.numeroCuenta}`;
    }
    return 'Caja de flujo';
  }

  nombreAutorizo(p: PagoValorizacion): string {
    const a = p.personaAutorizo;
    if (!a) return '—';
    return `${a.nombres} ${a.apellidoPaterno ?? ''} ${a.apellidoMaterno ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  fechaFmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  }

  num(v: string | number | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ---------- Acciones ----------

  cerrar(): void {
    this.dialogRef.close(this.huboCambios);
  }

  private destinoDe(o: OpcionKardex): KardexDestinoRequest {
    switch (o.destino) {
      case 'ACTOR':
        return { destino: 'ACTOR', idActorProductivoMinero: o.idDueno };
      case 'CLIENTE':
        return { destino: 'CLIENTE', idCliente: o.idDueno };
      default:
        return { destino: 'PERSONAL', idPersona: o.idDueno };
    }
  }

  registrar(): void {
    const prep = this.prep();
    if (!prep) return;
    const saleDinero = this.aPagar() > 0;
    const pideOtros = prep.otrosAnticipos > 0;
    // Sin dinero que salga, la forma de pago no hace falta; "Autorizó" sí.
    const pagoInvalido = saleDinero
      ? this.pago.invalid
      : this.pago.controls.idPersonaAutorizo.invalid;

    if (
      this.fecha.invalid ||
      this.abonos.invalid ||
      pagoInvalido ||
      (pideOtros && this.kardexOtros.invalid)
    ) {
      this.fecha.markAsTouched();
      this.abonos.markAllAsTouched();
      this.kardexOtros.markAsTouched();
      if (saleDinero) this.pago.markAllAsTouched();
      else this.pago.controls.idPersonaAutorizo.markAsTouched();
      return;
    }
    if (this.excede()) {
      this.snackBar.open(
        'Lo que se deja a kardex supera el líquido pagable',
        'Cerrar',
        { duration: 4000 },
      );
      return;
    }
    const kardexElegidos = this.filas.map(
      (f) => (f.getRawValue().kardex as OpcionKardex).idKardex,
    );
    if (new Set(kardexElegidos).size !== kardexElegidos.length) {
      this.snackBar.open(
        'Hay dos abonos al mismo kardex: júntalos en una sola línea',
        'Cerrar',
        { duration: 4000 },
      );
      return;
    }

    const request: RegistrarPagoValorizacionRequest = {
      ...(saleDinero
        ? leerDatosPago(this.pago)
        : { idPersonaAutorizo: this.pago.controls.idPersonaAutorizo.value! }),
      idValorizacionMineral: prep.idValorizacionMineral,
      fecha: formatFechaIso(this.fecha.value!),
    };
    if (this.filas.length) {
      request.abonos = this.filas.map((f) => {
        const v = f.getRawValue();
        return { ...this.destinoDe(v.kardex as OpcionKardex), monto: Number(v.monto) };
      });
    }
    if (pideOtros) {
      request.kardexOtrosAnticipos = this.destinoDe(this.kardexOtros.value as OpcionKardex);
    }

    this.guardando.set(true);
    this.pagoService.registrar(request).subscribe({
      next: () => {
        this.guardando.set(false);
        this.huboCambios = true;
        this.snackBar.open('Pago de la valorización registrado', 'Cerrar', {
          duration: 3000,
        });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err?.error?.message;
        this.snackBar.open(
          (Array.isArray(msg) ? msg.join(', ') : msg) ?? 'No se pudo registrar el pago',
          'Cerrar',
          { duration: 6000 },
        );
      },
    });
  }

  anular(pago: PagoValorizacion): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Anular pago',
          message:
            `¿Confirmas anular el pago de la valorización ${this.prep()?.codigoOperacion}? ` +
            'Se da de baja su egreso de caja o de libreta y sus líneas de kardex; la valorización queda sin pagar.',
          confirmLabel: 'Anular pago',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          icon: 'block',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.guardando.set(true);
        this.pagoService.anular(pago.id).subscribe({
          next: () => {
            this.guardando.set(false);
            this.huboCambios = true;
            this.snackBar.open('Pago anulado', 'Cerrar', { duration: 3000 });
            this.cargar();
          },
          error: (err) => {
            this.guardando.set(false);
            this.snackBar.open(
              err?.error?.message ?? 'No se pudo anular el pago',
              'Cerrar',
              { duration: 6000 },
            );
          },
        });
      });
  }
}
