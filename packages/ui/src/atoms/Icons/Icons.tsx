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

/** Aviso general — triángulo con exclamación. Variante "warning" de `Chip`. */
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

/** Crítico — octógono de alto, como una señal de stop. Variante "critical" de `Chip`. */
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

/** Audio — nota musical. Tipo de medio "audio" de la biblioteca. */
export function IconAudio(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M7 13.5V5.2l8-1.7v9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Bien / correcto — círculo con marca de verificación. Variante "success" de `Chip`. */
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

/** Neutro — punto simple, sin connotación de riesgo. Variante "neutral" de `Chip`. */
export function IconDot(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="4.5" fill="currentColor" />
    </svg>
  );
}

/** Marca de verificación simple — estado marcado de checkboxes y opciones. */
export function IconCheck(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Despliegue — cheurón hacia abajo. Adorno de estado del `Selector`. */
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

/** Atrás — cheurón hacia la izquierda. Navegación temporal del `Calendar`. */
export function IconChevronLeft(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M12.5 5l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Adelante / detalle — cheurón hacia la derecha. Accesorio de `ItemList`. */
export function IconChevronRight(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M7.5 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cerrar / quitar — aspa. Botón de quitar del `Chip` eliminable. */
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

/** Más acciones — tres puntos verticales (⋮). Disparador de `TreeDots`. */
export function IconDotsVertical(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="4.5" r="1.4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Documento — hoja con esquina doblada. Tipo de medio "document" de la biblioteca. */
export function IconFile(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <path
        d="M5.5 2.5h5.8l3.2 3.2v11.8h-9V2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M11.3 2.5v3.2h3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Imagen — marco con sol y montañas. Tipo de medio "image" de la biblioteca. */
export function IconImage(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="7.4" cy="8.2" r="1.1" fill="currentColor" />
      <path
        d="M3.5 14l3.4-3.4 2.3 2.3 3.1-3.1 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Bandeja vacía — icono por defecto de estados vacíos. */
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

/** Vídeo — cámara de cine. Tipo de medio "video" de la biblioteca. */
export function IconVideo(props: IconProps): ReactElement {
  return (
    <svg {...base(props)}>
      <rect
        x="2.5"
        y="5.5"
        width="10.5"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M13 9.2l4.5-2.2v6l-4.5-2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
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
