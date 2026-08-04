import { forwardRef } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCheckCircle,
  IconClose,
  IconDot,
} from "../Icons/Icons.js";

export type ChipVariant = "neutral" | "accent" | "success" | "warning" | "critical";

export interface ChipProps {
  /** Color/estado semántico de la etiqueta. */
  variant?: ChipVariant;
  /** Texto de la etiqueta (ya traducido). */
  children: ReactNode;
  /**
   * Si se pasa, el chip muestra un botón de quitar (✕) y se considera
   * eliminable. Requiere `removeLabel` para nombrar ese botón.
   */
  onRemove?: () => void;
  /** Nombre accesible del botón de quitar (ya traducido, p. ej. "Quitar nivel B2"). */
  removeLabel?: string;
  disabled?: boolean;
}

/**
 * Cada variante semántica lleva su propia forma de icono, fija, además del
 * color: un punto neutro, una marca de verificación, un triángulo de aviso y
 * un octógono crítico son distinguibles entre sí sin depender del matiz —
 * el color nunca es la única señal. La variante `accent` (selección/énfasis,
 * sin lectura de estado) no lleva icono.
 */
const ICON_BY_VARIANT: Record<ChipVariant, typeof IconDot | null> = {
  neutral: IconDot,
  accent: null,
  success: IconCheckCircle,
  warning: IconAlertTriangle,
  critical: IconAlertOctagon,
};

const chipStyles = [
  // Base: pastilla compacta, sin heredar márgenes del texto.
  "inline-flex w-fit max-w-full items-center gap-1 rounded-full font-sans text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium px-2.5 py-0.5",
  // Variantes: fondo suave + texto del mismo tono (pares con contraste AA).
  "data-[variant=neutral]:bg-[var(--ink-neutral-soft-bg)] data-[variant=neutral]:text-[var(--ink-neutral-soft-text)]",
  "data-[variant=accent]:bg-[var(--ink-accent-subtle-bg)] data-[variant=accent]:text-[var(--ink-accent-subtle-text)]",
  "data-[variant=success]:bg-success-bg data-[variant=success]:text-success",
  "data-[variant=warning]:bg-warning-bg data-[variant=warning]:text-warning",
  "data-[variant=critical]:bg-critical-bg data-[variant=critical]:text-critical",
].join(" ");

const iconStyles = "inline-flex shrink-0 text-[1.1em] leading-none";

const removeStyles =
  "inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-none bg-transparent p-0 text-[1em] leading-none text-current opacity-70 transition-opacity duration-fast not-disabled:hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Etiqueta compacta para estados, categorías o valores seleccionados. Es un
 * `<span>` informativo; la única acción posible es quitarlo (`onRemove`),
 * que se expone como un `<button>` propio con nombre accesible.
 */
export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { variant = "neutral", children, onRemove, removeLabel, disabled = false },
  ref,
): ReactElement {
  const Icon = ICON_BY_VARIANT[variant];
  return (
    <span ref={ref} className={chipStyles} data-variant={variant} data-disabled={disabled || undefined}>
      {Icon && <Icon className={iconStyles} />}
      <span className="min-w-0 truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          className={removeStyles}
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
        >
          <IconClose />
        </button>
      )}
    </span>
  );
});
