import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Contexto y hook de `Toast` en su propio fichero, separados de
 * `Toast.tsx`: un fichero que exporta un componente (`ToastProvider`) y un
 * hook (`useToast`) a la vez rompe el Fast Refresh de Vite en la app que los
 * consume.
 */
export type ToastVariant = "neutral" | "success" | "warning" | "critical";

export interface ToastOptions {
  variant?: ToastVariant;
  title: ReactNode;
  description?: ReactNode;
  /** Milisegundos hasta descartarse solo. `0` lo deja fijo hasta que alguien lo cierre. */
  duration?: number;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return ctx;
}
