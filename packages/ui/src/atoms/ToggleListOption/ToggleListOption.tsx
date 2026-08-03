import { forwardRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Toggle } from "../Toggle/Toggle.js";

export interface ToggleListOptionProps {
  /** Texto de la opción (p. ej. el nombre de la columna a mostrar/ocultar). */
  label: ReactNode;
  /** Descripción secundaria bajo la etiqueta. */
  hint?: ReactNode;
  /** Estado actual de la opción (controlado). */
  checked: boolean;
  /** Notifica el nuevo estado al pulsar. */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Opción de lista con interruptor (p. ej. "Mostrar/ocultar columna" en un
 * selector de columnas). Es una fila con borde que envuelve un `Toggle`:
 * el estado también se refleja en la fila vía `data-checked` para poder
 * destacarla sin duplicar lógica.
 */
export const ToggleListOption = forwardRef<HTMLButtonElement, ToggleListOptionProps>(
  function ToggleListOption({ label, hint, checked, onChange, disabled = false }, ref): ReactElement {
    return (
      <div
        data-checked={checked || undefined}
        data-disabled={disabled || undefined}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 transition-[border-color,background-color] duration-fast data-[checked]:border-accent data-[checked]:bg-[var(--ink-accent-subtle-bg)] data-[disabled]:bg-sunken"
      >
        <Toggle
          ref={ref}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          label={
            <span className="flex min-w-0 flex-col gap-0.5">
              <span>{label}</span>
              {hint && (
                <span className="text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted">
                  {hint}
                </span>
              )}
            </span>
          }
        />
      </div>
    );
  },
);
