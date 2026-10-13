// src/app/pages/configurations/services/roles-permisos.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  GuardarPermisosRolRequest,
  MatrizPermisos,
} from '../roles-permisos/models/roles-permisos.models';

@Injectable({ providedIn: 'root' })
export class RolesPermisosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${APP_CONFIG.apiUrl}/administrador/roles_permisos`;

  obtenerMatriz(): Observable<MatrizPermisos> {
    return this.http.get<MatrizPermisos>(this.url);
  }

  /** Reemplaza los permisos del rol y devuelve la matriz actualizada. */
  guardarPermisosRol(data: GuardarPermisosRolRequest): Observable<MatrizPermisos> {
    return this.http.post<MatrizPermisos>(this.url, data);
  }
}
