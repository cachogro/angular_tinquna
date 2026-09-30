// src/app/pages/contabilidad/boletas-pago/boleta-pdf.util.ts
import { MatSnackBar } from '@angular/material/snack-bar';
import { mensajeErrorBlob } from '../../../shared/utils/descarga-archivo.util';
import { BoletaPagoService } from '../services/boleta-pago.service';

/** Abre en otra pestaña el PDF de la boleta (Original, Copia 1 y Copia 2).
 *  `interno = false` es la versión solo de ley: sin préstamos, neto ni
 *  saldos; "Son:" pasa a ser el líquido pagable. */
export function abrirPdfBoleta(
  boletaService: BoletaPagoService,
  snackBar: MatSnackBar,
  id: string,
  interno: boolean,
  alTerminar: () => void,
): void {
  boletaService.obtenerPdf(id, interno).subscribe({
    next: (blob) => {
      alTerminar();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    },
    error: async (err) => {
      alTerminar();
      snackBar.open(
        (await mensajeErrorBlob(err)) ?? 'No se pudo generar el PDF de la boleta',
        'Cerrar',
        { duration: 5000 },
      );
    },
  });
}
