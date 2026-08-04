import type { ReactElement, ReactNode } from "react";
import { IconChevronRight } from "../../atoms/Icons/Icons.js";
import { ItemSideNavBar } from "../../atoms/ItemSideNavBar/ItemSideNavBar.js";

export interface SideNavBarItem {
  /** Destino del enlace. */
  href: string;
  /** Etiqueta del destino, ya traducida. */
  label: string;
  /** Icono del ítem (p. ej. un `Icon*` del paquete). */
  icon: ReactNode;
  /** Página actual: se marca con `aria-current="page"` y se destaca. */
  active?: boolean;
}

export interface SideNavBarBaseProps {
  /** Destinos de la navegación, en orden. */
  items: SideNavBarItem[];
  /** Nombre accesible del landmark `<nav>` (p. ej. "Navegación principal"). */
  ariaLabel: string;
  /** Modo colapsado: solo iconos visibles; las etiquetas siguen accesibles. */
  collapsed?: boolean;
  /** Slot de cabecera: logo, nombre de la app... */
  header?: ReactNode;
  /** Slot de pie: p. ej. el futuro componente de usuario. */
  footer?: ReactNode;
}

/**
 * El botón de alternar el colapso es todo o nada: con `onToggleCollapse` el
 * `toggleLabel` (nombre accesible) es obligatorio; sin él, ninguno de los dos.
 */
export type SideNavBarProps = SideNavBarBaseProps &
  (
    | {
        /** Muestra un botón para alternar el modo colapsado; el estado lo controla quien llama. */
        onToggleCollapse: () => void;
        /** Nombre accesible del botón de alternar. */
        toggleLabel: string;
      }
    | { onToggleCollapse?: undefined; toggleLabel?: undefined }
  );

const navStyles = [
  // Columna fija al borde; el ancho cambia según el modo.
  "flex h-full flex-col gap-2 border-r border-border bg-surface p-3 transition-[width] duration-[var(--ink-duration-base)]",
  "w-64 data-[collapsed]:w-16",
].join(" ");

const listStyles = "m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0";

const toggleStyles = [
  // Botón-icono fantasma, alineado como los ítems.
  "inline-flex h-9 w-full cursor-pointer appearance-none items-center rounded-md border-none bg-transparent px-3 text-muted transition-[background-color,color] duration-fast hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "data-[collapsed]:justify-center data-[collapsed]:px-2",
].join(" ");

/**
 * Navegación lateral de la aplicación: lista de `ItemSideNavBar` con slots de
 * cabecera y pie, y modo colapsado (solo iconos) controlado por props. El
 * estado activo llega marcado en cada ítem — el componente no conoce el router.
 */
export function SideNavBar({
  items,
  ariaLabel,
  collapsed = false,
  onToggleCollapse,
  toggleLabel,
  header,
  footer,
}: SideNavBarProps): ReactElement {
  return (
    <nav aria-label={ariaLabel} className={navStyles} data-collapsed={collapsed || undefined}>
      {header && <div className="flex min-h-9 items-center px-1">{header}</div>}
      <ul className={listStyles}>
        {items.map((item) => (
          <li key={item.href}>
            <ItemSideNavBar
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.active}
              collapsed={collapsed}
            />
          </li>
        ))}
      </ul>
      {onToggleCollapse && (
        <button
          type="button"
          className={toggleStyles}
          data-collapsed={collapsed || undefined}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
        >
          {/* Colapsado apunta a expandir (derecha); expandido, a colapsar. */}
          <span
            className="inline-flex rotate-180 text-[1.15em] leading-none transition-transform duration-fast data-[collapsed]:rotate-0"
            data-collapsed={collapsed || undefined}
          >
            <IconChevronRight />
          </span>
        </button>
      )}
      {footer && <div className="border-t border-border pt-2">{footer}</div>}
    </nav>
  );
}
