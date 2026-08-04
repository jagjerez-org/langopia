import { forwardRef, useId } from "react";
import type { ReactElement, ReactNode, SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";
import { IconChevronDown, IconSpinner } from "./icons.js";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Opciones cargando desde la API: deshabilita el control y muestra un giro
   * en vez del acento visual habitual, sin inventar un texto "cargando". */
  isLoading?: boolean;
  /** Opción inicial deshabilitada — value="" — para pedir una elección explícita. */
  placeholder?: ReactNode;
  options: SelectOption[];
}

/**
 * `<select>` nativo, no un listbox propio: el navegador ya resuelve teclado
 * (flechas, tipar para saltar a una opción, Escape) y lectores de pantalla
 * de forma consistente. Reinventar eso como un combobox ARIA a mano es mucho
 * riesgo de accesibilidad para lo que pide esta tarea.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    isLoading = false,
    placeholder,
    options,
    disabled = false,
    required = false,
    id,
    ...rest
  },
  ref,
): ReactElement {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field} data-disabled={disabled || undefined}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
        {required && (
          <span aria-hidden="true" className={styles.requiredMark}>
            *
          </span>
        )}
      </label>
      <div className={styles.control} data-invalid={Boolean(error) || undefined}>
        <select
          {...rest}
          ref={ref}
          id={selectId}
          className={styles.select}
          disabled={disabled || isLoading}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          aria-busy={isLoading || undefined}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {isLoading ? (
          <IconSpinner className={styles.statusIcon} />
        ) : (
          <IconChevronDown className={styles.statusIcon} />
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
});
