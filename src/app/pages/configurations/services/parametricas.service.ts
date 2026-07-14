import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { ActualizarCodificacionRequest, Codificacion, CrearCodificacionRequest, Mineral } from '../parametricas/models/parametricas.models';



@Injectable({ providedIn: 'root' })
export class ParametricasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/parametricas`;

  // Estado reactivo: la tabla lee esto y se refresca sola cuando cambia,
  // sin que el modal necesite conocer a la tabla ni viceversa.
  readonly codificaciones = signal<Codificacion[]>([]);
  readonly cargandoCodificaciones = signal<boolean>(false);

  crearCodificacion(data: CrearCodificacionRequest): Observable<Codificacion> {
    return this.http
      .post<Codificacion>(`${this.baseUrl}/codificacion`, data)
      .pipe(tap(() => this.cargarCodificaciones()));
  }

  actualizarCodificacion(
    data: ActualizarCodificacionRequest,
  ): Observable<Codificacion> {
    return this.http
      .put<Codificacion>(`${this.baseUrl}/codificacion`, data)
      .pipe(tap(() => this.cargarCodificaciones()));
  }

  obtenerMinerales(): Observable<Mineral[]> {
    return this.http.get<Mineral[]>(`${this.baseUrl}/allMinerales`);
  }

  obtenerCodificaciones(): Observable<Codificacion[]> {
    return this.http.get<Codificacion[]>(`${this.baseUrl}/allCodificacion`);
  }

  /** Carga las codificaciones y actualiza el signal para que la tabla se refresque */
  cargarCodificaciones(): void {
    this.cargandoCodificaciones.set(true);
    this.obtenerCodificaciones().subscribe({
      next: (data) => {
        this.codificaciones.set(data);
        this.cargandoCodificaciones.set(false);
      },
      error: () => {
        this.cargandoCodificaciones.set(false);
      },
    });
  }

  // A futuro: obtenerLeyes(), crearLey(), actualizarLey(), etc.
  // Si el archivo empieza a crecer mucho, considera mover cada recurso
  // a su propio servicio (leyes.service.ts, ingenios.service.ts), pero
  // el patrón de signal + tap(() => cargar...()) se mantiene igual.
}