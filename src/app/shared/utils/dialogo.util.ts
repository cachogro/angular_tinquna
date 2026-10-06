import { MatDialogRef } from '@angular/material/dialog';

/**
 * Hace que cerrar el diálogo con Esc o con un clic afuera devuelva
 * `resultado()`, igual que su botón "Cerrar". Sin esto esos cierres devuelven
 * undefined y quien lo abrió no se entera de lo que cambió adentro.
 */
export function cerrarDevolviendo<R>(
  dialogRef: MatDialogRef<unknown, R>,
  resultado: () => R,
): void {
  dialogRef.disableClose = true;
  dialogRef.backdropClick().subscribe(() => dialogRef.close(resultado()));
  dialogRef.keydownEvents().subscribe((evento) => {
    if (evento.key === 'Escape') dialogRef.close(resultado());
  });
}
