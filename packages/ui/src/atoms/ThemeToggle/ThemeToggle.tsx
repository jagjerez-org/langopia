import type { Theme } from "../../lib/theme.js";

export type ThemeToggleLabels = {
  light: string;
  dark: string;
};

export type ThemeToggleProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
  labels: ThemeToggleLabels;
};

/**
 * Interruptor accesible para alternar entre el tema claro y oscuro.
 *
 * Los textos se reciben íntegramente por props (`labels`) para mantener el
 * componente libre de literales de UI y facilitar la traducción en las apps
 * consumidoras.
 */
export function ThemeToggle({ value, onChange, labels }: ThemeToggleProps) {
  const isDark = value === "dark";
  const label = isDark ? labels.dark : labels.light;

  const handleClick = () => {
    const next: Theme = isDark ? "light" : "dark";
    onChange(next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isDark}
      aria-label={label}
      className="inline-flex items-center rounded-full border border-border bg-surface p-1 shadow-sm transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden="true"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-fast ${
          !isDark
            ? "bg-primary text-primary-text"
            : "text-muted"
        }`}
      >
        {labels.light}
      </span>
      <span
        aria-hidden="true"
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-fast ${
          isDark
            ? "bg-primary text-primary-text"
            : "text-muted"
        }`}
      >
        {labels.dark}
      </span>
    </button>
  );
}
