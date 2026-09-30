/** Descarga en el navegador un archivo recibido como Blob (Excel, PDF…). */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  window.URL.revokeObjectURL(url);
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
