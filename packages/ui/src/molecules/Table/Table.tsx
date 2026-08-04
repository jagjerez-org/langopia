import type { ReactElement, ReactNode } from "react";
import { Skeleton } from "../../atoms/Skeleton/Skeleton.js";

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  /**
   * Columnas de importes, fechas o identificadores: números en fuente
   * monoespaciada alineados a la derecha, para que se puedan comparar de un
   * vistazo por columna — la cifra "pesa" lo mismo en cada fila. Si la celda
   * necesita un enlace o botón (p. ej. el nombre del alumno), que lo pinte
   * `render`: la fila en sí nunca es clicable como bloque, para no romper la
   * semántica de tabla que ya entienden los lectores de pantalla.
   */
  numeric?: boolean;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Obligatorio: describe qué tabla es esto para quien navega por lectores de pantalla. */
  caption: ReactNode;
  /** Oculta la leyenda visualmente sin quitarla del árbol de accesibilidad. */
  captionVisuallyHidden?: boolean;
  isLoading?: boolean;
  /** Filas de esqueleto que se muestran mientras `isLoading` es verdadero. */
  skeletonRowCount?: number;
  /** Se pinta en vez de las filas cuando `rows` está vacío y no hay carga ni error. */
  emptyState?: ReactNode;
  /** Se pinta en vez de las filas, con prioridad sobre carga y vacío. */
  error?: ReactNode;
}

const headStyles =
  "border-b border-border bg-surface-secondary px-4 py-3 text-left text-[length:var(--ink-text-xs)] font-semibold text-muted data-[numeric]:text-right";
const cellStyles =
  "border-b border-border px-4 py-3 align-middle break-words text-text data-[numeric]:text-right data-[numeric]:font-mono data-[numeric]:tabular-nums";
// El borde inferior de la última fila sobra, y el hover ilumina las celdas —
// con selectores sobre los `<td>` desde el `<tr>`, sin clases por celda extra.
const rowStyles = "last:[&>td]:border-b-0 hover:[&>td]:bg-surface-secondary";

/**
 * Tabla de datos semántica: `<caption>` obligatoria (visible u oculta),
 * cabeceras `<th scope="col">`, y tres estados sin filas — carga (esqueletos),
 * vacío (`emptyState`) y error (`error`) — resueltos en ese orden de
 * prioridad inversa: el error manda sobre la carga y esta sobre el vacío.
 */
export function Table<Row>({
  columns,
  rows,
  getRowKey,
  caption,
  captionVisuallyHidden = false,
  isLoading = false,
  skeletonRowCount = 5,
  emptyState,
  error,
}: TableProps<Row>): ReactElement {
  const columnCount = columns.length;

  return (
    // Con textos largos (alemán) o muchas columnas, la tabla desliza en
    // horizontal en vez de recortar o desbordar la pantalla.
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse font-sans text-[length:var(--ink-text-sm)]" aria-busy={isLoading || undefined}>
        <caption
          className={
            captionVisuallyHidden
              ? "sr-only"
              : "border-b border-border px-5 py-4 text-left text-[length:var(--ink-text-md)] font-semibold text-text"
          }
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={headStyles} data-numeric={column.numeric || undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr className={rowStyles}>
              <td colSpan={columnCount} className="p-0">
                {error}
              </td>
            </tr>
          ) : isLoading ? (
            Array.from({ length: skeletonRowCount }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} className={rowStyles}>
                {columns.map((column) => (
                  <td key={column.key} className={cellStyles} data-numeric={column.numeric || undefined}>
                    {/* En columna numérica el esqueleto es corto y a la derecha,
                        como la cifra que sustituye. */}
                    <span className={column.numeric ? "ml-auto block w-16" : "block w-4/5"}>
                      <Skeleton variant="text" />
                    </span>
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr className={rowStyles}>
              <td colSpan={columnCount} className="p-0">
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className={rowStyles}>
                {columns.map((column) => (
                  <td key={column.key} className={cellStyles} data-numeric={column.numeric || undefined}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
