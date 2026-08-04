import type { ReactElement, ReactNode } from "react";
import { IconAlertOctagon } from "../../atoms/Icons/Icons.js";

export interface ErrorStateProps {
  icon?: ReactNode;
  /**
   * Obligatorio y sin valor por defecto a propósito: este componente no puede
   * fabricar un "algo salió mal" — quien lo usa debe pasar el mensaje ya
   * traducido (del catálogo por `code`, o el `title` de la API si no lo
   * conoce).
   */
  title: ReactNode;
  /** Por ejemplo, el `traceId` del error para soporte. */
  description?: ReactNode;
  /** Típicamente un `Button` de "Reintentar". */
  action?: ReactNode;
}

const titleStyles =
  "m-0 max-w-lg font-sans text-[length:var(--ink-text-md)] font-semibold text-text";

/**
 * Estado de error de una lista, tabla o panel. `role="alert"` — se anuncia en
 * cuanto aparece, sin esperar a que alguien navegue hasta aquí. La acción de
 * reintento llega por el slot `action` (un `Button` del DS), no por una prop
 * `onRetry`: el texto del botón es responsabilidad de quien traduce.
 */
export function ErrorState({ icon, title, description, action }: ErrorStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center" role="alert">
      <span className="text-[2rem] leading-none text-critical">{icon ?? <IconAlertOctagon />}</span>
      <p className={titleStyles}>{title}</p>
      {description && (
        <p className="m-0 max-w-lg font-mono text-[length:var(--ink-text-xs)] text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
