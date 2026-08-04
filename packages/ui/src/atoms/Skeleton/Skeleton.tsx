import type { ReactElement } from "react";
import { cx } from "../../lib/cx.js";

export type SkeletonVariant = "text" | "circle" | "rect";

/**
 * Alturas predefinidas para `variant="rect"`. El legacy (`apps/app/src/ui`)
 * admitía cualquier medida por estilo inline; el DS no usa estilos inline, así
 * que las alturas habituales se fijan en la escala de espaciado. Equivalencia
 * con las medidas que usa la app: `xs` = 4rem, `sm` = 12rem, `md` = 16rem,
 * `lg` = 20rem, `xl` = 32rem. Para cualquier otra medida, `className`.
 */
export type SkeletonHeight = "xs" | "sm" | "md" | "lg" | "xl";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Solo con `variant="text"`: número de renglones (el último se acorta, como texto real). */
  lines?: number;
  /** Solo con `variant="rect"`: altura predefinida; sin ella llena el contenedor. */
  height?: SkeletonHeight;
  /**
   * Dimensiones del placeholder como utilidades Tailwind (`w-2/5`, `h-2`,
   * `h-[var(--ink-text-3xl)]`…). Excepción documentada a la regla del DS de no
   * aceptar `className` libre: un marcador de posición imita la medida de lo
   * que sustituye, y esa medida la conoce solo quien lo coloca. Cuando se
   * pasa, SUSTITUYE al ancho por defecto (`w-full`, o `w-[70%]` en el último
   * renglón de texto), no se suma — así no hay dos clases de ancho compitiendo
   * por especificidad. Solo para dimensiones: el aspecto (color, barrido,
   * forma) no es negociable.
   */
  className?: string;
}

// Base: gradiente con barrido (keyframe `ink-skeleton-shimmer`, en theme.css).
const blockStyles =
  "block animate-[ink-skeleton-shimmer_1.4s_ease-in-out_infinite] bg-[linear-gradient(100deg,var(--ink-bg-sunken)_30%,var(--ink-border-default)_50%,var(--ink-bg-sunken)_70%)] bg-[length:200%_100%]";

/**
 * Forma por variante como clases planas, NO como selectores
 * `data-[variant=…]`: un selector con atributo (especificidad 0,2,0) ganaría
 * siempre al `w-[70%]` del último renglón y a cualquier `className` (0,1,0) —
 * fue el bug del `w-[70%]` muerto. Los anchos por defecto se añaden aparte y
 * solo cuando no hay `className`.
 */
const shapeByVariant: Record<SkeletonVariant, string> = {
  text: "h-[0.85em] rounded-sm",
  circle: "h-10 w-10 rounded-full",
  rect: "rounded-md",
};

// Alturas predefinidas del rectángulo (sin `height`, llena el contenedor).
const rectHeightStyles =
  "not-data-[height]:h-full data-[height=xs]:h-16 data-[height=sm]:h-48 data-[height=md]:h-64 data-[height=lg]:h-80 data-[height=xl]:h-128";

/**
 * Marcador de posición decorativo — `aria-hidden`. El anuncio de "cargando"
 * lo hace el contenedor que lo usa (p. ej. `Table` fija `aria-busy` en la
 * propia tabla), no este primitivo por sí solo.
 */
export function Skeleton({ variant = "text", lines = 1, height, className }: SkeletonProps): ReactElement {
  if (variant === "text" && lines > 1) {
    return (
      <span className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={cx(
              blockStyles,
              shapeByVariant.text,
              // El último renglón se acorta (70%), como una línea real de
              // texto. `className` sustituye al ancho por defecto.
              className ?? (index === lines - 1 ? "w-[70%]" : "w-full"),
            )}
            data-variant="text"
            data-last={index === lines - 1 || undefined}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className={cx(
        blockStyles,
        shapeByVariant[variant],
        variant === "rect" && rectHeightStyles,
        // `className` sustituye al ancho por defecto; en `circle` el ancho ya
        // va en la forma (h-10 w-10), así que solo aplica a text y rect.
        variant !== "circle" && (className ?? "w-full"),
        variant === "circle" && className,
      )}
      data-variant={variant}
      data-height={variant === "rect" ? height : undefined}
      aria-hidden="true"
    />
  );
}
