import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Flujo de error de servidor compartido por las moléculas de formulario.
 *
 * El error puede llegar de dos vías, y la prop manda:
 * 1. Controlado: la prop `error` del componente (la app gestiona el estado).
 * 2. No controlado: la promesa de `onSubmit` rechaza; la molécula captura el
 *    `Error.message` (o un texto de reserva si rechaza con otra cosa) y lo
 *    muestra hasta el siguiente intento de envío.
 */
export function useServerError(externalError: ReactNode, fallbackMessage: string) {
  const [internalError, setInternalError] = useState<ReactNode>(null);

  const wrapSubmit = <Values,>(
    onSubmit: (values: Values) => void | Promise<void>,
  ): ((values: Values) => Promise<void>) => {
    return async (values) => {
      setInternalError(null);
      try {
        await onSubmit(values);
      } catch (cause) {
        setInternalError(
          cause instanceof Error && cause.message !== "" ? cause.message : fallbackMessage,
        );
      }
    };
  };

  return { serverError: externalError ?? internalError, wrapSubmit };
}
