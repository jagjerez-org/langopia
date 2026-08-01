import type { ReactElement, ReactNode } from "react";
import styles from "./EmptyState.module.css";
import { IconInbox } from "./icons.js";

export interface EmptyStateProps {
  /** Sustituye el icono por defecto (una bandeja vacía neutra, sin connotación de error). */
  icon?: ReactNode;
  /** Título obligatorio: no hay un "no hay nada" por defecto que traducir mal. */
  title: ReactNode;
  description?: ReactNode;
  /** Típicamente un `Button` — "Añadir alumno", "Importar desde CSV"… */
  action?: ReactNode;
}

/**
 * `role="status"` para que, si esto sustituye a una tabla o lista tras
 * filtrar o cargar, quien use lector de pantalla oiga que el resultado es
 * "vacío" sin tener que re-explorar la pantalla entera.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div className={styles.root} role="status">
      <span className={styles.icon}>{icon ?? <IconInbox />}</span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
