import type { ReactElement } from "react";
import { UserAvatar, type UserAvatarSize } from "../../atoms/UserAvatar/UserAvatar.js";

export interface UserComponentBaseProps {
  /** Nombre del usuario; es también el nombre accesible del componente. */
  name: string;
  /** Texto secundario bajo el nombre (p. ej. "Administradora"). */
  role?: string;
  /** Alternativa a `role` como texto secundario; si hay `role`, manda `role`. */
  email?: string;
  /** URL de la imagen de avatar, ya resuelta por quien llama. */
  avatarUrl?: string;
  /** Tamaño del avatar (y de los textos, que le acompañan). */
  size?: UserAvatarSize;
  /**
   * Modo compacto: solo el avatar visible; el nombre queda oculto
   * visualmente pero accesible para lectores de pantalla.
   */
  collapsed?: boolean;
}

/**
 * La interactividad es exclusiva: o enlace (`href`), o botón (`onClick`), o
 * bloque de solo lectura (ninguno). Las dos ramas con `never` lo garantizan
 * en tipos.
 */
export type UserComponentProps = UserComponentBaseProps &
  (
    | {
        /** Si se pasa, el componente es un enlace (p. ej. a la página de perfil). */
        href: string;
        onClick?: never;
      }
    | {
        href?: undefined;
        /** Si se pasa, el componente es un botón (p. ej. abrir el menú de perfil). */
        onClick: () => void;
      }
    | {
        href?: undefined;
        onClick?: undefined;
      }
  );

const baseStyles = [
  // Fila: avatar a la izquierda, textos a la derecha, sin crecer de más.
  "inline-flex w-fit max-w-full items-center gap-2 rounded-md font-sans",
].join(" ");

const interactiveStyles = [
  // Reinicio de <button>/<a> + hover y foco visible.
  "cursor-pointer appearance-none border-none bg-transparent p-1 text-left no-underline transition-[background-color] duration-fast hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
].join(" ");

const textColumnStyles = "flex min-w-0 flex-col";

const nameStyles = [
  "truncate text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-semibold text-text",
  "data-[size=lg]:text-[length:var(--ink-text-base)] data-[size=lg]:leading-[var(--ink-leading-base)]",
].join(" ");

const secondaryStyles = [
  "truncate text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] text-muted",
  "data-[size=lg]:text-[length:var(--ink-text-sm)] data-[size=lg]:leading-[var(--ink-leading-sm)]",
].join(" ");

/**
 * Usuario: avatar + nombre (+ rol o email) en horizontal. Es presentacional —
 * no conoce la sesión ni el router: con `href` es un enlace, con `onClick` un
 * botón, y sin ninguno un bloque de solo lectura. En `collapsed` solo se ve el
 * avatar; el nombre sigue accesible.
 *
 * El `UserAvatar` interior va envuelto en `aria-hidden`: el nombre ya lo
 * aporta el texto visible (o el span `sr-only` en `collapsed`), y el avatar
 * anunciaría el mismo nombre una segunda vez.
 */
export function UserComponent({
  name,
  role,
  email,
  avatarUrl,
  size = "md",
  collapsed = false,
  href,
  onClick,
}: UserComponentProps): ReactElement {
  const secondary = role ?? email;

  const content = (
    <>
      {/* Avatar decorativo: el nombre accesible ya está en el texto. */}
      <span aria-hidden="true" className="inline-flex shrink-0">
        <UserAvatar name={name} src={avatarUrl} size={size} />
      </span>
      {collapsed ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className={textColumnStyles}>
          <span className={nameStyles} data-size={size}>
            {name}
          </span>
          {secondary && (
            <span className={secondaryStyles} data-size={size}>
              {secondary}
            </span>
          )}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={`${baseStyles} ${interactiveStyles}`}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseStyles} ${interactiveStyles}`}>
        {content}
      </button>
    );
  }

  return <div className={baseStyles}>{content}</div>;
}
