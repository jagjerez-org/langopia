import type { CSSProperties, ReactElement } from "react";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  variant?: "text" | "circle" | "rect";
  width?: string | number;
  height?: string | number;
  /** Solo con `variant="text"`: número de renglones (el último se acorta, como texto real). */
  lines?: number;
}

/**
 * Marcador de posición decorativo — `aria-hidden`. El anuncio de "cargando"
 * lo hace el contenedor que lo usa (p. ej. `Table` fija `aria-busy` en la
 * propia tabla), no este primitivo por sí solo.
 */
export function Skeleton({ variant = "text", width, height, lines = 1 }: SkeletonProps): ReactElement {
  const style: CSSProperties = { width, height };

  if (variant === "text" && lines > 1) {
    return (
      <span className={styles.textGroup} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={styles.block}
            data-variant="text"
            style={{
              ...style,
              width: index === lines - 1 ? (width ?? "70%") : (width ?? "100%"),
            }}
          />
        ))}
      </span>
    );
  }

  return <span className={styles.block} data-variant={variant} style={style} aria-hidden="true" />;
}
