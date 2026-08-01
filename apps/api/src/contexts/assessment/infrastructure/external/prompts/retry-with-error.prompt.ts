/**
 * Construye el segundo intento cuando el primero no valida.
 *
 * El error se pasa como contexto (regla de la ola 2: «se reintenta con el
 * error como contexto») para que el modelo corrija exactamente lo que falló.
 * Copia de `learning/infrastructure/external/prompts/retry-with-error.prompt.ts`:
 * es una utilidad genérica de texto, sin ningún acoplamiento de dominio, así
 * que duplicarla no ata este contexto a ningún cambio del otro.
 */
export function buildRetryPrompt(originalUserPrompt: string, invalidOutput: unknown, validationError: string): string {
  const invalidOutputText =
    invalidOutput === null || invalidOutput === undefined
      ? "(la respuesta no tenía la forma JSON esperada; no se pudo ni analizar)."
      : JSON.stringify(invalidOutput, null, 2);

  return (
    `${originalUserPrompt}\n\n` +
    `---\n\n` +
    `Tu respuesta anterior no es válida. Esto fue lo que devolviste:\n\n` +
    `${invalidOutputText}\n\n` +
    `Y este es el motivo exacto por el que se rechazó:\n${validationError}\n\n` +
    `Genera una versión corregida que solucione específicamente ese problema, manteniendo todo lo ` +
    `demás que ya pedía la instrucción original.`
  );
}
