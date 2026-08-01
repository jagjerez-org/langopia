import type { ReactElement, ReactNode } from "react";
import styles from "./Tag.module.css";
import { IconAlertOctagon, IconAlertTriangle, IconCheckCircle, IconDot } from "./icons.js";

export type TagVariant = "neutral" | "success" | "warning" | "critical";

export interface TagProps {
  variant?: TagVariant;
  children: ReactNode;
}

/**
 * Cada variante lleva su propia forma de icono, fija, además del color: un
 * punto neutro, una marca de verificación, un triángulo de aviso y un
 * octógono crítico son distinguibles entre sí sin depender del matiz. Así
 * "Riesgo de baja" (crítico) no se lee igual que "Pendiente de revisar"
 * (aviso) para quien no distingue rojo de ámbar — el brief lo pide
 * explícitamente en el paso 4.
 */
const ICON_BY_VARIANT: Record<TagVariant, typeof IconDot> = {
  neutral: IconDot,
  success: IconCheckCircle,
  warning: IconAlertTriangle,
  critical: IconAlertOctagon,
};

export function Tag({ variant = "neutral", children }: TagProps): ReactElement {
  const Icon = ICON_BY_VARIANT[variant];
  return (
    <span className={styles.tag} data-variant={variant}>
      <Icon className={styles.icon} />
      <span className={styles.label}>{children}</span>
    </span>
  );
}
