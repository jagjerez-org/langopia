import type { ReactElement, ReactNode } from "react";
import { Button } from "../../atoms/Button/Button.js";
import type { ButtonVariant } from "../../atoms/Button/Button.js";
import { Chip } from "../../atoms/Chip/Chip.js";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { FormAction } from "../../atoms/FormAction/FormAction.js";

export interface CardTag {
  /** Texto de la etiqueta (ya traducido). */
  label: string;
  variant?: ChipVariant;
}

export interface CardAction {
  /** Texto de la acción (ya traducido). */
  label: string;
  /** Acción de botón. Excluyente con `href`. */
  onClick?: () => void;
  /** Acción de navegación: enlace con aspecto de botón (`FormAction`). */
  href?: string;
  /** Énfasis visual; por defecto `secondary`. */
  variant?: ButtonVariant;
  disabled?: boolean;
}

export interface CardImage {
  src: string;
  /** Texto alternativo (ya traducido); cadena vacía si es decorativa. */
  alt: string;
}

export type CardOrientation = "vertical" | "horizontal";

export interface CardProps {
  /** Título de la tarjeta. */
  title: string;
  /** Contenido libre bajo el título. */
  children?: ReactNode;
  /** Imagen de cabecera (vertical) o lateral (horizontal). */
  image?: CardImage;
  tags?: CardTag[];
  /** Acciones del pie (botones o enlaces con aspecto de botón). */
  actions?: CardAction[];
  /** Tarjeta clickable como enlace. */
  href?: string;
  /** Tarjeta clickable como botón. Excluyente con `href`. */
  onClick?: () => void;
  /** `vertical` (imagen arriba) por defecto; `horizontal` pone la imagen a la izquierda. */
  orientation?: CardOrientation;
}

const cardStyles = [
  // Base: superficie elevada con borde sutil; la orientación se resuelve con
  // selectores data-* para mantener la cadena estática.
  "flex w-full min-w-0 appearance-none overflow-hidden rounded-lg border border-border bg-surface p-0 text-left font-sans text-text no-underline shadow-[var(--ink-shadow-sm)]",
  "data-[orientation=vertical]:flex-col data-[orientation=horizontal]:flex-row",
  // Clickable: cursor, hover y foco visible.
  "data-[clickable]:cursor-pointer data-[clickable]:transition-[box-shadow,border-color] data-[clickable]:duration-fast data-[clickable]:hover:border-border-strong data-[clickable]:hover:shadow-[var(--ink-shadow-md)] data-[clickable]:focus-visible:outline-2 data-[clickable]:focus-visible:outline-offset-2 data-[clickable]:focus-visible:outline-accent",
].join(" ");

const imageStyles =
  "shrink-0 object-cover data-[orientation=vertical]:aspect-[16/9] data-[orientation=vertical]:w-full data-[orientation=horizontal]:h-auto data-[orientation=horizontal]:w-32";
const contentStyles = "flex min-w-0 flex-1 flex-col gap-2 p-4";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const bodyStyles =
  "m-0 font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] text-muted";
const tagsStyles = "flex flex-wrap items-center gap-1";
const footerStyles = "flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3";
const clickableRegionStyles = "flex min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-left font-sans text-inherit no-underline data-[orientation=vertical]:flex-col data-[orientation=horizontal]:flex-row";

/**
 * Tarjeta de contenido: título, cuerpo libre, imagen opcional, tags (`Chip`)
 * y pie de acciones (`Button`/`FormAction`). Con `href` u `onClick` la tarjeta
 * es clickable entera; si además hay acciones de pie, la zona clickable es el
 * cuerpo y el pie queda fuera — nunca se anidan interactivos.
 */
export function Card({
  title,
  children,
  image,
  tags,
  actions,
  href,
  onClick,
  orientation = "vertical",
}: CardProps): ReactElement {
  const clickable = href !== undefined || onClick !== undefined;
  const footer =
    actions && actions.length > 0 ? (
      <div className={footerStyles}>
        {actions.map((action) =>
          action.href !== undefined ? (
            <FormAction
              key={action.label}
              href={action.href}
              variant={action.variant ?? "secondary"}
              size="sm"
              disabled={action.disabled}
            >
              {action.label}
            </FormAction>
          ) : (
            <Button
              key={action.label}
              type="button"
              variant={action.variant ?? "secondary"}
              size="sm"
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ),
        )}
      </div>
    ) : null;

  const body = (
    <>
      {image && (
        <img src={image.src} alt={image.alt} className={imageStyles} data-orientation={orientation} />
      )}
      <div className={contentStyles}>
        <h3 className={titleStyles}>{title}</h3>
        {children && <div className={bodyStyles}>{children}</div>}
        {tags && tags.length > 0 && (
          <div className={tagsStyles}>
            {tags.map((tag) => (
              <Chip key={tag.label} variant={tag.variant}>
                {tag.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // Sin pie de acciones, la tarjeta entera es el elemento interactivo.
  if (clickable && footer === null) {
    return href !== undefined ? (
      <a href={href} className={cardStyles} data-orientation={orientation} data-clickable="true" onClick={onClick}>
        {body}
      </a>
    ) : (
      <button
        type="button"
        className={cardStyles}
        data-orientation={orientation}
        data-clickable="true"
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={cardStyles} data-orientation={orientation}>
      {clickable ? (
        href !== undefined ? (
          <a href={href} className={clickableRegionStyles} data-orientation={orientation} onClick={onClick}>
            {body}
          </a>
        ) : (
          <button
            type="button"
            className={clickableRegionStyles}
            data-orientation={orientation}
            onClick={onClick}
          >
            {body}
          </button>
        )
      ) : (
        body
      )}
      {footer}
    </div>
  );
}
