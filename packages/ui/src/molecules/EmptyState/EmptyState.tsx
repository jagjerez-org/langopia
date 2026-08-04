import type { ReactElement, ReactNode } from "react";
import { IconInbox } from "../../atoms/Icons/Icons.js";

export interface EmptyStateProps {
  /** Sustituye el icono por defecto (una bandeja vacía neutra, sin connotación de error). */
  icon?: ReactNode;
  /** Título obligatorio: no hay un "no hay nada" por defecto que traducir mal. */
  title: ReactNode;
  description?: ReactNode;
  /** Típicamente un `Button` — "Añadir alumno", "Importar desde CSV"… */
  action?: ReactNode;
}

const titleStyles =
  "m-0 max-w-lg font-sans text-[length:var(--ink-text-md)] font-semibold text-text";

/**
 * Estado vacío de una lista, tabla o panel: icono, título, descripción y una
 * acción opcional. `role="status"` para que, si esto sustituye a una tabla o
 * lista tras filtrar o cargar, quien use lector de pantalla oiga que el
 * resultado es "vacío" sin tener que re-explorar la pantalla entera.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center text-muted" role="status">
      <span className="text-[2rem] leading-none text-[var(--ink-text-tertiary)]">
        {icon ?? <IconInbox />}
      </span>
      <p className={titleStyles}>{title}</p>
      {description && (
        <p className="m-0 max-w-lg text-[length:var(--ink-text-sm)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
