import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";

export interface RadioButtonProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  /** Texto de la etiqueta, visible junto al control. */
  label: ReactNode;
  /** Ayuda contextual bajo la etiqueta. */
  hint?: ReactNode;
}

/**
 * Radio accesible con etiqueta visible. El control es un `<input type="radio">`
 * nativo (navegación por teclado y agrupación por `name` gratis); el aspecto
 * se personaliza con `appearance-none` y el truco del borde grueso en estado
 * `checked` para dibujar el punto interior.
 */
export const RadioButton = forwardRef<HTMLInputElement, RadioButtonProps>(function RadioButton(
  { label, hint, disabled = false, required = false, id, ...rest },
  ref,
): ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="group flex items-start gap-2" data-disabled={disabled || undefined}>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        type="radio"
        disabled={disabled}
        required={required}
        aria-describedby={hintId}
        className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface transition-[border-color,box-shadow] duration-fast checked:border-[5px] checked:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:checked:border-[var(--ink-text-disabled)]"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={inputId}
          className="cursor-pointer font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text group-data-[disabled]:cursor-not-allowed group-data-[disabled]:text-[var(--ink-text-disabled)]"
        >
          {label}
        </label>
        {hint && (
          <p
            id={hintId}
            className="m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted"
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
});
