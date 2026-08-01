import { useEffect, useId, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import styles from "./Dialog.module.css";
import { IconClose } from "./icons.js";

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

/**
 * Construido sobre `<dialog>` nativo a propósito: el navegador ya resuelve
 * la trampa de foco dentro del modal, Escape para cerrar, y devolver el
 * foco a quien lo abrió — todo lo que un `focus-trap` casero tendría que
 * reinventar, con más superficie para el error.
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
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.closeButton}
          onClick={() => dialogRef.current?.close()}
          aria-label={closeLabel}
        >
          <IconClose />
        </button>
      </div>
      {description && (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
      {children && <div className={styles.body}>{children}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  );
}
