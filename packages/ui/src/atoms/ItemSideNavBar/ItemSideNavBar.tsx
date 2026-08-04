import { forwardRef } from "react";
import type { ReactElement, ReactNode } from "react";

export interface ItemSideNavBarProps {
  /** Icono del ítem (p. ej. un `Icon*` del paquete). */
  icon: ReactNode;
  /** Etiqueta del destino; con `collapsed` se oculta visualmente pero sigue accesible. */
  label: string;
  /** Destino del enlace. El router de la app podrá envolver el componente si hace falta. */
  href: string;
  /** Página actual: se marca con `aria-current="page"` y se destaca. */
  active?: boolean;
  /** Barra colapsada: solo el icono visible; la etiqueta queda para lectores de pantalla y como `title`. */
  collapsed?: boolean;
}

const itemStyles = [
  // Base: fila de enlace con icono, sin subrayado, foco visible.
  "flex w-full items-center gap-3 rounded-md px-3 py-2 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] font-medium no-underline transition-[background-color,color] duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  // Reposo y hover.
  "text-muted hover:bg-surface-secondary hover:text-text",
  // Colapsado: icono centrado.
  "data-[collapsed]:justify-center data-[collapsed]:px-2",
  // Activo: fondo de acento suave, también en hover.
  "data-[active]:bg-[var(--ink-accent-subtle-bg)] data-[active]:text-[var(--ink-accent-subtle-text)] data-[active]:hover:bg-[var(--ink-accent-subtle-bg)] data-[active]:hover:text-[var(--ink-accent-subtle-text)]",
].join(" ");

const iconStyles = "inline-flex shrink-0 text-[1.15em] leading-none";

/**
 * Ítem de navegación lateral: icono + etiqueta en forma de enlace. El estado
 * activo se comunica con `aria-current="page"` además del color; colapsado
 * muestra solo el icono manteniendo la etiqueta accesible.
 */
export const ItemSideNavBar = forwardRef<HTMLAnchorElement, ItemSideNavBarProps>(
  function ItemSideNavBar({ icon, label, href, active = false, collapsed = false }, ref): ReactElement {
    return (
      <a
        ref={ref}
        href={href}
        className={itemStyles}
        data-active={active || undefined}
        data-collapsed={collapsed || undefined}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
      >
        <span className={iconStyles}>{icon}</span>
        <span className={collapsed ? "sr-only" : "min-w-0 truncate"}>{label}</span>
      </a>
    );
  },
);
