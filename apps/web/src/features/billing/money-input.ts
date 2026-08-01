/**
 * Convierte un importe tecleado por una persona (p. ej. "150", "150,50" o
 * "150.50") en céntimos ENTEROS para mandarlos a la API (`unitCents`,
 * `amountCents`). Acepta coma o punto decimal, hasta dos decimales. Devuelve
 * `null` si el texto no representa un importe válido, para que el formulario
 * lo trate como error de validación, no como un cero silencioso.
 *
 * Esto NO es la "lógica de negocio en el frontend" que prohíbe
 * `OLA-1-WEB.md`: no decide nada sobre facturas, IVA, comisiones ni
 * devoluciones —eso sigue calculándolo y devolviéndolo la API—; es la
 * codificación inevitable de un campo de formulario, porque la API exige
 * céntimos enteros y una persona teclea en la unidad mayor de su moneda.
 * Esta función nunca suma ni multiplica dos importes entre sí: traduce UNO
 * solo, tecleado, a su entero en céntimos.
 */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number.parseFloat(trimmed) * 100);
  return Number.isFinite(cents) ? cents : null;
}
