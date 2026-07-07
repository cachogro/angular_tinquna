// src/app/pages/ui-components/panel-users/services/catalogos.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { CatalogoItem } from '../models/catalogos.models';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}`;

  private roles$?: Observable<CatalogoItem[]>;
  private tiposDocumento$?: Observable<CatalogoItem[]>;
  private lugaresEmision$?: Observable<CatalogoItem[]>;

  getRoles(): Observable<CatalogoItem[]> {
    if (!this.roles$) {
      this.roles$ = this.http
        .get<CatalogoItem[]>(`${this.baseUrl}/administrador/roles`)
        .pipe(shareReplay(1));
    }
    return this.roles$;
  }

  getTiposDocumento(): Observable<CatalogoItem[]> {
    if (!this.tiposDocumento$) {
      this.tiposDocumento$ = this.http
        .get<CatalogoItem[]>(`${this.baseUrl}/parametricas/tiposDocumento`)
        .pipe(shareReplay(1));
    }
    return this.tiposDocumento$;
  }

  getLugaresEmision(): Observable<CatalogoItem[]> {
    if (!this.lugaresEmision$) {
      this.lugaresEmision$ = this.http
        .get<CatalogoItem[]>(`${this.baseUrl}/parametricas/lugaresEmision`)
        .pipe(shareReplay(1));
    }
    return this.lugaresEmision$;
  }
}
