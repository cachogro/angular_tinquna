import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { PersonaCI, PersonaTipoCatalogo } from '../models/persona.models';
import { PersonaService } from '../services/persona.service';
import {
  PersonaFormDialogComponent,
  PersonaFormDialogData,
} from './persona-form-dialog/persona-form-dialog.component';

@Component({
  selector: 'app-gestion-clientes',
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatButtonModule,
    MatCardModule,
    CommonModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './gestion-clientes.component.html',
  styleUrl: './gestion-clientes.component.scss',
})
export class GestionClientesComponent implements OnInit {
  private readonly personaService = inject(PersonaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'id',
    'persona',
    'documento',
    'tipos',
    'estado',
    'acciones',
  ];

  readonly personas = signal<PersonaCI[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly tiposPersona = signal<PersonaTipoCatalogo[]>([]);

  pageIndex = 0;
  pageSize = 10;

  readonly searchControl = new FormControl('');
  readonly documentoControl = new FormControl('');
  readonly tipoControl = new FormControl<number | null>(null);
  readonly estadoControl = new FormControl<string | null>(null); // 'true' | 'false' | null

  ngOnInit(): void {
    this.personaService.getAllPersonaTipo().subscribe({
      next: (tipos) => this.tiposPersona.set(tipos),
      error: () => this.tiposPersona.set([]),
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.documentoControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reiniciarYcargar());

    this.tipoControl.valueChanges.subscribe(() => this.reiniciarYcargar());
    this.estadoControl.valueChanges.subscribe(() => this.reiniciarYcargar());

    this.cargarPersonas();
  }

  private reiniciarYcargar(): void {
    this.pageIndex = 0;
    this.cargarPersonas();
  }

  cargarPersonas(): void {
    this.loading.set(true);
    const estado = this.estadoControl.value;

    this.personaService
      .listarPersonas({
        page: this.pageIndex + 1,
        limit: this.pageSize,
        busqueda: this.searchControl.value || undefined,
        numeroDocumento: this.documentoControl.value || undefined,
        idTipoPersona: this.tipoControl.value ?? undefined,
        activo: estado === null ? undefined : estado === 'true',
      })
      .subscribe({
        next: (res) => {
          this.personas.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(
            'No se pudo cargar el listado de personas',
            'Cerrar',
            {
              duration: 4000,
            },
          );
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarPersonas();
  }

  limpiarFiltros(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.documentoControl.setValue('', { emitEvent: false });
    this.tipoControl.setValue(null, { emitEvent: false });
    this.estadoControl.setValue(null, { emitEvent: false });
    this.reiniciarYcargar();
  }

  nombreCompleto(persona: PersonaCI): string {
    return `${persona.nombres} ${persona.apellidoPaterno} ${persona.apellidoMaterno}`.trim();
  }

  abrirDialogo(persona: PersonaCI | null): void {
    const data: PersonaFormDialogData = { persona };

    this.dialog
      .open(PersonaFormDialogComponent, { data, width: '600px' })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) {
          this.cargarPersonas();
        }
      });
  }

  confirmarCambioEstado(persona: PersonaCI): void {
    const activar = !persona.activo;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: activar ? 'Activar persona' : 'Desactivar persona',
          message: activar
            ? `¿Deseas activar a ${this.nombreCompleto(persona)}?`
            : `¿Deseas desactivar a ${this.nombreCompleto(persona)}? No aparecerá disponible para nuevas operaciones.`,
          confirmLabel: activar ? 'Sí, activar' : 'Sí, desactivar',
          tone: activar ? 'default' : 'danger',
          icon: activar ? 'check_circle_outline' : 'block',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;

        this.personaService.cambiarEstado(persona.id, activar).subscribe({
          next: (actualizada) => {
            this.personas.update((lista) =>
              lista.map((p) => (p.id === persona.id ? actualizada : p)),
            );
            this.snackBar.open(
              activar
                ? 'Persona activada correctamente'
                : 'Persona desactivada correctamente',
              'Cerrar',
              { duration: 3000 },
            );
          },
          error: () => {
            this.snackBar.open('No se pudo cambiar el estado', 'Cerrar', {
              duration: 4000,
            });
          },
        });
      });
  }
}
