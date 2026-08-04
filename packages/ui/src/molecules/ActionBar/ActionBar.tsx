import type { ReactElement, ReactNode } from "react";
import { Button } from "../../atoms/Button/Button.js";
import type { ButtonVariant } from "../../atoms/Button/Button.js";
import { FormAction } from "../../atoms/FormAction/FormAction.js";

export interface ActionBarAction {
  /** Texto del botón, ya traducido. */
  label: string;
  /** Acción de botón (formulario/comando). Excluyente con `href`. */
  onClick?: () => void;
  /**
   * Tipo del botón: por defecto "button". Con "submit" (dentro de un
   * `<form>`) el botón envía el formulario y Enter funciona desde los campos.
   */
  type?: "submit";
  /** Acción de navegación: se renderiza como enlace con aspecto de botón. */
  href?: string;
  /** Énfasis visual; por defecto `secondary` (el primario lo decide quien llama). */
  variant?: ButtonVariant;
  /** Icono a la izquierda del texto. */
  icon?: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
}

export interface ActionBarProps {
  /** Acciones de la barra, en orden (p. ej. primaria la última). */
  actions: ActionBarAction[];
  /** Título opcional de la sección, a la izquierda. */
  title?: ReactNode;
  /** Fija la barra al borde inferior (acciones siempre visibles al hacer scroll). */
  sticky?: boolean;
}

const barStyles = [
  // Título a la izquierda y acciones alineadas a la derecha por defecto.
  "flex w-full flex-wrap items-center justify-end gap-3",
  "data-[sticky]:sticky data-[sticky]:bottom-0 data-[sticky]:z-10 data-[sticky]:border-t data-[sticky]:border-border data-[sticky]:bg-surface data-[sticky]:px-4 data-[sticky]:py-3",
].join(" ");

/**
 * Barra de acciones contextuales de una página o sección: título opcional a la
 * izquierda y botones a la derecha. Las acciones llegan por props; las de
 * navegación (`href`) usan `FormAction` y los comandos (`onClick`), `Button`.
 */
export function ActionBar({ actions, title, sticky = false }: ActionBarProps): ReactElement {
  return (
    <div className={barStyles} data-sticky={sticky || undefined}>
      {title && (
        <h2 className="m-0 mr-auto truncate font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text">
          {title}
        </h2>
      )}
      {actions.map((action) =>
        action.href !== undefined ? (
          <FormAction
            key={action.label}
            href={action.href}
            variant={action.variant ?? "secondary"}
            disabled={action.disabled}
            isLoading={action.isLoading}
          >
            {action.icon && (
              <span className="inline-flex shrink-0 text-[1.1em] leading-none">{action.icon}</span>
            )}
            {action.label}
          </FormAction>
        ) : (
          <Button
            key={action.label}
            type={action.type ?? "button"}
            variant={action.variant ?? "secondary"}
            leadingIcon={action.icon}
            disabled={action.disabled}
            isLoading={action.isLoading}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ),
      )}
    </div>
  );
}
