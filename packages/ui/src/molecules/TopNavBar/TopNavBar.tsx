import type { ReactElement, ReactNode } from "react";

export interface TopNavBarProps {
  /** Título de la página/sección, ya traducido. */
  title?: ReactNode;
  /** Migas de pan (p. ej. la molécula `Breadcrumb`); se muestra sobre el título. */
  breadcrumb?: ReactNode;
  /** Acciones de la derecha: avatar, `ThemeToggle`, `TreeDots`... */
  actions?: ReactNode;
  /** Fija la barra al borde superior al hacer scroll. */
  sticky?: boolean;
}

const headerStyles = [
  // Fila con la zona de título a la izquierda y las acciones a la derecha.
  "flex min-h-14 w-full items-center justify-between gap-4 border-b border-border bg-surface px-4",
  "data-[sticky]:sticky data-[sticky]:top-0 data-[sticky]:z-10",
].join(" ");

/**
 * Barra superior de página: slot izquierdo con migas de pan y/o título, y slot
 * derecho de acciones. Es puramente presentacional — el contenido de ambos
 * slots llega por props.
 */
export function TopNavBar({ title, breadcrumb, actions, sticky = false }: TopNavBarProps): ReactElement {
  return (
    <header className={headerStyles} data-sticky={sticky || undefined}>
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        {breadcrumb}
        {title && (
          <h1 className="m-0 truncate font-sans text-[length:var(--ink-text-lg)] leading-[var(--ink-leading-lg)] font-semibold text-text">
            {title}
          </h1>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
