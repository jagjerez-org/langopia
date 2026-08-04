import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Button } from "../../atoms/Button/Button.js";
import { IconInbox } from "../../atoms/Icons/Icons.js";
import { Input } from "../../atoms/Input/Input.js";
import { Selector } from "../../atoms/Selector/Selector.js";
import { ListRow } from "../ListRow/ListRow.js";
import type { ListRowAction, ListRowAvatar, ListRowTag } from "../ListRow/ListRow.js";

export interface ListItem {
  /** Clave estable de la fila. */
  id: string;
  title: string;
  subtitle?: string;
  tags?: ListRowTag[];
  avatar?: ListRowAvatar;
  actions?: ListRowAction[];
  href?: string;
  onClick?: () => void;
}

/** Campo de texto por el que se puede ordenar. */
export type ListSortField = "title" | "subtitle";

export interface ListSortOption {
  value: ListSortField;
  /** Texto visible de la opción (ya traducido). */
  label: string;
}

export interface ListProps {
  /** Filas de datos; el filtrado, la ordenación y la paginación son internos. */
  items: ListItem[];
  /** Nombre accesible de la región de la lista (ya traducido). */
  ariaLabel: string;
  /** Título visible opcional sobre la lista. */
  title?: string;
  /** Activa el buscador: etiqueta del campo (ya traducida). */
  searchLabel?: string;
  searchPlaceholder?: string;
  /** Notifica cada cambio del texto de búsqueda (el filtrado sigue siendo interno). */
  onSearchChange?: (query: string) => void;
  /** Activa la ordenación: etiqueta del selector (ya traducida). */
  sortLabel?: string;
  /** Campos por los que ordenar (orden alfabético ascendente). */
  sortOptions?: ListSortOption[];
  onSortChange?: (field: ListSortField) => void;
  /** Activa la paginación: tamaño de página. */
  pageSize?: number;
  previousLabel?: string;
  nextLabel?: string;
  /** Texto "x de y" de la paginación; por defecto `${página} de ${total}`. */
  pageInfo?: (page: number, totalPages: number) => string;
  onPageChange?: (page: number) => void;
  /** Estado de carga: sustituye las filas por un esqueleto. */
  isLoading?: boolean;
  loadingLabel?: string;
  /** Texto del estado vacío (sin datos o sin resultados). */
  emptyLabel?: string;
  /** Nombre accesible del menú de acciones de cada fila. */
  rowActionsLabel?: string;
}

const sectionStyles = "flex w-full flex-col gap-3";
const headerStyles = "flex flex-wrap items-end justify-between gap-3";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-lg)] leading-[var(--ink-leading-lg)] font-semibold text-text";
const controlsStyles = "flex flex-wrap items-end gap-2";
const controlStyles = "w-48";
const listStyles = "m-0 flex list-none flex-col gap-0.5 p-0";
const footerStyles = "flex items-center justify-between gap-3";
const pageInfoStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const stateStyles =
  "flex flex-col items-center justify-center gap-2 py-10 text-center font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const skeletonRowStyles = "h-12 animate-pulse rounded-md bg-sunken";

function fieldValue(item: ListItem, field: ListSortField): string {
  return item[field] ?? "";
}

/**
 * Lista de datos completa: cabecera con título, buscador (filtra por título
 * y subtítulo), ordenación alfabética por campo y paginación interna con
 * botones anterior/siguiente. Nada se controla desde fuera — quien llama solo
 * recibe callbacks opcionales (`onSearchChange`, `onSortChange`, `onPageChange`).
 *
 * Semántica: se usa lista (`<ul>`/`<li>`) y no tabla, porque las filas son
 * ricas (avatar, tags, menú de acciones) y no columnas tabulares.
 */
export function List({
  items,
  ariaLabel,
  title,
  searchLabel,
  searchPlaceholder,
  onSearchChange,
  sortLabel,
  sortOptions,
  onSortChange,
  pageSize,
  previousLabel = "Anterior",
  nextLabel = "Siguiente",
  pageInfo = (page, totalPages) => `${page} de ${totalPages}`,
  onPageChange,
  isLoading = false,
  loadingLabel = "Cargando…",
  emptyLabel = "No hay elementos",
  rowActionsLabel,
}: ListProps): ReactElement {
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<ListSortField | undefined>(sortOptions?.[0]?.value);
  const [page, setPage] = useState(1);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? items.filter(
        (item) =>
          item.title.toLocaleLowerCase().includes(normalizedQuery) ||
          (item.subtitle ?? "").toLocaleLowerCase().includes(normalizedQuery),
      )
    : items;

  const sorted = sortField
    ? [...filtered].sort((a, b) => fieldValue(a, sortField).localeCompare(fieldValue(b, sortField)))
    : filtered;

  const paginated = pageSize !== undefined && pageSize > 0;
  const totalPages = paginated ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visible = paginated
    ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sorted;

  const changeQuery = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setPage(1);
    onSearchChange?.(event.target.value);
  };

  const changeSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const field = event.target.value as ListSortField;
    setSortField(field);
    setPage(1);
    onSortChange?.(field);
  };

  const changePage = (next: number) => {
    setPage(next);
    onPageChange?.(next);
  };

  return (
    <section aria-label={ariaLabel} className={sectionStyles}>
      {(title || searchLabel || (sortLabel && sortOptions)) && (
        <div className={headerStyles}>
          {title && <h2 className={titleStyles}>{title}</h2>}
          <div className={controlsStyles}>
            {searchLabel && (
              <div className={controlStyles}>
                <Input
                  label={searchLabel}
                  type="search"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={changeQuery}
                />
              </div>
            )}
            {sortLabel && sortOptions && sortOptions.length > 0 && (
              <div className={controlStyles}>
                <Selector
                  label={sortLabel}
                  options={sortOptions}
                  value={sortField}
                  onChange={changeSort}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className={stateStyles}>
          <p role="status" className="m-0">
            {loadingLabel}
          </p>
          <div aria-hidden="true" className="flex w-full flex-col gap-0.5">
            <div className={skeletonRowStyles} />
            <div className={skeletonRowStyles} />
            <div className={skeletonRowStyles} />
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className={stateStyles}>
          <IconInbox className="text-[2em] leading-none" />
          <p className="m-0">{emptyLabel}</p>
        </div>
      ) : (
        <ul className={listStyles}>
          {visible.map((item) => (
            <li key={item.id}>
              <ListRow
                title={item.title}
                subtitle={item.subtitle}
                tags={item.tags}
                avatar={item.avatar}
                actions={item.actions}
                actionsLabel={rowActionsLabel}
                href={item.href}
                onClick={item.onClick}
              />
            </li>
          ))}
        </ul>
      )}

      {paginated && !isLoading && visible.length > 0 && (
        <div className={footerStyles}>
          <p className={pageInfoStyles}>{pageInfo(currentPage, totalPages)}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => changePage(currentPage - 1)}
            >
              {previousLabel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => changePage(currentPage + 1)}
            >
              {nextLabel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
