import type { ReactElement, SVGProps } from "react";

/**
 * Iconos propios en SVG en línea, a propósito: la Tarea 4 no añade una
 * librería de iconos como dependencia por media docena de trazos. Todos
 * comparten viewBox 0 0 20 20, `currentColor` y `aria-hidden` — son
 * decorativos, nunca el único portador de significado (ver `Tag`, donde el
 * texto siempre acompaña al icono y al color).
 */
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 20 20",
    width: "1em",
    height: "1em",
    fill: "none",
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

/** Aviso general — triángulo con exclamación. Usado por el estado "warning". */
export function IconAlertTriangle(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M8.68 3.36c.57-1.02 2.07-1.02 2.64 0l6.14 10.94c.55.98-.16 2.2-1.32 2.2H3.86c-1.16 0-1.87-1.22-1.32-2.2L8.68 3.36Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 7.9v3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14.1" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Crítico — octógono de alto, como una señal de stop. */
export function IconAlertOctagon(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M6.6 2.5h6.8l4.6 4.6v6.8l-4.6 4.6H6.6L2 13.9V7.1L6.6 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 6.8v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="13.4" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Bien / correcto — círculo con marca de verificación. */
export function IconCheckCircle(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.8 10.2l2.1 2.1 4.3-4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Neutro — punto simple, sin connotación de riesgo. */
export function IconDot(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="4.5" fill="currentColor" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClose(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M5.5 5.5l9 9m0-9l-9 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Bandeja vacía — icono por defecto de `EmptyState`. */
export function IconInbox(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M3 11.5l2.1-6.3A1.5 1.5 0 0 1 6.5 4h7a1.5 1.5 0 0 1 1.4 1.2l2.1 6.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5h4.2l.9 1.8h3.8l.9-1.8H17v3a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Indicador de carga — arco que gira; respeta "reducir movimiento" vía CSS
 * global en `tokens.css` (la animación se recorta a un fotograma). */
export function IconSpinner(props: IconProps): ReactElement {
  return (
    <svg {...base(props)} className={["ink-spin", props.className].filter(Boolean).join(" ")}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
