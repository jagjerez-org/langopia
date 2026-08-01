/**
 * Rastro de una generación que se lanzó y cuya respuesta esta pestaña no
 * llegó a ver (Paso 2 del brief: la petición «puede tardar minutos»).
 *
 * `POST /learning/units/generate` es SÍNCRONO: la unidad se guarda cuando la
 * petición termina, y si la pestaña se cierra o se recarga antes, nadie
 * cancela nada — la generación sigue su curso en el servidor y la unidad
 * acaba apareciendo en el listado. Lo único que se pierde es esta pantalla.
 * Por eso se recuerda el código y el instante de arranque: al volver, el
 * aviso (`content.form.pendingBanner*`) explica qué pasó y a dónde mirar.
 *
 * No decide nada: no dice si la generación tuvo éxito ni consulta su estado
 * (eso es el listado, que lo pregunta a la API). Es una nota para el usuario.
 */
export type PendingGeneration = {
  code: string;
  /** ISO 8601 UTC del momento en que se lanzó la petición. */
  startedAt: string;
};

const STORAGE_KEY = "langopia:content:pending-generation";

export function readPendingGeneration(): PendingGeneration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGeneration>;
    if (typeof parsed.code !== "string" || typeof parsed.startedAt !== "string") return null;
    return { code: parsed.code, startedAt: parsed.startedAt };
  } catch {
    // Almacenamiento no disponible o contenido corrupto: sin aviso que dar,
    // que es exactamente lo mismo que si no hubiera ninguna generación
    // pendiente. Nunca un fallo que rompa la pantalla.
    return null;
  }
}

export function rememberPendingGeneration(pending: PendingGeneration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Sin almacenamiento persistente el aviso no sobrevive a una recarga.
    // Degradación aceptable: la generación en sí no depende de esto.
  }
}

export function forgetPendingGeneration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ver `rememberPendingGeneration`.
  }
}
