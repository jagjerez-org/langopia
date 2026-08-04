import { forwardRef } from "react";
import type { ReactElement, ReactNode, Ref } from "react";

export interface ItemListProps {
  /** Contenido principal de la fila (título, texto...). */
  children: ReactNode;
  /** Elemento a la izquierda: icono, avatar... */
  leading?: ReactNode;
  /** Accesorio a la derecha: icono, cheurón, meta... */
  accessory?: ReactNode;
  /** Con `href` la fila es un enlace. */
  href?: string;
  /** Con `onClick` (y sin `href`) la fila es un botón. */
  onClick?: () => void;
  /** Fila activa/seleccionada: enlace → `aria-current="page"`, botón → `aria-pressed`. */
  active?: boolean;
  /** Solo aplica a la variante botón (los enlaces no tienen disabled nativo). */
  disabled?: boolean;
}

const itemStyles = [
  // Base: fila con huecos para leading/accesorio; el reset de botón sobra en
  // las variantes <a> y <div>, pero no molesta y mantiene la cadena estática.
  "flex w-full appearance-none items-center gap-3 rounded-md border-none bg-transparent px-3 py-2 text-left font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text no-underline transition-[background-color,color] duration-fast",
  // Interactiva: cursor, hover y foco visible solo cuando hay acción.
  "data-[clickable]:cursor-pointer data-[clickable]:not-disabled:hover:bg-surface-secondary data-[clickable]:focus-visible:outline-2 data-[clickable]:focus-visible:outline-offset-2 data-[clickable]:focus-visible:outline-accent data-[clickable]:disabled:cursor-not-allowed data-[clickable]:disabled:text-[var(--ink-text-disabled)]",
  // Activa: fondo de acento suave.
  "data-[active]:bg-[var(--ink-accent-subtle-bg)] data-[active]:text-[var(--ink-accent-subtle-text)]",
].join(" ");

const sideStyles = "inline-flex shrink-0 items-center text-[1.15em] leading-none";

/**
 * Fila individual de lista. Es estática por defecto (`<div>`); con `href` se
 * convierte en enlace y con `onClick` en botón, manteniendo el mismo aspecto.
 * La composición en listas con cabecera o separadores es cosa de la molécula.
 */
export const ItemList = forwardRef<
  HTMLDivElement | HTMLAnchorElement | HTMLButtonElement,
  ItemListProps
>(function ItemList(
  { children, leading, accessory, href, onClick, active = false, disabled = false },
  ref,
): ReactElement {
  const content = (
    <>
      {leading && <span className={sideStyles}>{leading}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {accessory && <span className={`${sideStyles} text-muted`}>{accessory}</span>}
    </>
  );

  if (href !== undefined) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={itemStyles}
        data-clickable="true"
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  if (onClick !== undefined) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        className={itemStyles}
        data-clickable="true"
        data-active={active || undefined}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={ref as Ref<HTMLDivElement>} className={itemStyles} data-active={active || undefined}>
      {content}
    </div>
  );
});
