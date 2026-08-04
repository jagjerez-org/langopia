import { forwardRef, useId, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { IconCheck } from "../Icons/Icons.js";

export interface MultiSelectorOption {
  value: string;
  /** Texto visible de la opción (ya traducido). */
  label: ReactNode;
  /** Ayuda contextual bajo la etiqueta de la opción. */
  hint?: ReactNode;
  disabled?: boolean;
}

export interface MultiSelectorProps {
  /** Texto de la etiqueta del grupo. Siempre visible. */
  label: ReactNode;
  /** Ayuda contextual bajo el grupo. Se oculta si hay `error`. */
  hint?: ReactNode;
  /** Mensaje de error ya traducido. Sustituye al `hint`. */
  error?: ReactNode;
  options: MultiSelectorOption[];
  /** Selección controlada: valores marcados. */
  value?: string[];
  /** Selección inicial (no controlado). */
  defaultValue?: string[];
  /** Notifica la lista completa de valores marcados tras cada cambio. */
  onChange?: (values: string[]) => void;
  /** Deshabilita todas las opciones a la vez. */
  disabled?: boolean;
  /** `name` común de los checkboxes, para envío de formulario nativo. */
  name?: string;
  id?: string;
}

const labelStyles =
  "inline-flex items-baseline gap-[0.2em] font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const checkboxStyles =
  "peer size-4 shrink-0 cursor-pointer appearance-none rounded border border-border-strong bg-surface transition-[border-color,background-color,box-shadow] duration-fast checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:checked:border-border disabled:checked:bg-[var(--ink-text-disabled)]";
const hintStyles = "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";

/**
 * Selección múltiple como lista de checkboxes nativos, a propósito: teclado
 * (Tab + Espacio) y lector de pantalla vienen gratis, y el envío de
 * formulario funciona sin JavaScript si se pasa `name`. El grupo se anuncia
 * con `role="group"` + `aria-labelledby`.
 *
 * Controlado (`value` + `onChange`) o no controlado (`defaultValue`).
 */
export const MultiSelector = forwardRef<HTMLDivElement, MultiSelectorProps>(function MultiSelector(
  { label, hint, error, options, value, defaultValue, onChange, disabled = false, name, id },
  ref,
): ReactElement {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const labelId = `${groupId}-label`;
  // El hint no se renderiza cuando hay error: no referenciarlo en aria-describedby.
  const hintId = hint && !error ? `${groupId}-hint` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
  const selected = isControlled ? value : internalValue;

  const toggleOption = (optionValue: string) => {
    const next = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue];
    if (!isControlled) {
      setInternalValue(next);
    }
    onChange?.(next);
  };

  return (
    <div ref={ref} className="flex w-full flex-col gap-1" data-disabled={disabled || undefined}>
      <span id={labelId} className={labelStyles}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="flex flex-col gap-2"
      >
        {options.map((option) => {
          const isDisabled = disabled || Boolean(option.disabled);
          return (
            <label
              key={option.value}
              data-disabled={isDisabled || undefined}
              className="flex items-start gap-2 data-[disabled]:cursor-not-allowed"
            >
              <span className="relative mt-0.5 inline-flex shrink-0">
                <input
                  type="checkbox"
                  className={checkboxStyles}
                  name={name}
                  value={option.value}
                  checked={selected.includes(option.value)}
                  disabled={isDisabled}
                  onChange={() => toggleOption(option.value)}
                />
                <IconCheck className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-text-inverse peer-checked:block" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  data-disabled={isDisabled || undefined}
                  className="cursor-pointer font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--ink-text-disabled)]"
                >
                  {option.label}
                </span>
                {option.hint && (
                  <span className="text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted">
                    {option.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {hint && !error && (
        <p id={hintId} className={hintStyles}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={errorStyles}>
          {error}
        </p>
      )}
    </div>
  );
});
