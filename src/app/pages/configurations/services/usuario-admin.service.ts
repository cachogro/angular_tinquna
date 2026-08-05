// src/app/pages/ui-components/panel-users/services/usuario-admin.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import {
  ActualizarUsuarioRequest,
  FiltrosListadoUsuarios,
  RegistrarUsuarioRequest,
  UsuarioAdmin,
  UsuariosPaginados,
} from '../gestion-usuarios/models/usuario-admin.models';

@Injectable({ providedIn: 'root' })
export class UsuarioAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/administrador`;

  registrarUsuario(data: RegistrarUsuarioRequest): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(
      `${this.baseUrl}/registrar_usuario`,
      data,
    );
  }

  actualizarUsuario(
    id: string,
    data: ActualizarUsuarioRequest,
  ): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(
      `${this.baseUrl}/actualizar_usuario/${id}`,
      data,
    );
  }

  obtenerUsuario(id: string): Observable<UsuarioAdmin> {
    return this.http.get<UsuarioAdmin>(`${this.baseUrl}/usuarioby_id/${id}`);
  }

  listarUsuarios(
    filtros: FiltrosListadoUsuarios,
  ): Observable<UsuariosPaginados> {
    let params = new HttpParams()
      .set('page', filtros.page)
      .set('limit', filtros.limit);

    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros.idRol) params = params.set('idRol', filtros.idRol);
    if (filtros.activo !== undefined)
      params = params.set('activo', filtros.activo);
    if (filtros.orderBy) params = params.set('orderBy', filtros.orderBy);
    if (filtros.orderDirection)
      params = params.set('orderDirection', filtros.orderDirection);

    return this.http.get<UsuariosPaginados>(`${this.baseUrl}/listar_usuarios`, {
      params,
    });
  }

  cambiarEstadoUsuario(id: string, activo: boolean): Observable<UsuarioAdmin> {
    return this.http.patch<UsuarioAdmin>(
      `${this.baseUrl}/cambiar_estado_usuario/${id}`,
      {
        activo,
      },
    );
  }
}
