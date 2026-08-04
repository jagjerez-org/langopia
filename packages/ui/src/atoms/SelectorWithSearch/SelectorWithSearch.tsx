import { forwardRef, useId, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { IconCheck } from "../Icons/Icons.js";

export interface SelectorWithSearchOption {
  value: string;
  /** Texto de la opción. Es `string` (no `ReactNode`) a propósito: el filtro de búsqueda compara texto plano. */
  label: string;
  disabled?: boolean;
}

export interface SelectorWithSearchProps {
  /** Texto de la etiqueta. Siempre visible — nunca solo un `placeholder`. */
  label: ReactNode;
  options: SelectorWithSearchOption[];
  /** Selección controlada: `value` de la opción elegida. */
  value?: string;
  /** Selección inicial (no controlado). */
  defaultValue?: string;
  /** Notifica el `value` de la opción elegida. */
  onChange?: (value: string) => void;
  /** Placeholder del campo de búsqueda (ya traducido). */
  placeholder?: string;
  /** Texto cuando el filtro no devuelve ninguna opción (ya traducido). */
  noResultsLabel: ReactNode;
  /** Ayuda contextual bajo el control. Se oculta si hay `error`. */
  hint?: ReactNode;
  /** Mensaje de error ya traducido. Marca el campo como inválido y sustituye al `hint`. */
  error?: ReactNode;
  disabled?: boolean;
  id?: string;
}

const labelStyles =
  "inline-flex items-baseline gap-[0.2em] font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const inputStyles =
  "min-h-9 w-full rounded-md border border-border bg-surface px-3 py-2 font-sans text-[length:var(--ink-text-base)] text-text shadow-sm transition-[border-color,box-shadow] duration-fast placeholder:text-[var(--ink-text-tertiary)] focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ink-accent-default)_25%,transparent)] focus:outline-none data-[invalid]:border-critical data-[invalid]:focus:shadow-[0_0_0_3px_var(--ink-critical-bg)] disabled:cursor-not-allowed disabled:bg-sunken disabled:text-[var(--ink-text-disabled)]";
const listboxStyles =
  "absolute inset-x-0 top-full z-[var(--ink-z-dropdown)] mt-1 max-h-60 overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg";
const optionStyles =
  "flex cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 font-sans text-[length:var(--ink-text-base)] text-text data-[active]:bg-[var(--ink-accent-subtle-bg)] aria-disabled:cursor-not-allowed aria-disabled:text-[var(--ink-text-disabled)]";
const hintStyles = "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";

/**
 * Select de una opción con búsqueda: combobox accesible (patrón ARIA
 * "editable combobox with listbox popup"). El `<input>` lleva
 * `role="combobox"`, `aria-expanded`, `aria-controls` y
 * `aria-activedescendant`; las opciones viven en un `role="listbox"`.
 *
 * Teclado: ↑/↓ mueven la opción activa, Enter la elige, Escape cierra y
 * restaura el texto de la selección, y al teclear se filtra la lista.
 * Controlado (`value` + `onChange`) o no controlado (`defaultValue`).
 */
export const SelectorWithSearch = forwardRef<HTMLInputElement, SelectorWithSearchProps>(
  function SelectorWithSearch(
    {
      label,
      options,
      value,
      defaultValue,
      onChange,
      placeholder,
      noResultsLabel,
      hint,
      error,
      disabled = false,
      id,
    },
    ref,
  ): ReactElement {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const labelId = `${inputId}-label`;
    const listboxId = `${inputId}-listbox`;
    // El hint no se renderiza cuando hay error: no referenciarlo en aria-describedby.
    const hintId = hint && !error ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
    const selectedValue = isControlled ? value : internalValue;
    const selectedOption = options.find((option) => option.value === selectedValue);

    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredOptions = normalizedQuery
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
      : options;
    const activeOption = isOpen ? filteredOptions[activeIndex] : undefined;

    /** Abre la lista y limpia el filtro: se muestran todas las opciones. */
    const openList = () => {
      setIsOpen(true);
      setQuery("");
      setActiveIndex(0);
    };

    /** Cierra y limpia el filtro; el texto mostrado vuelve a derivarse de la selección. */
    const closeList = () => {
      setIsOpen(false);
      setQuery("");
    };

    const selectOption = (option: SelectorWithSearchOption) => {
      if (!isControlled) {
        setInternalValue(option.value);
      }
      onChange?.(option.value);
      closeList();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            openList();
          } else {
            setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (isOpen) {
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          break;
        case "Enter":
          if (isOpen) {
            event.preventDefault();
            // Una opción deshabilitada puede quedar activa con las flechas;
            // Enter simplemente no la elige.
            if (activeOption && !activeOption.disabled) {
              selectOption(activeOption);
            }
          }
          break;
        case "Escape":
          if (isOpen) {
            event.preventDefault();
            closeList();
          }
          break;
      }
    };

    return (
      <div className="flex w-full flex-col gap-1" data-disabled={disabled || undefined}>
        <label id={labelId} htmlFor={inputId} className={labelStyles}>
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="text"
            role="combobox"
            className={inputStyles}
            // Abierto muestra el filtro que teclea quien usa el control;
            // cerrado muestra el texto de la opción elegida.
            value={isOpen ? query : (selectedOption?.label ?? "")}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeOption ? `${inputId}-option-${activeOption.value}` : undefined
            }
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            data-invalid={Boolean(error) || undefined}
            // Abre con click, tecleo o ↓ — no con focus: tabular por el
            // formulario no debe desplegar la lista.
            onClick={() => {
              if (!isOpen) {
                openList();
              }
            }}
            onBlur={closeList}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
          />
          {isOpen && (
            <ul role="listbox" id={listboxId} aria-labelledby={labelId} className={listboxStyles}>
              {filteredOptions.length === 0 && (
                <li role="presentation" className="px-3 py-2 text-[length:var(--ink-text-sm)] text-muted">
                  {noResultsLabel}
                </li>
              )}
              {filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  id={`${inputId}-option-${option.value}`}
                  aria-selected={option.value === selectedValue}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === activeIndex || undefined}
                  className={optionStyles}
                  // mousedown en vez de click para no robar el foco al input:
                  // así el combobox no se cierra antes de tiempo por el blur.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!option.disabled) {
                      selectOption(option);
                    }
                  }}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {option.value === selectedValue && (
                    <IconCheck className="inline-flex shrink-0 text-accent" />
                  )}
                </li>
              ))}
            </ul>
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
  },
);
