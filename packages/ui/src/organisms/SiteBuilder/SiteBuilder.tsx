import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { Input } from "../../atoms/Input/Input.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { ListRow } from "../../molecules/ListRow/ListRow.js";
import { Section } from "../../molecules/Section/Section.js";

/** Entrada del catálogo de bloques que se pueden añadir al lienzo. */
export interface SiteBuilderBlockDefinition {
  /** Tipo estable del bloque (p. ej. "hero", "texto"); lo usa la app al serializar. */
  type: string;
  /** Nombre visible en el catálogo (ya traducido). */
  label: string;
  /** Descripción corta bajo el nombre (ya traducida). */
  description?: string;
  /**
   * Props iniciales de las instancias nuevas (pares clave/valor editables).
   * Define también QUÉ claves son editables: el panel lateral solo muestra
   * campos para las claves ya presentes en el bloque — no se pueden añadir
   * claves nuevas desde la interfaz.
   */
  defaultProps?: Record<string, string>;
}

/** Instancia de bloque colocada en el lienzo. */
export interface SiteBuilderBlock {
  /** Clave estable de la instancia. */
  id: string;
  /** Tipo del bloque, de su `SiteBuilderBlockDefinition`. */
  type: string;
  /** Nombre visible de la instancia (editable). */
  label: string;
  /** Props editables del bloque: pares clave/valor de texto. */
  props: Record<string, string>;
}

export interface SiteBuilderLabels {
  /** Título del panel lateral con el catálogo. */
  catalogTitle: string;
  /** Nombre accesible de la región del lienzo. */
  canvasTitle: string;
  /** Texto del lienzo cuando no hay bloques. */
  canvasEmptyLabel: string;
  /** Prefijo del nombre accesible del menú de cada bloque (p. ej. "Acciones de"). */
  blockActionsLabel: string;
  /** Acción de subir el bloque una posición. */
  moveUpLabel: string;
  /** Acción de bajar el bloque una posición. */
  moveDownLabel: string;
  /** Acción de eliminar el bloque del lienzo. */
  removeLabel: string;
  /** Título del panel de edición del bloque seleccionado. */
  selectedBlockTitle: string;
  /** Etiqueta del campo de nombre del bloque seleccionado. */
  blockNameLabel: string;
  /** Acción de guardar el borrador. */
  saveLabel: string;
  /** Acción de previsualizar el sitio. */
  previewLabel: string;
  /** Acción de publicar el sitio. */
  publishLabel: string;
}

export interface SiteBuilderProps {
  /** Catálogo de bloques disponibles (datos, no componentes). */
  availableBlocks: SiteBuilderBlockDefinition[];
  /**
   * Bloques iniciales del lienzo (modo edición). Solo se leen en el montaje:
   * el estado es interno y no controlado — cambiar esta prop después no
   * actualiza el lienzo.
   */
  initialBlocks?: SiteBuilderBlock[];
  /** Textos de la interfaz, ya traducidos. */
  labels: SiteBuilderLabels;
  /** Notifica la lista de bloques tras cada cambio (añadir, reordenar, editar, eliminar). */
  onChange?: (blocks: SiteBuilderBlock[]) => void;
  /** Acción de guardar: recibe la lista actual. */
  onSave?: (blocks: SiteBuilderBlock[]) => void;
  /** Acción de previsualizar: recibe la lista actual. */
  onPreview?: (blocks: SiteBuilderBlock[]) => void;
  /** Acción de publicar: recibe la lista actual. */
  onPublish?: (blocks: SiteBuilderBlock[]) => void;
}

const wrapperStyles = "flex w-full flex-col gap-4";
const layoutStyles = "grid w-full grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]";
const sidebarStyles = "flex min-w-0 flex-col gap-4";
const canvasStyles = "rounded-lg border border-border bg-surface p-4";
const canvasTitleStyles =
  "m-0 mb-3 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const listStyles = "m-0 flex list-none flex-col gap-0.5 p-0";
const emptyStyles =
  "m-0 py-10 text-center font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const editorStyles = "flex flex-col gap-3";

