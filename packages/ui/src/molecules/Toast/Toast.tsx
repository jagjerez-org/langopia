import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCheckCircle,
  IconClose,
  IconDot,
} from "../../atoms/Icons/Icons.js";
import { ToastContext } from "./toast-context.js";
import type { ToastOptions, ToastVariant } from "./toast-context.js";

interface ToastRecord extends Required<Pick<ToastOptions, "variant" | "title" | "duration">> {
  id: string;
  description?: ReactNode;
}

/**
 * Icono por variante, compartido con `Chip`: la misma forma significa lo
 * mismo en todo el DS — el color nunca es la única señal.
 */
const ICON_BY_VARIANT: Record<ToastVariant, typeof IconDot> = {
  neutral: IconDot,
  success: IconCheckCircle,
  warning: IconAlertTriangle,
  critical: IconAlertOctagon,
};

/** Franja lateral de color por variante (cadenas estáticas: las lee Tailwind). */
const ACCENT_BY_VARIANT: Record<ToastVariant, string> = {
  neutral: "border-l-[var(--ink-neutral-soft-text)]",
  success: "border-l-success",
  warning: "border-l-warning",
  critical: "border-l-critical",
};

const ICON_COLOR_BY_VARIANT: Record<ToastVariant, string> = {
  neutral: "text-[var(--ink-neutral-soft-text)]",
  success: "text-success",
  warning: "text-warning",
  critical: "text-critical",
};

const toastStyles =
  "flex animate-[ink-toast-in_var(--ink-duration-slow)_var(--ink-ease-decelerate)] items-start gap-3 rounded-md border border-border border-l-[3px] bg-surface p-4 font-sans shadow-[var(--ink-shadow-md)]";

const closeButtonStyles =
  "inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center rounded-md border-none bg-transparent p-1 text-[var(--ink-text-tertiary)] transition-colors duration-fast hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export interface ToastProviderProps {
  children: ReactNode;
  /** Nombre accesible de la región donde aparecen los avisos. */
  label: string;
  /** Nombre accesible del botón de cerrar de cada aviso. */
  closeLabel: string;
}

export function ToastProvider({ children, label, closeLabel }: ToastProviderProps): ReactElement {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const id = crypto.randomUUID();
    const variant = options.variant ?? "neutral";
    // Un aviso crítico no desaparece solo: quien lo lee decide cuándo cerrarlo.
    const duration = options.duration ?? (variant === "critical" ? 0 : 6000);
    setToasts((current) => [
      ...current,
      { id, variant, title: options.title, description: options.description, duration },
    ]);
    return id;
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-6 bottom-6 z-[var(--ink-z-toast)] flex w-[min(24rem,calc(100vw-3rem))] max-w-full flex-col gap-3"
        role="region"
        aria-label={label}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} {...toast} closeLabel={closeLabel} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ToastItemProps extends ToastRecord {
  closeLabel: string;
  onDismiss: (id: string) => void;
}

function ToastItem({
  id,
  variant,
  title,
  description,
  duration,
  closeLabel,
  onDismiss,
}: ToastItemProps): ReactElement {
  const remainingMs = useRef(duration);
  const startedAt = useRef(0);
  const timerId = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    if (timerId.current !== undefined) window.clearTimeout(timerId.current);
    timerId.current = undefined;
  }, []);

  const start = useCallback(() => {
    if (!Number.isFinite(remainingMs.current) || remainingMs.current <= 0) return;
    startedAt.current = Date.now();
    timerId.current = window.setTimeout(() => onDismiss(id), remainingMs.current);
  }, [id, onDismiss]);

  // Pausa el descarte automático mientras el aviso tiene el puntero encima o
  // el foco de teclado dentro — quien lo está leyendo tiene tiempo de sobra.
  const pause = useCallback(() => {
    if (timerId.current === undefined) return;
    clear();
    remainingMs.current -= Date.now() - startedAt.current;
  }, [clear]);

  useEffect(() => {
    start();
    return clear;
  }, [start, clear]);

  const Icon = ICON_BY_VARIANT[variant];
  const isCritical = variant === "critical";

  return (
    <div
      className={`${toastStyles} ${ACCENT_BY_VARIANT[variant]}`}
      data-variant={variant}
      role={isCritical ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <Icon className={`mt-[0.15em] inline-flex shrink-0 text-[1.1em] leading-none ${ICON_COLOR_BY_VARIANT[variant]}`} />
      <div className="min-w-0 flex-1">
        <p className="m-0 break-words text-[length:var(--ink-text-base)] font-semibold text-text">{title}</p>
        {description && (
          <p className="m-0 mt-1 break-words text-[length:var(--ink-text-sm)] text-muted">{description}</p>
        )}
      </div>
      <button
        type="button"
        className={closeButtonStyles}
        onClick={() => onDismiss(id)}
        aria-label={closeLabel}
      >
        <IconClose />
      </button>
    </div>
  );
}
