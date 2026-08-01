import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "title"> {
  /** Cabecera opcional. Sin literales por defecto: si no se pasa, no hay cabecera. */
  title?: ReactNode;
  /** Slot de acciones a la derecha de la cabecera (p. ej. un `Button` ghost). */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Contenedor estructural, no un componente con estados propios: la
 * carga/vacío/error de lo que va dentro se resuelve componiendo `Skeleton`,
 * `EmptyState` o `ErrorState` como `children` — igual que haría cualquier
 * `<div>` de maquetación. Ver la nota en el informe de la tarea.
 */
export function Card({ title, actions, footer, children, ...rest }: CardProps): ReactElement {
  const hasHeader = Boolean(title || actions);
  return (
    <div {...rest} className={styles.card}>
      {hasHeader && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
