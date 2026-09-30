import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { ActoresProductivosComponent } from '../actores-productivos/actores-productivos.component';
import { ClientesCompradoresComponent } from '../clientes-compradores/clientes-compradores.component';
import { GestionClientesComponent } from '../gestion-clientes/gestion-clientes.component';
import { PersonalInternoComponent } from '../personal-interno/personal-interno.component';

/**
 * Contenedor que junta en un solo lugar los Actores Productivos Mineros (antes
 * dentro de Paramétricas), las Personas/Clientes vinculadas a ellos, el
 * personal exclusivo de la propia empresa (TINKURIKUNA) y los Clientes
 * (compradores del mineral). Cada pestaña muestra su bandeja directamente.
 * La evolución prevista es un maestro–detalle donde el kardex cuelga de
 * cada actor.
 */
@Component({
  selector: 'app-actores-clientes',
  standalone: true,
  imports: [
    MatTabsModule,
    MatCardModule,
    ActoresProductivosComponent,
    GestionClientesComponent,
    ClientesCompradoresComponent,
    PersonalInternoComponent,
  ],
  templateUrl: './actores-clientes.component.html',
  styleUrl: './actores-clientes.component.scss',
})
export class ActoresClientesComponent {}
