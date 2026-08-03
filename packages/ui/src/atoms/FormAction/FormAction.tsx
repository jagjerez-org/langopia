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
 * ambos casos son visualmente idénticos.
 */
export const FormAction = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  FormActionProps
>(function FormAction(
  { variant = "primary", size = "md", type = "submit", isLoading = false, children, href, ...rest },
  ref,
): ReactElement {
  if (href !== undefined) {
    // Los manejadores de eventos de `rest` están tipados contra
    // HTMLButtonElement; en la rama de enlace el elemento es <a>. El cast es
    // seguro: los eventos DOM que llegan son los mismos.
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        {...anchorProps}
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={buttonStyles()}
        data-variant={variant}
        data-size={size}
      >
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
    >
      {children}
    </Button>
  );
});
