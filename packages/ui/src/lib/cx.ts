/**
 * Helper mínimo para concatenar clases condicionales. No reemplaza a una
 * librería de utilidades cuando el proyecto la necesite; este slice solo
 * necesita algo sin dependencias externas para los componentes base.
 */
export function cx(
  ...inputs: Array<string | number | boolean | undefined | null | Record<string, boolean | undefined | null>>
): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
      continue;
    }

    for (const [key, value] of Object.entries(input)) {
      if (value) {
        classes.push(key);
      }
    }
  }

  return classes.join(" ");
}
