import { forwardRef } from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import { Button, buttonStyles } from "../Button/Button.js";
import type { ButtonSize, ButtonVariant } from "../Button/Button.js";
import { IconSpinner } from "../Icons/Icons.js";

const iconStyles = "inline-flex shrink-0 text-[1.1em] leading-none";

export interface FormActionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className" | "children"> {
  /** Énfasis visual, igual que en `Button`. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Con `href` actúa como enlace de acción (para acciones que navegan, p. ej.
   * "Cancelar" que vuelve al listado); sin `href` es un botón de formulario.
   */
  href?: string;
  /** Tipo del botón cuando no hay `href`. Por defecto `submit`. */
  type?: "submit" | "reset";
  isLoading?: boolean;
  /** Texto de la acción, ya traducido por quien llama. */
  children: ReactNode;
}

/**
 * Acción de formulario: el botón que envía o reinicia un formulario, o un
 * enlace con el mismo aspecto. Reutiliza `Button` y su cadena de utilidades —
 * ambos casos son visualmente idénticos. En la rama de enlace (`href`),
 * `disabled`/`isLoading` se comunican con `aria-disabled`, `tabIndex={-1}` y
 * puntero bloqueado, porque `<a>` no admite el atributo `disabled`.
 */
export const FormAction = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  FormActionProps
>(function FormAction(
  { variant = "primary", size = "md", type = "submit", isLoading = false, disabled = false, children, href, ...rest },
  ref,
): ReactElement {
  if (href !== undefined) {
    // Los manejadores de eventos de `rest` están tipados contra
    // HTMLButtonElement; en la rama de enlace el elemento es <a>. El cast es
    // seguro: los eventos DOM que llegan son los mismos.
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    // <a> no admite `disabled`: se comunica con aria-disabled, se saca del
    // orden de tabulación y se bloquea el puntero (data-disabled en buttonStyles).
    const isDisabled = disabled || isLoading;
    return (
      <a
        {...anchorProps}
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={buttonStyles()}
        data-variant={variant}
        data-size={size}
        data-disabled={isDisabled || undefined}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        tabIndex={isDisabled ? -1 : undefined}
      >
        {isLoading && <IconSpinner className={iconStyles} />}
        <span className="min-w-0">{children}</span>
      </a>
    );
  }

  return (
    <Button
      {...rest}
      ref={ref as Ref<HTMLButtonElement>}
      variant={variant}
      size={size}
      type={type}
      isLoading={isLoading}
      disabled={disabled}
    >
      {children}
    </Button>
  );
});
