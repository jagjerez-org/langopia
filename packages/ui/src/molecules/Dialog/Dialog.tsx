import { useEffect, useId, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { IconClose } from "../../atoms/Icons/Icons.js";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Normalmente uno o más `Button`. */
  footer?: ReactNode;
  /** Nombre accesible del botón de cerrar (solo icono): texto plano, no ReactNode. */
  closeLabel: string;
  /**
   * Si es `false`, Escape y clicar fuera no cierran el diálogo — solo el
   * botón de cerrar o una acción del `footer`. Para confirmaciones que no
   * deben perderse por un clic accidental.
   */
  dismissible?: boolean;
}

const closeButtonStyles =
  "inline-flex shrink-0 cursor-pointer appearance-none rounded-md border-none bg-transparent p-2 text-muted transition-colors duration-fast hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Construido sobre `<dialog>` nativo a propósito: el navegador ya resuelve
 * la trampa de foco dentro del modal, Escape para cerrar, y devolver el
 * foco a quien lo abrió — todo lo que un `focus-trap` casero tendría que
 * reinventar, con más superficie para el error.
 *
 * La coreografía de apertura/cierre (display, transiciones con
 * `allow-discrete`, `::backdrop`, `@starting-style`) vive en la clase global
 * `ink-dialog` de `theme.css`: no se puede expresar con utilidades sin pisar
 * la hoja de estilos del user agent.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel,
  dismissible = true,
}: DialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      // El evento "cancel" lo dispara Escape antes de cerrar; si el diálogo
      // no es descartable así, se bloquea aquí.
      if (!dismissible) event.preventDefault();
    };
    const handleClose = () => onClose();
    const handleClick = (event: MouseEvent) => {
      if (!dismissible) return;
      const rect = dialog.getBoundingClientRect();
      const clickedInside =
        event.clientY >= rect.top &&
        event.clientY <= rect.top + rect.height &&
        event.clientX >= rect.left &&
        event.clientX <= rect.left + rect.width;
      // Un clic fuera del rectángulo del panel solo puede caer en
      // `::backdrop`, que no es un nodo del DOM: por eso se comprueba el
      // rectángulo en vez de `event.target`.
      if (!clickedInside) dialog.close();
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleClick);
    };
  }, [dismissible, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="ink-dialog m-auto max-h-[calc(100vh-2rem)] w-[min(32rem,calc(100vw-2rem))] flex-col rounded-lg border-none bg-surface p-0 text-text shadow-[var(--ink-shadow-lg)]"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <h2 className="m-0 break-words font-sans text-[length:var(--ink-text-xl)] font-semibold" id={titleId}>
          {title}
        </h2>
        <button
          type="button"
          className={closeButtonStyles}
          onClick={() => dialogRef.current?.close()}
          aria-label={closeLabel}
        >
          <IconClose />
        </button>
      </div>
      {description && (
        <p id={descriptionId} className="m-0 px-5 pt-4 text-[length:var(--ink-text-sm)] text-muted">
          {description}
        </p>
      )}
      {children && <div className="flex-1 overflow-y-auto p-5">{children}</div>}
      {footer && (
        <div className="flex flex-wrap justify-end gap-3 rounded-b-lg border-t border-border bg-surface-secondary px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
