import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";

/**
 * Un fallo de una fila del CSV, ya en la forma que necesita el cliente:
 * un `code` estable, un mensaje por defecto (en español; la traducción a
 * los cinco idiomas la hace la capa HTTP, igual que con cualquier
 * `DomainError`) y los `details` escalares que lo explican.
 */
export type ImportRowError = {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
};

export type ImportedGuardianData = {
  readonly name: string;
  readonly email: string;
  readonly relationship: "mother" | "father" | "legal_guardian" | "other";
};

/** Lo que hace falta para dar de alta o poner al día a un alumno de una fila válida. */
export type ImportedStudentData = {
  readonly name: string;
  readonly email: string;
  readonly dateOfBirth: string;
  readonly nativeLanguage: string;
  readonly targetLanguage: string;
  readonly currentLevel: CefrLevel | null;
  readonly guardian: ImportedGuardianData | null;
};

/**
 * El resultado de analizar UNA fila del CSV.
 *
 * `row` es el número de línea tal como lo vería quien abre el fichero en un
 * editor de hojas de cálculo (la cabecera es la fila 1, así que la primera
 * fila de datos es la 2): así el informe señala exactamente dónde mirar, sin
 * que la escuela tenga que restar mentalmente la cabecera.
 */
export type ImportRowResult =
  | { readonly row: number; readonly status: "valid"; readonly data: ImportedStudentData }
  | { readonly row: number; readonly status: "invalid"; readonly errors: readonly ImportRowError[] };

/**
 * Informe de una importación de alumnado desde CSV.
 *
 * Es el mismo objeto que produce la previsualización y el que usa la
 * confirmación para decidir qué filas escribir: la validación es una sola,
 * no dos que puedan divergir. Una fila mala no invalida el informe entero
 * —se cuenta y se señala, y las demás siguen su curso—, que es la garantía
 * central de la Tarea 14: "una fila mala no tumba las buenas".
 */
export class ImportReport {
  private constructor(private readonly _rows: readonly ImportRowResult[]) {}

  static of(rows: readonly ImportRowResult[]): ImportReport {
    return new ImportReport(rows);
  }

  get rows(): readonly ImportRowResult[] {
    return this._rows;
  }

  get totalRows(): number {
    return this._rows.length;
  }

  get validRows(): readonly (ImportRowResult & { status: "valid" })[] {
    return this._rows.filter(
      (row): row is ImportRowResult & { status: "valid" } => row.status === "valid",
    );
  }

  get invalidRows(): readonly (ImportRowResult & { status: "invalid" })[] {
    return this._rows.filter(
      (row): row is ImportRowResult & { status: "invalid" } => row.status === "invalid",
    );
  }

  get validCount(): number {
    return this.validRows.length;
  }

  get invalidCount(): number {
    return this.invalidRows.length;
  }
}
