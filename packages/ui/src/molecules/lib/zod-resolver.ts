import type { FieldErrors, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Resolver mínimo de zod para react-hook-form, específico de las moléculas de
 * este paquete. Evita añadir `@hookform/resolvers` como dependencia: los
 * formularios del sistema son planos (sin rutas anidadas), así que basta con
 * mapear cada `issue` de zod al primer nivel de `FieldErrors`.
 *
 * El primer error de cada campo es el que se muestra, igual que haría
 * `@hookform/resolvers`.
 */
export function zodResolver<Input extends Record<string, unknown>, Output>(
  schema: z.ZodType<Output, Input>,
): Resolver<Input, unknown, Output> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const name = issue.path.join(".");
      if (name !== "" && errors[name] === undefined) {
        errors[name] = { type: issue.code, message: issue.message };
      }
    }

    // El objeto construido es un `FieldErrors` plano válido; el cast evita
    // tener que reconstruir los tipos recursivos de react-hook-form.
    return { values: {}, errors: errors as FieldErrors<Input> };
  };
}
