import { InvalidImportFileError } from "../../../domain/errors/people.errors.js";

/**
 * Una fila de datos ya emparejada con su cabecera.
 *
 * `columnMismatch` cubre la fila que trae más o menos campos de los que
 * indica la cabecera —típicamente una coma sin escapar dentro de un valor—:
 * en ese caso `values` se deja vacío a propósito, para que quien la procese
 * no adivine a qué columna pertenece cada valor y la reporte tal cual, como
 * la fila inválida que es.
 */
export type CsvRow = {
  readonly values: ReadonlyMap<string, string>;
  readonly columnMismatch: boolean;
  readonly expectedColumns: number;
  readonly actualColumns: number;
};

export type ParsedCsv = {
  readonly headers: readonly string[];
  readonly records: readonly CsvRow[];
};

/**
 * Tokeniza un CSV en bruto: filas de campos, respetando RFC 4180.
 *
 * Un CSV es una entrada hostil (Tarea 14): comillas que envuelven un campo
 * con comas o saltos de línea dentro, comillas escapadas como `""`, `\r\n` y
 * `\n` mezclados. Este tokenizador los entiende; lo único que no perdona es
 * una comilla abierta que nunca se cierra, porque ahí no hay forma fiable de
 * saber dónde termina el campo — se aborta con un error de fichero en vez de
 * adivinar y corromper los datos.
 */
function tokenize(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = (): void => {
    record.push(field);
    field = "";
  };
  const endRecord = (): void => {
    endField();
    records.push(record);
    record = [];
  };

  let i = 0;
  const len = content.length;
  while (i < len) {
    const ch = content[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      endField();
      i++;
      continue;
    }
    if (ch === "\r") {
      if (content[i + 1] === "\n") i++;
      endRecord();
      i++;
      continue;
    }
    if (ch === "\n") {
      endRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (inQuotes) {
    throw new InvalidImportFileError("El fichero CSV tiene una comilla sin cerrar.");
  }
  // Último campo/registro si el contenido no termina en salto de línea.
  if (field.length > 0 || record.length > 0) endRecord();

  return records;
}

/** Una línea completamente vacía (el resultado de una línea en blanco en el fichero). */
function isBlankLine(fields: string[]): boolean {
  return fields.length === 1 && fields[0] === "";
}

/**
 * Analiza el CSV y lo empareja con su cabecera.
 *
 * La cabecera puede venir en cualquier orden (`toRawRows` la busca por
 * nombre, no por posición) y se compara en minúsculas para no depender de
 * que alguien haya escrito "Email" o "EMAIL". Las líneas en blanco —el resto
 * de un fichero que termina con más de un salto de línea— se ignoran, no
 * cuentan como fila.
 */
export function parseCsv(content: string): ParsedCsv {
  const withoutBom = content.replace(/^﻿/, "");
  const raw = tokenize(withoutBom).filter((fields) => !isBlankLine(fields));

  if (raw.length === 0) {
    throw new InvalidImportFileError("El fichero CSV está vacío.");
  }

  const headers = raw[0]!.map((h) => h.trim().toLowerCase());
  const records: CsvRow[] = raw.slice(1).map((fields) => {
    const expectedColumns = headers.length;
    const actualColumns = fields.length;
    const columnMismatch = actualColumns !== expectedColumns;
    const values = new Map<string, string>();
    if (!columnMismatch) {
      headers.forEach((header, index) => values.set(header, (fields[index] ?? "").trim()));
    }
    return { values, columnMismatch, expectedColumns, actualColumns };
  });

  return { headers, records };
}
