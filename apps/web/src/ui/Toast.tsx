import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import styles from "./Toast.module.css";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCheckCircle,
  IconClose,
  IconDot,
} from "./icons.js";
import { ToastContext } from "./toast-context.js";
import type { ToastOptions, ToastVariant } from "./toast-context.js";

interface ToastRecord extends Required<Pick<ToastOptions, "variant" | "title" | "duration">> {
  id: string;
  description?: ReactNode;
}

/** Icono compartido con `Tag`: la misma forma significa lo mismo en toda la app. */
const ICON_BY_VARIANT: Record<ToastVariant, typeof IconDot> = {
  neutral: IconDot,
  success: IconCheckCircle,
  warning: IconAlertTriangle,
  critical: IconAlertOctagon,
};

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
      <div className={styles.viewport} role="region" aria-label={label}>
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
      className={styles.toast}
      data-variant={variant}
      role={isCritical ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <Icon className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={() => onDismiss(id)}
        aria-label={closeLabel}
      >
        <IconClose />
      </button>
    </div>
  );
}
