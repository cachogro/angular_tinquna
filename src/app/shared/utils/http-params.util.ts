import { HttpParams } from '@angular/common/http';

/** Query params a partir de un objeto de filtros: omite los vacíos
 *  (undefined, null y ''). */
export function aHttpParams(filtros: object): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      params = params.set(clave, String(valor));
    }
  }
  return params;
}
