import { forwardRef, useId } from "react";
import type { ReactElement, ReactNode, TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  /** Texto de la etiqueta. Siempre visible — nunca solo un `placeholder`. */
  label: ReactNode;
  /** Ayuda contextual bajo el control. Se oculta si hay `error`. */
  hint?: ReactNode;
  /**
   * Mensaje de error ya traducido. Su presencia marca el campo como inválido
   * (`aria-invalid`) y sustituye al `hint`.
   */
  error?: ReactNode;
}

const labelStyles =
  "inline-flex items-baseline gap-[0.2em] font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const controlStyles =
  "flex rounded-md border border-border bg-surface px-3 font-sans text-[length:var(--ink-text-base)] text-text shadow-sm transition-[border-color,box-shadow] duration-fast focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ink-accent-default)_25%,transparent)] data-[invalid]:border-critical data-[invalid]:focus-within:shadow-[0_0_0_3px_var(--ink-critical-bg)] group-data-[disabled]:bg-sunken";
const textareaStyles =
  "min-h-20 w-full min-w-0 resize-y border-none bg-transparent py-2 font-[inherit] text-inherit outline-none placeholder:text-[var(--ink-text-tertiary)] disabled:cursor-not-allowed";
const hintStyles = "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, disabled = false, required = false, id, rows = 3, ...rest },
  ref,
): ReactElement {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="group flex w-full flex-col gap-1" data-disabled={disabled || undefined}>
      <label htmlFor={textareaId} className={labelStyles}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-critical">
            *
          </span>
        )}
      </label>
      <div className={controlStyles} data-invalid={Boolean(error) || undefined}>
        <textarea
          {...rest}
          ref={ref}
          id={textareaId}
          rows={rows}
          className={textareaStyles}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
        />
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
