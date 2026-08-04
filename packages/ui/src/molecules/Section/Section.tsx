import { useId, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Chip } from "../../atoms/Chip/Chip.js";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { IconChevronRight } from "../../atoms/Icons/Icons.js";

export interface SectionTag {
  /** Texto de la etiqueta (ya traducido). */
  label: string;
  variant?: ChipVariant;
}

export interface SectionProps {
  /** Título visible de la sección; también nombra el botón de colapsar. */
  title: string;
  /** Etiquetas de estado/categoría junto al título (átomo `Chip`). */
  tags?: SectionTag[];
  /** Contenido colapsable. */
  children: ReactNode;
  /** Modo controlado: estado de expansión. */
  expanded?: boolean;
  /** Modo no controlado: estado inicial (expandida por defecto). */
  defaultExpanded?: boolean;
  /** Notifica cada cambio de expansión. */
  onToggle?: (expanded: boolean) => void;
}

const sectionStyles = "rounded-lg border border-border bg-surface";
const headerStyles = "flex items-center gap-2 px-3 py-2";
const triggerStyles = [
  // Botón de colapsar: cheurón + título. `group` permite rotar el icono.
  "group flex min-w-0 flex-1 cursor-pointer appearance-none items-center gap-2 rounded-md border-none bg-transparent p-1 text-left font-sans transition-colors duration-fast hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
].join(" ");
const chevronStyles =
  "inline-flex shrink-0 text-[1em] leading-none text-muted transition-transform duration-fast group-data-[expanded]:rotate-90";
const titleStyles =
  "truncate font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const tagsStyles = "flex shrink-0 flex-wrap items-center gap-1";
const contentStyles = "border-t border-border px-4 py-3";

/**
 * Sección colapsable: cabecera con título, tags opcionales y un botón con
 * cheurón que despliega el contenido (`aria-expanded`/`aria-controls`, icono
 * rotado). Controlada (`expanded` + `onToggle`) o no controlada
 * (`defaultExpanded`), como los campos de formulario.
 */
export function Section({
  title,
  tags,
  children,
  expanded,
  defaultExpanded = true,
  onToggle,
}: SectionProps): ReactElement {
  const contentId = useId();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;

  const toggle = () => {
    const next = !isExpanded;
    if (expanded === undefined) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  };

  return (
    <section className={sectionStyles}>
      <div className={headerStyles}>
        <button
          type="button"
          className={triggerStyles}
          data-expanded={isExpanded || undefined}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={toggle}
        >
          <IconChevronRight className={chevronStyles} />
          <span className={titleStyles}>{title}</span>
        </button>
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
      <div id={contentId} className={contentStyles} hidden={!isExpanded}>
        {children}
      </div>
    </section>
  );
}
