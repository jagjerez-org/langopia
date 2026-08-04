import type { HTMLAttributes, ReactElement, ReactNode } from "react";

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "title"> {
  /** Cabecera opcional. Sin literales por defecto: si no se pasa, no hay cabecera. */
  title?: ReactNode;
  /** Slot de acciones a la derecha de la cabecera (p. ej. un `Button` ghost o un `Chip`). */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Contenedor estructural de pantalla, no un componente con estados propios:
 * la carga/vacío/error de lo que va dentro se resuelve componiendo
 * `Skeleton`, `EmptyState` o `ErrorState` como `children` — igual que haría
 * cualquier `<div>` de maquetación. Es el equivalente del `Card` contenedor
 * del panel legacy (`Card` en el DS es la tarjeta de contenido de marketing:
 * título obligatorio, imagen y acciones de pie, otra cosa).
 */
export function Panel({ title, actions, footer, children, ...rest }: PanelProps): ReactElement {
  const hasHeader = Boolean(title || actions);
  return (
    <div
      {...rest}
      className="flex flex-col rounded-lg border border-border bg-surface shadow-[var(--ink-shadow-sm)]"
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          {title && (
            <h3 className="m-0 break-words font-sans text-[length:var(--ink-text-md)] font-semibold text-text">
              {title}
            </h3>
          )}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex-1 p-5">{children}</div>
      {footer && (
        <div className="rounded-b-lg border-t border-border bg-surface-secondary px-5 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}
