import type { ReactElement, ReactNode } from "react";

export interface BottomPageItem {
  /** Destino del enlace. */
  href: string;
  /** Etiqueta de la acción, ya traducida. */
  label: string;
  /** Icono de la acción (p. ej. un `Icon*` del paquete). */
  icon: ReactNode;
  /** Destino actual: se marca con `aria-current="page"` y se destaca. */
  active?: boolean;
}

export interface BottomPageProps {
  /** Acciones principales (1-3), en orden. */
  items: BottomPageItem[];
  /** Nombre accesible del landmark `<nav>` (p. ej. "Acciones de página"). */
  ariaLabel: string;
}

const navStyles =
  "fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)]";

const listStyles = "m-0 flex list-none items-stretch justify-around p-0";

const itemStyles = [
  // Columna icono sobre etiqueta, con zona táctil generosa.
  "flex min-w-16 flex-1 flex-col items-center gap-1 rounded-md px-3 py-2 font-sans text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium no-underline transition-[background-color,color] duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  // Reposo y hover.
  "text-muted hover:bg-surface-secondary hover:text-text",
  // Activo: color de acento.
  "data-[active]:text-accent data-[active]:hover:text-accent",
].join(" ");

/**
 * Barra inferior de página (móvil): las acciones principales fijadas abajo,
 * con icono y etiqueta. El estado activo llega marcado en cada ítem — el
 * componente no conoce el router.
 */
export function BottomPage({ items, ariaLabel }: BottomPageProps): ReactElement {
  return (
    <nav aria-label={ariaLabel} className={navStyles}>
      <ul className={listStyles}>
        {items.map((item) => (
          <li key={item.href} className="flex flex-1">
            <a
              href={item.href}
              className={itemStyles}
              data-active={item.active || undefined}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="inline-flex text-[1.4em] leading-none">{item.icon}</span>
              <span className="max-w-full truncate">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
