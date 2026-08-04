import type { ReactElement, ReactNode } from "react";
import styles from "./ErrorState.module.css";
import { IconAlertOctagon } from "./icons.js";

export interface ErrorStateProps {
  icon?: ReactNode;
  /**
   * Obligatorio y sin valor por defecto a propósito: este componente no
   * puede fabricar un "algo salió mal" — quien lo usa debe pasar el mensaje
   * ya traducido (del catálogo por `code`, o el `title` de la API si no lo
   * conoce), tal como exige `OLA-1-WEB.md`.
   */
  title: ReactNode;
  /** Por ejemplo, el `traceId` del error para soporte. */
  description?: ReactNode;
  /** Típicamente un `Button` de "Reintentar". */
  action?: ReactNode;
}

/** `role="alert"` — se anuncia en cuanto aparece, sin esperar a que alguien navegue hasta aquí. */
export function ErrorState({ icon, title, description, action }: ErrorStateProps): ReactElement {
  return (
    <div className={styles.root} role="alert">
      <span className={styles.icon}>{icon ?? <IconAlertOctagon />}</span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
