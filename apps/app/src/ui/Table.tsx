import type { ReactElement, ReactNode } from "react";
import styles from "./Table.module.css";
import { Skeleton } from "./Skeleton.js";

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
  width?: string;
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
    <div className={styles.wrapper}>
      <table className={styles.table} aria-busy={isLoading || undefined}>
        <caption className={captionVisuallyHidden ? styles.captionHidden : styles.caption}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={column.numeric ? styles.headNumeric : styles.head}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={columnCount} className={styles.statusCell}>
                {error}
              </td>
            </tr>
          ) : isLoading ? (
            Array.from({ length: skeletonRowCount }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={column.key} className={styles.cell}>
                    <Skeleton variant="text" width={column.numeric ? "4rem" : "80%"} />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className={styles.statusCell}>
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.numeric ? styles.cellNumeric : styles.cell}
                  >
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
