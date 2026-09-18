import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { ParametricasComercioInternoComponent } from './comercio-interno/parametricas-comercio-interno.component';
import { ParametricasContabilidadComponent } from './contabilidad/parametricas-contabilidad.component';

/**
 * Contenedor que junta, en pestañas, las paramétricas de Comercio Interno
 * (cotización, mineral, escala de precio, etc.) y las de Contabilidad
 * (entidad financiera, caja), siguiendo el mismo patrón que Actores y Clientes.
 */
@Component({
  selector: 'app-parametricas',
  standalone: true,
  imports: [
    MatTabsModule,
    MatCardModule,
    ParametricasComercioInternoComponent,
    ParametricasContabilidadComponent,
  ],
  templateUrl: './parametricas.component.html',
  styleUrl: './parametricas.component.scss',
})
export class ParametricasComponent {}
