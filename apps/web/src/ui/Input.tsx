import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import styles from "./Input.module.css";
import { IconSpinner } from "./icons.js";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Texto de la etiqueta. Siempre visible — nunca solo un `placeholder`. */
  label: ReactNode;
  /** Ayuda contextual bajo el control. Se oculta si hay `error`. */
  hint?: ReactNode;
  /**
   * Mensaje de error ya traducido (del catálogo del panel si hay `code`, del
   * `title` de la respuesta si no — esa decisión la toma quien llama, este
   * componente solo lo pinta). Su presencia marca el campo como inválido.
   */
  error?: ReactNode;
  /** Verificación asíncrona en curso (p. ej. comprobar disponibilidad). */
  isLoading?: boolean;
  leadingAdornment?: ReactNode;
  trailingAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    isLoading = false,
    leadingAdornment,
    trailingAdornment,
    disabled = false,
    required = false,
    id,
    type = "text",
    ...rest
  },
  ref,
): ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field} data-disabled={disabled || undefined}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
        {required && (
          <span aria-hidden="true" className={styles.requiredMark}>
            *
          </span>
        )}
      </label>
      <div className={styles.control} data-invalid={Boolean(error) || undefined}>
        {leadingAdornment && <span className={styles.adornment}>{leadingAdornment}</span>}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type={type}
          className={styles.input}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          aria-busy={isLoading || undefined}
        />
        {isLoading && <IconSpinner className={styles.statusIcon} />}
        {!isLoading && trailingAdornment && (
          <span className={styles.adornment}>{trailingAdornment}</span>
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
