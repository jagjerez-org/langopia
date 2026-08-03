import type { ReactElement, SVGProps } from "react";

/**
 * Iconos propios en SVG en línea, a propósito: el paquete no añade una
 * librería de iconos como dependencia por unos pocos trazos. Comparten
 * `currentColor` y `aria-hidden` — son decorativos, nunca el único portador
 * de significado.
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

/** Indicador de carga — arco que gira; respeta "reducir movimiento" vía la
 * regla global de `theme.css` (la animación se recorta a un fotograma). */
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
