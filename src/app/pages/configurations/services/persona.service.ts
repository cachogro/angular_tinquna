// src/app/pages/configurations/services/persona.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  FiltrosPersona,
  GuardarPersonaRequest,
  PersonaCI,
  PersonaTipoCatalogo,
  PersonasPaginadas,
  TipoDocumentoCatalogo,
} from '../models/persona.models';

@Injectable({ providedIn: 'root' })
export class PersonaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/comercio_interno`;
  private readonly parametricasUrl = `${APP_CONFIG.apiUrl}/parametricas`;

  private personaTipos$?: Observable<PersonaTipoCatalogo[]>;
  private tiposDocumento$?: Observable<TipoDocumentoCatalogo[]>;

  /** Sin `id` en el request -> crea. Con `id` -> actualiza (solo los campos enviados). */
  guardarPersona(data: GuardarPersonaRequest): Observable<PersonaCI> {
    return this.http.post<PersonaCI>(`${this.baseUrl}/persona_ci`, data);
  }

  // listarPersonas(filtros: FiltrosPersona): Observable<PersonasPaginadas> {
  //   let params = new HttpParams()
  //     .set('page', filtros.page)
  //     .set('limit', filtros.limit);
  //   if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
  //   if (filtros.numeroDocumento)
  //     params = params.set('numeroDocumento', filtros.numeroDocumento);
  //   if (filtros.idTipoPersona)
  //     params = params.set('idTipoPersona', filtros.idTipoPersona);
  //   if (filtros.activo !== undefined)
  //     params = params.set('activo', filtros.activo);


  //   console.log(params);

  //   const ruta = this.http.get<PersonasPaginadas>(`${this.baseUrl}/persona_ci`, {
  //     params,
  //   });

  //     console.log('esta es la rutaaaa', ruta)
  //   return ruta
  // }


  listarPersonas(filtros: FiltrosPersona): Observable<PersonasPaginadas> {
  let params = new HttpParams()
    .set('page', filtros.page)
    .set('limit', filtros.limit);
  if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
  if (filtros.numeroDocumento)
    params = params.set('numeroDocumento', filtros.numeroDocumento);
  if (filtros.idTipoPersona)
    params = params.set('idTipoPersona', filtros.idTipoPersona);
  if (filtros.activo !== undefined)
    params = params.set('activo', filtros.activo);

  const urlCompleta = `${this.baseUrl}/persona_ci?${params.toString()}`;
  console.log('URL enviada:', urlCompleta);

  return this.http.get<PersonasPaginadas>(`${this.baseUrl}/persona_ci`, {
    params,
  });
}



  cambiarEstado(id: string, activo: boolean): Observable<PersonaCI> {
    return this.http.patch<PersonaCI>(
      `${this.baseUrl}/persona_ci/cambiar_estado_persona/${id}`,
      {
        activo,
      },
    );
  }

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  getAllPersonaTipo(): Observable<PersonaTipoCatalogo[]> {
    if (!this.personaTipos$) {
      this.personaTipos$ = this.http
        .get<PersonaTipoCatalogo[]>(`${this.parametricasUrl}/allPersonaTipo`)
        .pipe(shareReplay(1));
    }
    return this.personaTipos$;
  }

  /** Catálogo cacheado — no se vuelve a pedir tras la primera carga */
  getAllTiposDocumento(): Observable<TipoDocumentoCatalogo[]> {
    if (!this.tiposDocumento$) {
      this.tiposDocumento$ = this.http
        .get<TipoDocumentoCatalogo[]>(`${this.parametricasUrl}/tiposDocumento`)
        .pipe(shareReplay(1));
    }
    return this.tiposDocumento$;
  }
}
