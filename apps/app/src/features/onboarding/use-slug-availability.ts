import { useEffect, useState } from "react";
import { checkSlugAvailability } from "./api.js";
import { hasPlausibleSlugShape } from "./slug.js";

export type SlugAvailability = "idle" | "checking" | "available" | "unavailable";

const DEBOUNCE_MS = 400;

/**
 * Aviso de disponibilidad EN VIVO (Paso 1 del brief), mientras se escribe.
 *
 * Un slug que todavía no tiene forma plausible (`hasPlausibleSlugShape`) se
 * queda en `"idle"` sin llamar a la API — no hay nada que comprobar todavía,
 * y evita una petición por cada tecla de un identificador a medio escribir.
 * Con forma plausible, espera `DEBOUNCE_MS` de calma antes de preguntar:
 * quien teclea rápido no dispara una petición por letra.
 */
export function useSlugAvailability(slug: string): SlugAvailability {
  const [status, setStatus] = useState<SlugAvailability>("idle");

  useEffect(() => {
    if (!hasPlausibleSlugShape(slug)) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSlugAvailability(slug)
        .then((result) => {
          if (!cancelled) setStatus(result.available ? "available" : "unavailable");
        })
        .catch(() => {
          // Un fallo de red no debe fingir una respuesta: sin aviso hasta que
          // el envío del formulario, que sí es autoritativo, lo confirme.
          if (!cancelled) setStatus("idle");
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  return status;
}
