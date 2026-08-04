import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { IconDotsVertical } from "../Icons/Icons.js";

export type TreeDotsAlign = "start" | "end";

export interface TreeDotsProps {
  /** Nombre accesible del disparador (ya traducido, p. ej. "Más acciones de la ficha"). */
  triggerLabel: string;
  /**
   * Contenido del popup. El componente solo aporta el disparador y el
   * posicionamiento: los ítems del menú llegan por aquí (la molécula de menú
   * los construirá encima).
   */
  children: ReactNode;
  /** Borde del disparador al que se alinea el popup. Por defecto `end`. */
  align?: TreeDotsAlign;
  disabled?: boolean;
}

const triggerStyles = [
  // Base: botón-icono fantasma, cuadrado, con foco visible.
  "inline-flex h-8 w-8 cursor-pointer appearance-none items-center justify-center rounded-md border-none bg-transparent p-0 text-muted transition-[background-color,color] duration-fast not-disabled:hover:bg-surface-secondary not-disabled:hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-[var(--ink-text-disabled)]",
].join(" ");

const popupStyles = [
  // Flotante bajo el disparador, alineado a un borde según `data-align`.
  "absolute top-full z-[var(--ink-z-dropdown)] mt-1 min-w-36 rounded-md border border-border bg-surface p-1 shadow-[var(--ink-shadow-md)] data-[align=start]:left-0 data-[align=end]:right-0",
].join(" ");

/**
 * Disparador de "más acciones" (⋮) con su popup contextual. Gestiona abrir y
 * cerrar (clic en el disparador, Escape, clic fuera) y expone el estado con
 * `aria-haspopup="menu"` / `aria-expanded`; el contenido del menú es ajeno y
 * llega por `children`.
 */
export const TreeDots = forwardRef<HTMLDivElement, TreeDotsProps>(function TreeDots(
  { triggerLabel, children, align = "end", disabled = false },
  forwardedRef,
): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  // Clic fuera cierra: el popup no atrapa el foco, así que basta con escuchar
  // el puntero a nivel de documento mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const setRootRef = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  // Escape cierra desde cualquier punto del componente y devuelve el foco al
  // disparador — quien lo abrió con teclado no pierde su sitio.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={setRootRef} className="relative inline-flex" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerStyles}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <IconDotsVertical className="text-[1.1em] leading-none" />
      </button>
      {open && (
        <div id={menuId} role="menu" data-align={align} className={popupStyles}>
          {children}
        </div>
      )}
    </div>
  );
});
