import type { ReactElement, ReactNode } from "react";
import { Button } from "../../atoms/Button/Button.js";

export interface CookiesRgpdProps {
  /** Título del aviso, ya traducido (p. ej. "Usamos cookies"). */
  title: ReactNode;
  /**
   * Texto del aviso, ya traducido. Es `ReactNode` a propósito: el enlace a la
   * política de cookies/privacidad lo incrusta la app dentro de este slot.
   */
  description: ReactNode;
  /** Etiqueta del botón de aceptar, ya traducida. */
  acceptLabel: string;
  /** Etiqueta del botón de rechazar, ya traducida. */
  rejectLabel: string;
  /**
   * Etiqueta del botón de configurar. Solo se muestra si también se pasa
   * `onConfigure` — abrir el panel de preferencias es cosa de la app.
   */
  configureLabel?: string;
  /**
   * Notifica la aceptación. El banner no se oculta solo: persistir el
   * consentimiento y poner `visible` a `false` es responsabilidad del padre.
   */
  onAccept: () => void;
  /** Notifica el rechazo; mismo trato que `onAccept`. */
  onReject: () => void;
  /** Notifica que se quiere configurar; la app abre su panel de preferencias. */
  onConfigure?: () => void;
  /** La app decide cuándo se muestra (sin consentimiento previo, p. ej.). */
  visible: boolean;
  /**
   * Nombre accesible de la región. Tiene un valor por defecto razonable, pero
   * la app debería pasarlo traducido como el resto de textos.
   */
  ariaLabel?: string;
}

const bannerStyles = [
  // Fijo al pie de la ventana, por encima del contenido de la página.
  "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-4",
  // Sombra hacia arriba para despegarlo del lienzo + respeto al área segura.
  "shadow-[var(--ink-shadow-lg)] pb-[calc(1rem+env(safe-area-inset-bottom))]",
].join(" ");

const contentStyles =
  "mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between";

const textStyles = "flex min-w-0 flex-col gap-1";

const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] font-semibold text-text";

const descriptionStyles =
  "font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted [&_a]:text-accent [&_a]:underline";

const actionsStyles = "flex shrink-0 flex-wrap items-center gap-2";

/**
 * Banner de consentimiento de cookies (RGPD). Es SOLO presentacional: no
 * guarda el consentimiento, no decide cuándo mostrarse ni se oculta solo.
 * La app pasa todos los textos ya traducidos (son texto legal), controla la
 * visibilidad con `visible` y recibe la elección del usuario por los callbacks
 * `onAccept` / `onReject` / `onConfigure`.
 */
export function CookiesRgpd({
  title,
  description,
  acceptLabel,
  rejectLabel,
  configureLabel,
  onAccept,
  onReject,
  onConfigure,
  visible,
  ariaLabel = "Aviso de cookies",
}: CookiesRgpdProps): ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <section role="region" aria-label={ariaLabel} className={bannerStyles}>
      <div className={contentStyles}>
        <div className={textStyles}>
          <p className={titleStyles}>{title}</p>
          <div className={descriptionStyles}>{description}</div>
        </div>
        <div className={actionsStyles}>
          {configureLabel && onConfigure && (
            <Button variant="ghost" size="sm" onClick={onConfigure}>
              {configureLabel}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onReject}>
            {rejectLabel}
          </Button>
          <Button variant="primary" size="sm" onClick={onAccept}>
            {acceptLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
