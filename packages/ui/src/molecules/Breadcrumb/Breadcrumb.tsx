import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";

export interface BreadcrumbItem {
  /** Etiqueta del nivel, ya traducida. */
  label: string;
  /** Destino; el último ítem (página actual) nunca es enlace aunque lo tenga. */
  href?: string;
}

export interface BreadcrumbProps {
  /** Niveles de la jerarquía, en orden; el último es la página actual. */
  items: BreadcrumbItem[];
  /** Nombre accesible del landmark `<nav>` (p. ej. "Migas de pan"). */
  ariaLabel: string;
  /** Separador decorativo entre niveles; por defecto "/". */
  separator?: ReactNode;
  /**
   * Máximo de niveles visibles. Si hay más, se muestran el primero, un "…" y
   * los `maxItems - 1` últimos. Mínimo útil: 2.
   */
  maxItems?: number;
  /** Texto del marcador de niveles ocultos; por defecto "…". */
  collapsedLabel?: string;
}

const listStyles = "m-0 flex list-none flex-wrap items-center gap-1 p-0";
const linkStyles =
  "rounded-sm font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted no-underline transition-colors duration-fast hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const currentStyles =
  "font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const separatorStyles =
  "inline-flex select-none items-center text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/** Niveles visibles aplicando el colapso con "…" (null = marcador de colapso). */
function visibleItems(items: BreadcrumbItem[], maxItems?: number): (BreadcrumbItem | null)[] {
  if (maxItems === undefined || items.length <= maxItems) return items;
  const tail = Math.max(1, maxItems - 1);
  return [items[0]!, null, ...items.slice(-tail)];
}

/**
 * Migas de pan: jerarquía de niveles con enlaces, donde el último es la
 * página actual (`aria-current="page"`, sin enlace). Con `maxItems` colapsa
 * los niveles intermedios tras un "…".
 */
export function Breadcrumb({
  items,
  ariaLabel,
  separator = "/",
  maxItems,
  collapsedLabel = "…",
}: BreadcrumbProps): ReactElement {
  const visible = visibleItems(items, maxItems);
  const lastIndex = items.length - 1;
  // Índice (en `items`) del nivel representado por cada posición visible.
  let cursor = 0;

  return (
    <nav aria-label={ariaLabel}>
      <ol className={listStyles}>
        {visible.map((item, position) => {
          if (item === null) {
            // El marcador ocupa el rango de niveles colapsados: tras él quedan
            // los `visible.length - position - 1` últimos niveles de `items`.
            cursor = items.length - (visible.length - position - 1);
            return (
              <Fragment key="collapsed">
                <li aria-hidden="true" className={separatorStyles}>
                  {collapsedLabel}
                </li>
                <li aria-hidden="true" className={separatorStyles}>
                  {separator}
                </li>
              </Fragment>
            );
          }

          const index = cursor;
          cursor += 1;
          const isCurrent = index === lastIndex;

          return (
            <Fragment key={`${item.label}-${index}`}>
              <li>
                {isCurrent ? (
                  <span className={currentStyles} aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <a className={linkStyles} href={item.href ?? "#"}>
                    {item.label}
                  </a>
                )}
              </li>
              {position < visible.length - 1 && (
                <li aria-hidden="true" className={separatorStyles}>
                  {separator}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
