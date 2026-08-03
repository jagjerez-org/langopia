import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { IconSpinner } from "../Icons/Icons.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Cadena de clases del botón, compartida con `FormAction` para que el caso
 * "enlace de acción" (`<a>`) tenga exactamente el mismo aspecto sin duplicar
 * utilidades. Las variantes y tamaños se resuelven con selectores
 * `data-[variant=…]` / `data-[size=…]`, por lo que la cadena es estática.
 */
export function buttonStyles(): string {
  return [
    // Base: reinicio del <button> nativo + layout + foco visible.
    "inline-flex cursor-pointer appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-sans font-semibold no-underline transition-[background-color,border-color,color,transform] duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:not-disabled:scale-[0.98] disabled:cursor-not-allowed",
    // Tamaños.
    "data-[size=sm]:min-h-8 data-[size=sm]:px-3 data-[size=sm]:text-[length:var(--ink-text-sm)]",
    "data-[size=md]:min-h-9 data-[size=md]:px-4 data-[size=md]:text-[length:var(--ink-text-base)]",
    "data-[size=lg]:min-h-11 data-[size=lg]:px-5 data-[size=lg]:text-[length:var(--ink-text-md)]",
    // Variante primary: casi negro (tokens --ink-primary-solid-*).
    "data-[variant=primary]:bg-primary data-[variant=primary]:text-primary-text data-[variant=primary]:not-disabled:hover:bg-[var(--ink-primary-solid-hover)] data-[variant=primary]:not-disabled:active:bg-[var(--ink-primary-solid-active)] data-[variant=primary]:disabled:bg-sunken data-[variant=primary]:disabled:text-[var(--ink-text-disabled)]",
    // Variante secondary: «outline» — superficie con borde sutil.
    "data-[variant=secondary]:border-border data-[variant=secondary]:bg-surface data-[variant=secondary]:text-text data-[variant=secondary]:shadow-sm data-[variant=secondary]:not-disabled:hover:bg-surface-secondary data-[variant=secondary]:not-disabled:active:bg-sunken data-[variant=secondary]:disabled:text-[var(--ink-text-disabled)]",
    // Variante ghost: transparente hasta el hover.
    "data-[variant=ghost]:bg-transparent data-[variant=ghost]:text-muted data-[variant=ghost]:not-disabled:hover:bg-surface-secondary data-[variant=ghost]:not-disabled:hover:text-text data-[variant=ghost]:not-disabled:active:bg-sunken data-[variant=ghost]:disabled:text-[var(--ink-text-disabled)]",
    // Variante danger: acciones destructivas.
    "data-[variant=danger]:bg-[var(--ink-critical-solid)] data-[variant=danger]:text-text-inverse data-[variant=danger]:not-disabled:hover:bg-[var(--ink-critical-solid-hover)] data-[variant=danger]:not-disabled:active:bg-[var(--ink-critical-solid-active)] data-[variant=danger]:disabled:bg-sunken data-[variant=danger]:disabled:text-[var(--ink-text-disabled)]",
  ].join(" ");
}

const iconStyles = "inline-flex shrink-0 text-[1.1em] leading-none";

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
      className={buttonStyles()}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <IconSpinner className={iconStyles} />
      ) : (
        leadingIcon && <span className={iconStyles}>{leadingIcon}</span>
      )}
      <span className="min-w-0">{children}</span>
      {!isLoading && trailingIcon && <span className={iconStyles}>{trailingIcon}</span>}
    </button>
  );
});
