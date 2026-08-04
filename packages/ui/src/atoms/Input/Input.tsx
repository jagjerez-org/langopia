import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { IconSpinner } from "../Icons/Icons.js";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Texto de la etiqueta. Siempre visible — nunca solo un `placeholder`. */
  label: ReactNode;
  /** Ayuda contextual bajo el control. Se oculta si hay `error`. */
  hint?: ReactNode;
  /**
   * Mensaje de error ya traducido. Su presencia marca el campo como inválido
   * (`aria-invalid`) y sustituye al `hint`.
   */
  error?: ReactNode;
  /** Verificación asíncrona en curso (p. ej. comprobar disponibilidad). */
  isLoading?: boolean;
  leadingAdornment?: ReactNode;
  trailingAdornment?: ReactNode;
}

const labelStyles =
  "inline-flex items-baseline gap-[0.2em] font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const controlStyles =
  "flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 font-sans text-[length:var(--ink-text-base)] text-text shadow-sm transition-[border-color,box-shadow] duration-fast focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ink-accent-default)_25%,transparent)] data-[invalid]:border-critical data-[invalid]:focus-within:shadow-[0_0_0_3px_var(--ink-critical-bg)] group-data-[disabled]:bg-sunken";
const inputStyles =
  "min-w-0 flex-1 border-none bg-transparent py-2 font-[inherit] text-inherit outline-none placeholder:text-[var(--ink-text-tertiary)] disabled:cursor-not-allowed";
const adornmentStyles = "inline-flex shrink-0 items-center text-[var(--ink-text-tertiary)]";
const hintStyles = "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";

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
  // El hint no se renderiza cuando hay error: no referenciarlo en aria-describedby.
  const hintId = hint && !error ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="group flex w-full flex-col gap-1" data-disabled={disabled || undefined}>
      <label htmlFor={inputId} className={labelStyles}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-critical">
            *
          </span>
        )}
      </label>
      <div className={controlStyles} data-invalid={Boolean(error) || undefined}>
        {leadingAdornment && <span className={adornmentStyles}>{leadingAdornment}</span>}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type={type}
          className={inputStyles}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          aria-busy={isLoading || undefined}
        />
        {isLoading && <IconSpinner className={adornmentStyles} />}
        {!isLoading && trailingAdornment && (
          <span className={adornmentStyles}>{trailingAdornment}</span>
        )}
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
