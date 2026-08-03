import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className" | "onChange"> {
  /** Estado actual del interruptor (controlado). */
  checked: boolean;
  /** Notifica el nuevo estado al pulsar. */
  onChange: (checked: boolean) => void;
  /** Texto visible junto al interruptor. */
  label: ReactNode;
}

/**
 * Interruptor booleano accesible: `<button role="switch">` con `aria-checked`,
 * activable con click, Espacio y Enter (comportamiento nativo de `<button>`).
 * La pista y el pulgar son decorativos (`aria-hidden`); el estado lo anuncia
 * el propio botón.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onChange, label, disabled = false, id, ...rest },
  ref,
): ReactElement {
  const handleClick = () => {
    onChange(!checked);
  };

  return (
    <button
      {...rest}
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      data-checked={checked || undefined}
      className="group inline-flex cursor-pointer items-center gap-2 rounded-md font-sans focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-[var(--ink-border-strong)] px-0.5 transition-colors duration-fast group-data-[checked]:bg-accent group-disabled:bg-sunken"
      >
        <span
          className="size-4 rounded-full bg-surface shadow-sm transition-transform duration-fast group-data-[checked]:translate-x-4"
        />
      </span>
      <span className="text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-text group-disabled:text-[var(--ink-text-disabled)]">
        {label}
      </span>
    </button>
  );
});
