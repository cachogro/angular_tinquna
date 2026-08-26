/**
 * Formatea un número (o string numérico, como los que devuelve el backend
 * para campos decimales) mostrando solo los decimales significativos:
 * enteros sin decimales, y valores con decimales sin ceros de relleno.
 * Ej: '10.0000' -> '10', '45.2500' -> '45.25', '45.2000' -> '45.2'.
 */
export function formatNumeroSinCeros(
  valor: number | string | null | undefined,
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const num = typeof valor === 'number' ? valor : parseFloat(valor);
  if (Number.isNaN(num)) return String(valor);
  if (Number.isInteger(num)) return String(num);
  return String(parseFloat(num.toFixed(4)));
}

/**
 * Igual que formatNumeroSinCeros, pero agrega separador de miles (coma)
 * manteniendo el punto como separador decimal.
 * Ej: '12345' -> '12,345', '12345.25' -> '12,345.25'.
 */
export function formatNumeroConMiles(
  valor: number | string | null | undefined,
): string {
  const sinCeros = formatNumeroSinCeros(valor);
  if (sinCeros === '') return '';
  const num = parseFloat(sinCeros);
  if (Number.isNaN(num)) return sinCeros;
  const decimales = sinCeros.includes('.') ? sinCeros.split('.')[1].length : 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
