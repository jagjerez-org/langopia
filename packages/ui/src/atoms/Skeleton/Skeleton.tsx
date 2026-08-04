import type { ReactElement } from "react";

export type SkeletonVariant = "text" | "circle" | "rect";

/**
 * Alturas predefinidas para `variant="rect"`. El legacy (`apps/app/src/ui`)
 * admitía cualquier medida por estilo inline; el DS no usa estilos inline, así
 * que las alturas se fijan en la escala de espaciado. Equivalencia con las
 * medidas que usa la app: `xs` = 4rem, `sm` = 12rem, `md` = 16rem,
 * `lg` = 20rem, `xl` = 32rem.
 */
export type SkeletonHeight = "xs" | "sm" | "md" | "lg" | "xl";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Solo con `variant="text"`: número de renglones (el último se acorta, como texto real). */
  lines?: number;
  /** Solo con `variant="rect"`: altura predefinida; sin ella llena el contenedor. */
  height?: SkeletonHeight;
}

const blockStyles = [
  // Base: gradiente con barrido (keyframe `ink-skeleton-shimmer`, en theme.css).
  "block animate-[ink-skeleton-shimmer_1.4s_ease-in-out_infinite] bg-[linear-gradient(100deg,var(--ink-bg-sunken)_30%,var(--ink-border-default)_50%,var(--ink-bg-sunken)_70%)] bg-[length:200%_100%]",
  // Variantes.
  "data-[variant=text]:h-[0.85em] data-[variant=text]:w-full data-[variant=text]:rounded-sm",
  "data-[variant=circle]:h-10 data-[variant=circle]:w-10 data-[variant=circle]:rounded-full",
  "data-[variant=rect]:w-full data-[variant=rect]:rounded-md",
  // Alturas predefinidas del rectángulo (sin `height`, llena el contenedor).
  "data-[variant=rect]:data-[height=xs]:h-16 data-[variant=rect]:data-[height=sm]:h-48 data-[variant=rect]:data-[height=md]:h-64 data-[variant=rect]:data-[height=lg]:h-80 data-[variant=rect]:data-[height=xl]:h-128",
  "data-[variant=rect]:not-data-[height]:h-full",
].join(" ");

/**
 * Marcador de posición decorativo — `aria-hidden`. El anuncio de "cargando"
 * lo hace el contenedor que lo usa (p. ej. `Table` fija `aria-busy` en la
 * propia tabla), no este primitivo por sí solo.
 */
export function Skeleton({ variant = "text", lines = 1, height }: SkeletonProps): ReactElement {
  if (variant === "text" && lines > 1) {
    return (
      <span className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            // El último renglón se acorta (70%), como una línea real de texto.
            className={index === lines - 1 ? `${blockStyles} w-[70%]` : `${blockStyles} w-full`}
            data-variant="text"
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className={blockStyles}
      data-variant={variant}
      data-height={variant === "rect" ? height : undefined}
      aria-hidden="true"
    />
  );
}