/**
 * Editor visual del sitio de una escuela: panel lateral con el catálogo de
 * bloques (`availableBlocks`, datos puros), lienzo central con los bloques
 * añadidos y barra de acciones (guardar / previsualizar / publicar).
 *
 * El orden se cambia con acciones "Subir"/"Bajar" del menú de cada bloque —
 * sin drag & drop a propósito en esta iteración: no se añade una librería de
 * arrastre y los botones son operables con teclado y lector de pantalla.
 *
 * Al pulsar un bloque del lienzo se selecciona y sus props (pares clave/valor)
 * se editan en el panel lateral. Es presentacional: no persiste nada; cada
 * cambio se notifica por `onChange` y las acciones de la barra entregan la
 * lista completa a quien llama.
 */
export function SiteBuilder({
  availableBlocks,
  initialBlocks = [],
  labels,
  onChange,
  onSave,
  onPreview,
  onPublish,
}: SiteBuilderProps): ReactElement {
  const [blocks, setBlocks] = useState<SiteBuilderBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Contador para ids estables de las instancias nuevas durante la sesión.
  // El prefijo "new-" evita colisiones con los ids de `initialBlocks`, que
  // los asigna la app y pueden tener cualquier formato (p. ej. "hero-1").
  const nextId = useRef(1);

  /** Aplica el cambio de estado y notifica la lista resultante. */
  const update = (next: SiteBuilderBlock[]) => {
    setBlocks(next);
    onChange?.(next);
  };

  const addBlock = (definition: SiteBuilderBlockDefinition) => {
    const block: SiteBuilderBlock = {
      id: `new-${definition.type}-${nextId.current}`,
      type: definition.type,
      label: definition.label,
      props: { ...definition.defaultProps },
    };
    nextId.current += 1;
    update([...blocks, block]);
    setSelectedId(block.id);
  };

  const moveBlock = (id: string, offset: -1 | 1) => {
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    update(next);
  };

  const removeBlock = (id: string) => {
    update(blocks.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const patchBlock = (id: string, patch: Partial<SiteBuilderBlock>) => {
    update(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  const selected = blocks.find((block) => block.id === selectedId) ?? null;

  return (
    <div className={wrapperStyles}>
      <ActionBar
        actions={[
          ...(onPreview !== undefined
            ? [{ label: labels.previewLabel, variant: "secondary" as const, onClick: () => onPreview(blocks) }]
            : []),
          ...(onSave !== undefined
            ? [{ label: labels.saveLabel, variant: "secondary" as const, onClick: () => onSave(blocks) }]
            : []),
          ...(onPublish !== undefined
            ? [{ label: labels.publishLabel, variant: "primary" as const, onClick: () => onPublish(blocks) }]
            : []),
        ]}
      />
      <div className={layoutStyles}>
        <div className={sidebarStyles}>
          <Section title={labels.catalogTitle}>
            <ul className={listStyles}>
              {availableBlocks.map((definition) => (
                <li key={definition.type}>
                  <ListRow
                    title={definition.label}
                    subtitle={definition.description}
                    onClick={() => addBlock(definition)}
                  />
                </li>
              ))}
            </ul>
          </Section>
          {selected && (
            <Section title={`${labels.selectedBlockTitle}: ${selected.label}`}>
              <div className={editorStyles}>
                <Input
                  label={labels.blockNameLabel}
                  value={selected.label}
                  onChange={(event) => patchBlock(selected.id, { label: event.target.value })}
                />
                {Object.keys(selected.props).map((key) => (
                  <Input
                    key={key}
                    label={key}
                    value={selected.props[key]}
                    onChange={(event) =>
                      patchBlock(selected.id, {
                        props: { ...selected.props, [key]: event.target.value },
                      })
                    }
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
        <section aria-label={labels.canvasTitle} className={canvasStyles}>
          <h2 className={canvasTitleStyles}>{labels.canvasTitle}</h2>
          {blocks.length === 0 ? (
            <p className={emptyStyles}>{labels.canvasEmptyLabel}</p>
          ) : (
            <ul className={listStyles}>
              {blocks.map((block, index) => (
                <li key={block.id}>
                  <ListRow
                    title={block.label}
                    subtitle={block.type}
                    active={block.id === selectedId}
                    onClick={() => setSelectedId(block.id)}
                    actionsLabel={`${labels.blockActionsLabel} ${block.label}`}
                    actions={[
                      {
                        label: labels.moveUpLabel,
                        disabled: index === 0,
                        onClick: () => moveBlock(block.id, -1),
                      },
                      {
                        label: labels.moveDownLabel,
                        disabled: index === blocks.length - 1,
                        onClick: () => moveBlock(block.id, 1),
                      },
                      { label: labels.removeLabel, onClick: () => removeBlock(block.id) },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
