import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from 'src/app/config';
import { ResumenDashboard, ResumenFlujoDinero } from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiUrl}/dashboard`;

  /** Todo el inicio en un llamado. Fechas YYYY-MM-DD; sin fechas = mes actual. */
  resumen(fechaDesde?: string, fechaHasta?: string): Observable<ResumenDashboard> {
    let params = new HttpParams();
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    return this.http.get<ResumenDashboard>(`${this.baseUrl}/resumen`, { params });
  }

  /** Dinero que entró y salió (caja + bancos) y ganancia estimada del período. */
  flujoDinero(fechaDesde?: string, fechaHasta?: string): Observable<ResumenFlujoDinero> {
    let params = new HttpParams();
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    return this.http.get<ResumenFlujoDinero>(`${this.baseUrl}/flujo-dinero`, { params });
  }
}
