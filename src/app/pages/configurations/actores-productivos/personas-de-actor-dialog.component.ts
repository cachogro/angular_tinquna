import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ActorProductivoMinero as ActorPersonaModel,
  PersonaCI,
} from '../models/persona.models';
import { PersonaService } from '../services/persona.service';
import {
  PersonaFormDialogComponent,
  PersonaFormDialogData,
} from '../gestion-clientes/persona-form-dialog/persona-form-dialog.component';
import { ActorProductivoMinero } from '../parametricas/models/parametricas.models';

export interface PersonasDeActorDialogData {
  actor: ActorProductivoMinero;
}

/**
 * Lista las personas vinculadas a un actor productivo minero y permite
 * editarlas o agregar una nueva ya asociada a él. Reutiliza
 * `PersonaFormDialogComponent` para el alta/edición.
 */
@Component({
  selector: 'app-personas-de-actor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './personas-de-actor-dialog.component.html',
  styleUrl: './personas-de-actor-dialog.component.scss',
})
export class PersonasDeActorDialogComponent implements OnInit {
  private readonly personaService = inject(PersonaService);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<PersonasDeActorDialogData>(MAT_DIALOG_DATA);

  readonly displayedColumns = [
    'id',
    'persona',
    'documento',
    'tipos',
    'estado',
    'acciones',
  ];

  readonly personas = signal<PersonaCI[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    // El back no acepta filtrar personas por actor, así que traemos la lista
    // y filtramos por el actor en el cliente (el volumen es chico).
    const idActor = String(this.data.actor.id);
    this.personaService.listarPersonas({ page: 1, limit: 100 }).subscribe({
      next: (res) => {
        this.personas.set(
          res.data.filter(
            (p) =>
              String(
                p.actorProductivoMinero?.id ?? p.idActorProductivoMinero ?? '',
              ) === idActor,
          ),
        );
        this.loading.set(false);
      },
      error: () => {
        this.personas.set([]);
        this.loading.set(false);
      },
    });
  }

  nombreCompleto(p: PersonaCI): string {
    return `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim();
  }

  editarPersona(persona: PersonaCI): void {
    const dialogData: PersonaFormDialogData = { persona };
    this.dialog
      .open(PersonaFormDialogComponent, {
        data: dialogData,
        width: '820px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) this.cargar();
      });
  }

  agregarPersona(): void {
    const actorParaForm: ActorPersonaModel = {
      id: String(this.data.actor.id),
      idTipoActorProductivoMinero: String(
        this.data.actor.idTipoActorProductivoMinero,
      ),
      nombre: this.data.actor.nombre,
      direccion: this.data.actor.direccion,
      telefono: this.data.actor.telefono,
    };
    const dialogData: PersonaFormDialogData = {
      persona: null,
      actorPreseleccionado: actorParaForm,
    };
    this.dialog
      .open(PersonaFormDialogComponent, {
        data: dialogData,
        width: '820px',
        maxWidth: '95vw',
        // Sin esto, el dialog autofocusea el campo de actor y su
        // (focus)="openPanel()" abre la lista completa de inmediato,
        // tapando visualmente el actor ya preseleccionado.
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado) this.cargar();
      });
  }
}
