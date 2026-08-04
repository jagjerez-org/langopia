import { forwardRef, useId } from "react";
import type { ReactElement, ReactNode, SelectHTMLAttributes } from "react";
import { IconChevronDown, IconSpinner } from "../Icons/Icons.js";

export interface SelectorOption {
  value: string;
  /** Texto visible de la opción (ya traducido). */
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectorProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> {
  /** Texto de la etiqueta. Siempre visible — nunca solo un `placeholder`. */
  label: ReactNode;
  /** Ayuda contextual bajo el control. Se oculta si hay `error`. */
  hint?: ReactNode;
  /** Mensaje de error ya traducido. Marca el campo como inválido y sustituye al `hint`. */
  error?: ReactNode;
  /** Opciones cargando: deshabilita el control y muestra un giro en vez del cheurón. */
  isLoading?: boolean;
  /** Opción inicial deshabilitada (`value=""`) para pedir una elección explícita. */
  placeholder?: string;
  options: SelectorOption[];
}

const labelStyles =
  "inline-flex items-baseline gap-[0.2em] font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const selectStyles =
  "min-h-9 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface py-2 pl-3 pr-9 font-sans text-[length:var(--ink-text-base)] text-text shadow-sm transition-[border-color,box-shadow] duration-fast focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ink-accent-default)_25%,transparent)] focus:outline-none data-[invalid]:border-critical data-[invalid]:focus:shadow-[0_0_0_3px_var(--ink-critical-bg)] disabled:cursor-not-allowed disabled:bg-sunken disabled:text-[var(--ink-text-disabled)]";
const adornmentStyles =
  "pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-[var(--ink-text-tertiary)]";
const hintStyles = "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";

/**
 * Select de una opción sobre `<select>` nativo, a propósito: el navegador ya
 * resuelve teclado (flechas, teclear para saltar, Escape) y lectores de
 * pantalla de forma consistente. Reinventarlo como listbox propio sería mucho
 * riesgo de accesibilidad para lo que necesita este átomo — el cheurón es
 * decorativo y el control conserva el comportamiento nativo.
 *
 * Controlado (`value` + `onChange`) o no controlado (`defaultValue`), como
 * cualquier `<select>`.
 */
export const Selector = forwardRef<HTMLSelectElement, SelectorProps>(function Selector(
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
  // El hint no se renderiza cuando hay error: no referenciarlo en aria-describedby.
  const hintId = hint && !error ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  // Un <select> nativo salta la primera opción deshabilitada y selecciona la
  // primera habilitada: sin un valor inicial explícito, el placeholder nunca
  // llega a mostrarse. Si el caller no controla el valor, forzamos la opción
  // vacía como selección inicial.
  const { value, defaultValue, ...selectRest } = rest;
  const uncontrolledDefault =
    placeholder !== undefined && value === undefined && defaultValue === undefined
      ? ""
      : defaultValue;

  return (
    <div className="group flex w-full flex-col gap-1" data-disabled={disabled || undefined}>
      <label htmlFor={selectId} className={labelStyles}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-critical">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <select
          {...selectRest}
          ref={ref}
          id={selectId}
          value={value}
          defaultValue={uncontrolledDefault}
          className={selectStyles}
          disabled={disabled || isLoading}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          aria-busy={isLoading || undefined}
          data-invalid={Boolean(error) || undefined}
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
        <span aria-hidden="true" className={adornmentStyles}>
          {isLoading ? <IconSpinner /> : <IconChevronDown />}
        </span>
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
