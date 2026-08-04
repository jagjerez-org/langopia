import { forwardRef, useId, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { Chip } from "../Chip/Chip.js";
import type { SelectorWithSearchOption } from "../SelectorWithSearch/SelectorWithSearch.js";

export interface MultiSelectorWithSearchProps {
  /** Texto de la etiqueta. Siempre visible — nunca solo un `placeholder`. */
  label: ReactNode;
  options: SelectorWithSearchOption[];
  /** Selección controlada: valores elegidos. */
  value?: string[];
  /** Selección inicial (no controlado). */
  defaultValue?: string[];
  /** Notifica la lista completa de valores elegidos tras cada cambio. */
  onChange?: (values: string[]) => void;
  /** Placeholder del campo de búsqueda (ya traducido). */
  placeholder?: string;
  /** Texto cuando el filtro no devuelve ninguna opción (ya traducido). */
  noResultsLabel: ReactNode;
  /** Nombre accesible del botón de quitar de cada chip (ya traducido, p. ej. `Quitar ${opción}`). */
  getRemoveLabel: (option: SelectorWithSearchOption) => string;
  /** Ayuda contextual bajo el control. Se oculta si hay `error`. */
  hint?: ReactNode;
  /** Mensaje de error ya traducido. Marca el campo como inválido y sustituye al `hint`. */
  error?: ReactNode;
  disabled?: boolean;
  id?: string;
}

const labelStyles =
  "inline-flex items-baseline gap-[0.2em] font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-text";
const controlStyles =
  "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 shadow-sm transition-[border-color,box-shadow] duration-fast focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ink-accent-default)_25%,transparent)] data-[invalid]:border-critical data-[invalid]:focus-within:shadow-[0_0_0_3px_var(--ink-critical-bg)] group-data-[disabled]:bg-sunken";
const inputStyles =
  "min-w-[10ch] flex-1 border-none bg-transparent py-1 font-sans text-[length:var(--ink-text-base)] text-text outline-none placeholder:text-[var(--ink-text-tertiary)] disabled:cursor-not-allowed";
const listboxStyles =
  "absolute inset-x-0 top-full z-[var(--ink-z-dropdown)] mt-1 max-h-60 overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg";
const optionStyles =
  "flex cursor-pointer items-center gap-2 rounded px-3 py-2 font-sans text-[length:var(--ink-text-base)] text-text data-[active]:bg-[var(--ink-accent-subtle-bg)] aria-disabled:cursor-not-allowed aria-disabled:text-[var(--ink-text-disabled)]";
const hintStyles = "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";

/**
 * Selección múltiple con búsqueda: combobox accesible cuyos valores elegidos
 * se muestran como `Chip` eliminables dentro del propio control. Las opciones
 * ya elegidas desaparecen de la lista — añadir dos veces el mismo valor no
 * tiene sentido — y se quitan con el botón ✕ del chip o con Retroceso cuando
 * el campo de búsqueda está vacío.
 *
 * Teclado: ↑/↓ mueven la opción activa, Enter la añade, Escape cierra,
 * Retroceso (con el campo vacío) quita la última elegida.
 * Controlado (`value` + `onChange`) o no controlado (`defaultValue`).
 */
export const MultiSelectorWithSearch = forwardRef<HTMLInputElement, MultiSelectorWithSearchProps>(
  function MultiSelectorWithSearch(
    {
      label,
      options,
      value,
      defaultValue,
      onChange,
      placeholder,
      noResultsLabel,
      getRemoveLabel,
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
    const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
    const selectedValues = isControlled ? value : internalValue;
    const selectedOptions = selectedValues
      .map((selected) => options.find((option) => option.value === selected))
      .filter((option): option is SelectorWithSearchOption => option !== undefined);

    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredOptions = options.filter(
      (option) =>
        !selectedValues.includes(option.value) &&
        (normalizedQuery === "" ||
          option.label.toLocaleLowerCase().includes(normalizedQuery)),
    );
    const activeOption = isOpen ? filteredOptions[activeIndex] : undefined;

    const commit = (next: string[]) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onChange?.(next);
    };

    const addOption = (option: SelectorWithSearchOption) => {
      commit([...selectedValues, option.value]);
      // La lista sigue abierta para encadenar varias elecciones.
      setQuery("");
      setActiveIndex(0);
    };

    const removeOption = (optionValue: string) => {
      commit(selectedValues.filter((selected) => selected !== optionValue));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setActiveIndex(0);
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
            // Enter simplemente no la añade.
            if (activeOption && !activeOption.disabled) {
              addOption(activeOption);
            }
          }
          break;
        case "Escape":
          if (isOpen) {
            event.preventDefault();
            setIsOpen(false);
          }
          break;
        case "Backspace":
          if (query === "" && selectedValues.length > 0) {
            const last = selectedValues[selectedValues.length - 1];
            if (last !== undefined) {
              removeOption(last);
            }
          }
          break;
      }
    };

    return (
      <div
        className="group flex w-full flex-col gap-1"
        data-disabled={disabled || undefined}
      >
        <label id={labelId} htmlFor={inputId} className={labelStyles}>
          {label}
        </label>
        <div className="relative">
          <div className={controlStyles} data-invalid={Boolean(error) || undefined}>
            {selectedOptions.map((option) => (
              <Chip
                key={option.value}
                onRemove={() => removeOption(option.value)}
                removeLabel={getRemoveLabel(option)}
                disabled={disabled}
              >
                {option.label}
              </Chip>
            ))}
            <input
              ref={ref}
              id={inputId}
              type="text"
              role="combobox"
              className={inputStyles}
              value={query}
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
              // Abre con click, tecleo o ↓ — no con focus: tabular por el
              // formulario no debe desplegar la lista.
              onClick={() => {
                if (!isOpen) {
                  setIsOpen(true);
                  setActiveIndex(0);
                }
              }}
              onBlur={() => setIsOpen(false)}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                if (!isOpen) {
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          {isOpen && (
            <ul
              role="listbox"
              id={listboxId}
              aria-labelledby={labelId}
              aria-multiselectable="true"
              className={listboxStyles}
            >
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
                  aria-selected="false"
                  aria-disabled={option.disabled || undefined}
                  data-active={index === activeIndex || undefined}
                  className={optionStyles}
                  // mousedown en vez de click para no robar el foco al input:
                  // así el combobox no se cierra antes de tiempo por el blur.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!option.disabled) {
                      addOption(option);
                    }
                  }}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
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
