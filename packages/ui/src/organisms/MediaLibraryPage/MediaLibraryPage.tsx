import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import {
  IconAudio,
  IconFile,
  IconImage,
  IconInbox,
  IconVideo,
} from "../../atoms/Icons/Icons.js";
import { Input } from "../../atoms/Input/Input.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { Card } from "../../molecules/Card/Card.js";

export type MediaType = "image" | "video" | "audio" | "document";

export interface MediaFile {
  /** Clave estable del archivo. */
  id: string;
  /** Nombre visible del archivo (con extensión). */
  name: string;
  type: MediaType;
  /** Vista previa de las imágenes, ya resuelta por quien llama. */
  previewUrl?: string;
  /** Tamaño ya formateado (p. ej. "1,2 MB"). */
  size?: string;
}

/** Acción del pie de cada tarjeta (descargar, renombrar, eliminar…). */
export interface MediaFileAction {
  id: string;
  /** Texto de la acción (ya traducido). */
  label: string;
}

export interface MediaLibraryPageLabels {
  /** Título de la página. */
  title: string;
  /** Nombre accesible de la región con la rejilla de archivos. */
  libraryLabel: string;
  /** Etiqueta del buscador de archivos. */
  searchLabel: string;
  searchPlaceholder?: string;
  /** Etiqueta del selector de filtro por tipo de medio. */
  typeFilterLabel: string;
  /** Opción del filtro que muestra todos los tipos. */
  allTypesLabel: string;
  /** Texto de cada tipo en los chips y en el filtro. */
  typeLabels: Record<MediaType, string>;
  /** Estado vacío de la biblioteca (sin archivos o sin resultados). */
  emptyLabel: string;
  /** Botón de subir archivos. */
  uploadLabel: string;
}

export interface MediaLibraryPageProps {
  files: MediaFile[];
  /** Acciones del pie de cada tarjeta de archivo. */
  actions: MediaFileAction[];
  /** Textos de la interfaz, ya traducidos. */
  labels: MediaLibraryPageLabels;
  /** Notifica la acción elegida con el id del archivo y el de la acción. */
  onFileAction: (fileId: string, actionId: string) => void;
  /**
   * Notifica la petición de subida; el file picker lo gestiona la app,
   * que es quien conoce el destino de los archivos.
   */
  onUpload: () => void;
}

/** Cada tipo de medio tiene su icono: la forma acompaña siempre al texto. */
const TYPE_ICON: Record<MediaType, typeof IconImage> = {
  image: IconImage,
  video: IconVideo,
  audio: IconAudio,
  document: IconFile,
};

const MEDIA_TYPES: MediaType[] = ["image", "video", "audio", "document"];

const ALL_TYPES = "all";

const wrapperStyles = "flex w-full flex-col gap-4";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const controlsStyles = "flex flex-wrap items-end gap-2";
const controlStyles = "w-56";
const gridStyles = "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3";
const previewStyles =
  "flex aspect-[16/9] w-full items-center justify-center rounded-md bg-sunken text-[2.5em] leading-none text-muted";
const sizeStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const emptyStyles =
  "flex flex-col items-center justify-center gap-2 py-10 text-center font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/**
 * Biblioteca de medios: rejilla de `Card` por archivo —vista previa para las
 * imágenes e icono por tipo para el resto—, buscador y filtro por tipo
 * internos, acciones de cada archivo en el pie de su tarjeta y un botón de
 * subida que solo notifica (`onUpload`): la app gestiona el file picker.
 * Sin API: todo llega por props y se notifica por callbacks.
 */
export function MediaLibraryPage({
  files,
  actions,
  labels,
  onFileAction,
  onUpload,
}: MediaLibraryPageProps): ReactElement {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);

  const changeQuery = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const changeType = (event: ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(event.target.value);
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = files.filter(
    (file) =>
      (typeFilter === ALL_TYPES || file.type === typeFilter) &&
      (normalizedQuery === "" || file.name.toLocaleLowerCase().includes(normalizedQuery)),
  );

  return (
    <div className={wrapperStyles}>
      <h1 className={titleStyles}>{labels.title}</h1>
      <div className={controlsStyles}>
        <div className={controlStyles}>
          <Input
            label={labels.searchLabel}
            type="search"
            placeholder={labels.searchPlaceholder}
            value={query}
            onChange={changeQuery}
          />
        </div>
        <div className={controlStyles}>
          <Selector
            label={labels.typeFilterLabel}
            options={[
              { value: ALL_TYPES, label: labels.allTypesLabel },
              ...MEDIA_TYPES.map((type) => ({ value: type, label: labels.typeLabels[type] })),
            ]}
            value={typeFilter}
            onChange={changeType}
          />
        </div>
      </div>
      <ActionBar
        actions={[{ label: labels.uploadLabel, variant: "primary", onClick: onUpload }]}
      />
      <section aria-label={labels.libraryLabel}>
        {visible.length === 0 ? (
          <div className={emptyStyles}>
            <IconInbox className="text-[2em] leading-none" />
            <p className="m-0">{labels.emptyLabel}</p>
          </div>
        ) : (
          <ul className={gridStyles}>
            {visible.map((file) => {
              const TypeIcon = TYPE_ICON[file.type];
              const hasPreview = file.type === "image" && file.previewUrl !== undefined;
              return (
                <li key={file.id}>
                  <Card
                    title={file.name}
                    // La vista previa es decorativa: el nombre ya está en el título.
                    image={hasPreview ? { src: file.previewUrl ?? "", alt: "" } : undefined}
                    tags={[{ label: labels.typeLabels[file.type], variant: "neutral" }]}
                    actions={actions.map((action) => ({
                      label: action.label,
                      onClick: () => onFileAction(file.id, action.id),
                    }))}
                  >
                    {!hasPreview && (
                      <div className={previewStyles}>
                        <TypeIcon />
                      </div>
                    )}
                    {file.size && <p className={sizeStyles}>{file.size}</p>}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
