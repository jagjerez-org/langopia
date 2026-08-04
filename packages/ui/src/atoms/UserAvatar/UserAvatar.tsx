import { forwardRef, useState } from "react";
import type { ReactElement } from "react";

export type UserAvatarSize = "sm" | "md" | "lg";

export interface UserAvatarProps {
  /**
   * Nombre del usuario. Es el nombre accesible del avatar y el origen de las
   * iniciales de reserva (primera letra de las dos primeras palabras).
   */
  name: string;
  /** URL de la imagen, ya resuelta por quien llama — el componente no hace fetch. */
  src?: string;
  size?: UserAvatarSize;
}

/** Iniciales de reserva: primera letra de las dos primeras palabras, en mayúsculas. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const avatarStyles = [
  // Base: círculo con fondo de acento suave para las iniciales.
  "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-[var(--ink-accent-subtle-bg)] font-sans font-semibold text-[var(--ink-accent-subtle-text)]",
  // Tamaños.
  "data-[size=sm]:h-6 data-[size=sm]:w-6 data-[size=sm]:text-[length:var(--ink-text-xs)]",
  "data-[size=md]:h-8 data-[size=md]:w-8 data-[size=md]:text-[length:var(--ink-text-sm)]",
  "data-[size=lg]:h-11 data-[size=lg]:w-11 data-[size=lg]:text-[length:var(--ink-text-md)]",
].join(" ");

/**
 * Avatar de usuario: imagen redonda con reserva a iniciales derivadas de
 * `name`. Si la imagen no se puede cargar (URL rota, red caída) se cae a las
 * iniciales sin estado de error visible. El contenedor es `role="img"` con el
 * nombre como etiqueta: la imagen interior lleva `alt=""` para no duplicarlo.
 */
export const UserAvatar = forwardRef<HTMLSpanElement, UserAvatarProps>(function UserAvatar(
  { name, src, size = "md" },
  ref,
): ReactElement {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = src !== undefined && !imageFailed;

  return (
    <span ref={ref} className={avatarStyles} data-size={size} role="img" aria-label={name}>
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
});
