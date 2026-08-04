import type { ReactElement } from "react";
import { Chip } from "../../atoms/Chip/Chip.js";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { ItemList } from "../../atoms/ItemList/ItemList.js";
import { TreeDots } from "../../atoms/TreeDots/TreeDots.js";
import { UserAvatar } from "../../atoms/UserAvatar/UserAvatar.js";

export interface ListRowTag {
  /** Texto de la etiqueta (ya traducido). */
  label: string;
  variant?: ChipVariant;
}

export interface ListRowAction {
  /** Texto de la acción del menú (ya traducido). */
  label: string;
  /** Acción de comando. Excluyente con `href`. */
  onClick?: () => void;
  /** Acción de navegación: el ítem del menú es un enlace. */
  href?: string;
  disabled?: boolean;
}

export interface ListRowAvatar {
  /** Nombre de la persona: etiqueta accesible y origen de las iniciales. */
  name: string;
  src?: string;
}

export interface ListRowProps {
  /** Texto principal de la fila. */
  title: string;
  /** Texto secundario/meta bajo el título. */
  subtitle?: string;
  /** Etiquetas de estado/categoría (átomo `Chip`). */
  tags?: ListRowTag[];
  /** Avatar a la izquierda (átomo `UserAvatar`). */
  avatar?: ListRowAvatar;
  /** Acciones del menú contextual de la fila (átomo `TreeDots`). */
  actions?: ListRowAction[];
  /** Nombre accesible del disparador del menú; obligatorio si hay `actions`. */
  actionsLabel?: string;
  /** Con `href` la fila es un enlace. */
  href?: string;
  /** Con `onClick` (y sin `href`) la fila es un botón. */
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}

const rowStyles = "flex w-full min-w-0 items-center gap-1";

const bodyStyles = "flex min-w-0 flex-col gap-0.5";
const titleStyles =
  "truncate font-sans text-[length:var(--ink-text-base)] leading-[var(--ink-leading-base)] font-medium";
const subtitleStyles =
  "truncate font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const tagsStyles = "flex flex-wrap items-center gap-1 pt-0.5";

const menuItemStyles = [
  // Ítem de menú: sirve para <button> y para <a> (mismo aspecto).
  "flex w-full appearance-none items-center gap-2 rounded-sm border-none bg-transparent px-2 py-1.5 text-left font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-text no-underline transition-colors duration-fast not-disabled:cursor-pointer not-disabled:hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-[var(--ink-text-disabled)]",
].join(" ");

/**
 * Fila enriquecida de lista: compone el átomo `ItemList` añadiendo título,
 * subtítulo, tags (`Chip`), avatar (`UserAvatar`) y un menú de acciones
 * (`TreeDots`) con ítems por props. El menú va fuera del `ItemList`, como
 * hermano: así la fila puede ser enlace o botón sin anidar interactivos.
 */
export function ListRow({
  title,
  subtitle,
  tags,
  avatar,
  actions,
  actionsLabel,
  href,
  onClick,
  active = false,
  disabled = false,
}: ListRowProps): ReactElement {
  return (
    <div className={rowStyles}>
      <ItemList
        href={href}
        onClick={onClick}
        active={active}
        disabled={disabled}
        leading={avatar ? <UserAvatar name={avatar.name} src={avatar.src} size="md" /> : undefined}
      >
        <span className={bodyStyles}>
          <span className={titleStyles}>{title}</span>
          {subtitle && <span className={subtitleStyles}>{subtitle}</span>}
          {tags && tags.length > 0 && (
            <span className={tagsStyles}>
              {tags.map((tag) => (
                <Chip key={tag.label} variant={tag.variant}>
                  {tag.label}
                </Chip>
              ))}
            </span>
          )}
        </span>
      </ItemList>
      {actions && actions.length > 0 && (
        <TreeDots triggerLabel={actionsLabel ?? title}>
          {actions.map((action) =>
            action.href !== undefined ? (
              <a key={action.label} role="menuitem" href={action.href} className={menuItemStyles}>
                {action.label}
              </a>
            ) : (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                className={menuItemStyles}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ),
          )}
        </TreeDots>
      )}
    </div>
  );
}
