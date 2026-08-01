import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import styles from "./Button.module.css";
import { IconSpinner } from "./icons.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className"> {
  /** Énfasis visual. `danger` es para acciones destructivas (cancelar, borrar). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * En curso: añade un `IconSpinner` y fija `aria-busy` y `disabled`. El
   * texto del botón (`children`) se mantiene visible a propósito — nunca se
   * sustituye por un literal genérico tipo "Cargando…": si la pantalla
   * necesita anunciar el progreso por voz, lo hace con su propio texto
   * traducido en otro lugar (p. ej. una región `aria-live`).
   */
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  type?: "button" | "submit" | "reset";
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    disabled = false,
    leadingIcon,
    trailingIcon,
    type = "button",
    children,
    ...rest
  },
  ref,
): ReactElement {
  const isDisabled = disabled || isLoading;
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={styles.button}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <IconSpinner className={styles.icon} />
      ) : (
        leadingIcon && <span className={styles.icon}>{leadingIcon}</span>
      )}
      <span className={styles.label}>{children}</span>
      {!isLoading && trailingIcon && <span className={styles.icon}>{trailingIcon}</span>}
    </button>
  );
});
