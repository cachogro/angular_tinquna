// src/app/pages/contabilidad/components/personal-interno.util.ts
import { Observable, map } from 'rxjs';
import { PersonaCI } from '../../configurations/models/persona.models';
import { PersonaService } from '../../configurations/services/persona.service';

/** Actor productivo minero que representa a la propia empresa: sus personas
 *  son el personal interno (mismo criterio que el back y PersonalInterno). */
export const ID_ACTOR_EMPRESA = '1';

/** Personal interno activo, ordenado por nombre. El back no filtra personas
 *  por actor: se trae todo y se filtra acá (igual que PersonalInternoComponent). */
export function cargarPersonalInterno(
  personaService: PersonaService,
): Observable<PersonaCI[]> {
  return personaService
    .listarPersonas({ page: 1, limit: 1000, activo: true, orderBy: 'nombres', orderDirection: 'ASC' })
    .pipe(
      map((res) =>
        (res.data ?? []).filter(
          (p) =>
            String(p.actorProductivoMinero?.id ?? p.idActorProductivoMinero ?? '') ===
            ID_ACTOR_EMPRESA,
        ),
      ),
    );
}

export function nombrePersona(p: {
  nombres: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
} | null | undefined): string {
  if (!p) return '—';
  return `${p.nombres} ${p.apellidoPaterno ?? ''} ${p.apellidoMaterno ?? ''}`
    .trim()
    .replace(/\s+/g, ' ');
}

/** "YYYY-MM-DD" desde un Date local. */
export function formatFechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** "dd/mm/aaaa" desde "YYYY-MM-DD…". */
export function fechaFmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function num(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
