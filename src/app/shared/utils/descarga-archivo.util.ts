/** Formato en que el back entrega un reporte: el PDF es el mismo libro que el Excel. */
export type FormatoReporte = 'EXCEL' | 'PDF';

/** Extensión del archivo según el formato pedido. */
export function extensionReporte(formato: FormatoReporte): string {
  return formato === 'PDF' ? 'pdf' : 'xlsx';
}

/** Descarga en el navegador un archivo recibido como Blob (Excel, PDF…). */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  window.URL.revokeObjectURL(url);
}

/** Abre en otra pestaña un archivo recibido como Blob (PDF). Devuelve false
 *  si el navegador bloqueó la ventana emergente. `vidaMs` es cuánto vive la
 *  URL antes de liberarse. */
export function abrirBlobEnPestana(blob: Blob, vidaMs = 60000): boolean {
  const url = window.URL.createObjectURL(blob);
  setTimeout(() => window.URL.revokeObjectURL(url), vidaMs);
  return !!window.open(url, '_blank');
}

/**
 * `message` del error del back en una petición con responseType 'blob'.
 * En ese caso el 400/404 también llega como Blob y hay que leerlo como JSON.
 * Devuelve null si no hay mensaje legible (se muestra uno genérico).
 */
export async function mensajeErrorBlob(err: any): Promise<string | null> {
  try {
    const cuerpo =
      err?.error instanceof Blob
        ? JSON.parse(await err.error.text())
        : err?.error;
    const msg = cuerpo?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? null);
  } catch {
    return null;
  }
}
