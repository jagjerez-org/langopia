import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import { DateOfBirth } from "../../../domain/model/date-of-birth.vo.js";
import {
  DuplicateEmailInImportError,
  GuardianRequiredError,
  InvalidImportFieldError,
  InvalidImportFileError,
} from "../../../domain/errors/people.errors.js";
import {
  ImportReport,
  type ImportedGuardianData,
  type ImportedStudentData,
  type ImportRowError,
  type ImportRowResult,
} from "../../../domain/model/import-report.vo.js";
import { parseCsv, type CsvRow } from "./parse-csv.js";

/** Las cinco columnas sin las que ninguna fila se puede interpretar de forma fiable. */
const REQUIRED_COLUMNS = ["nombre", "email", "fecha_nacimiento", "idioma_nativo", "idioma_objetivo"] as const;

/** El mismo conjunto cerrado que acepta `GuardianDto` en el alta manual (`students.dto.ts`). */
const GUARDIAN_RELATIONSHIPS = ["mother", "father", "legal_guardian", "other"] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toRowError(error: DomainError): ImportRowError {
  return { code: error.code, message: error.message, details: error.details };
}

/** Estado de trabajo de una fila mientras se analiza; se cierra en `ImportRowResult` al final. */
type RowDraft = {
  row: number;
  errors: ImportRowError[];
  data: ImportedStudentData | null;
  /** El correo, si tiene un formato reconocible: lo usa la detección de duplicados. */
  email: string | null;
};

/**
 * Analiza el contenido de un CSV de alumnado y produce el informe completo
 * de la importación: qué filas entran, cuáles no y por qué.
 *
 * Es una función pura — ni abre una unidad de trabajo ni sabe que existe una
 * base de datos — a propósito: el mismo análisis sirve para la
 * previsualización (que no escribe nada) y para decidir, en la
 * confirmación, qué filas intentar escribir. Un problema del FICHERO entero
 * (faltan columnas obligatorias, o el CSV está mal formado) aborta antes de
 * analizar ninguna fila lanzando `InvalidImportFileError`; un problema de
 * UNA fila nunca aborta nada, se acumula en su propio resultado.
 */
export function analyzeStudentsCsv(content: string, now: Date): ImportReport {
  const { headers, records } = parseCsv(content);

  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new InvalidImportFileError(
      `Faltan columnas obligatorias en el CSV: ${missing.join(", ")}.`,
      { missing },
    );
  }

  const drafts = records.map((record, index) => analyzeRow(record, index + 2, now));
  flagDuplicateEmails(drafts);

  const rows: ImportRowResult[] = drafts.map((draft) =>
    draft.errors.length > 0
      ? { row: draft.row, status: "invalid" as const, errors: draft.errors }
      : { row: draft.row, status: "valid" as const, data: draft.data! },
  );

  return ImportReport.of(rows);
}

function analyzeRow(record: CsvRow, row: number, now: Date): RowDraft {
  const errors: ImportRowError[] = [];

  if (record.columnMismatch) {
    errors.push(
      toRowError(
        new InvalidImportFieldError(
          "fila",
          `se esperaban ${record.expectedColumns} columnas y llegaron ${record.actualColumns}`,
        ),
      ),
    );
    return { row, errors, data: null, email: null };
  }

  const name = (record.values.get("nombre") ?? "").trim();
  if (!name) errors.push(toRowError(new InvalidImportFieldError("nombre", "no puede estar vacío")));

  const rawEmail = (record.values.get("email") ?? "").trim();
  let email: string | null = null;
  if (!rawEmail) {
    errors.push(toRowError(new InvalidImportFieldError("email", "no puede estar vacío")));
  } else if (!EMAIL_PATTERN.test(rawEmail)) {
    errors.push(toRowError(new InvalidImportFieldError("email", "no tiene un formato de correo válido")));
  } else {
    email = rawEmail;
  }

  const rawDate = (record.values.get("fecha_nacimiento") ?? "").trim();
  let dateOfBirth: DateOfBirth | null = null;
  let isMinor = false;
  try {
    dateOfBirth = DateOfBirth.of(rawDate);
    isMinor = dateOfBirth.isMinorAt(now);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    errors.push(toRowError(error));
  }

  const nativeLanguage = (record.values.get("idioma_nativo") ?? "").trim();
  if (!nativeLanguage) {
    errors.push(toRowError(new InvalidImportFieldError("idioma_nativo", "no puede estar vacío")));
  }

  const targetLanguage = (record.values.get("idioma_objetivo") ?? "").trim();
  if (!targetLanguage) {
    errors.push(toRowError(new InvalidImportFieldError("idioma_objetivo", "no puede estar vacío")));
  }

  const rawLevel = (record.values.get("nivel") ?? "").trim().toUpperCase();
  let currentLevel: CefrLevel | null = null;
  if (rawLevel) {
    if ((Object.values(CefrLevel) as string[]).includes(rawLevel)) {
      currentLevel = rawLevel as CefrLevel;
    } else {
      errors.push(toRowError(new InvalidImportFieldError("nivel", "no es un nivel MCER reconocido")));
    }
  }

  // El tutor solo se exige y se lee si la fila es de un menor: para un
  // adulto, columnas de tutor rellenas o no son irrelevantes — el mismo
  // criterio que el alta manual, donde `guardian` es opcional salvo que el
  // dominio lo exija.
  let guardian: ImportedGuardianData | null = null;
  if (dateOfBirth && isMinor) {
    const guardianName = (record.values.get("tutor_nombre") ?? "").trim();
    const guardianEmail = (record.values.get("tutor_email") ?? "").trim();
    const relationship = (record.values.get("tutor_parentesco") ?? "").trim();

    if (!guardianName || !guardianEmail) {
      errors.push(toRowError(new GuardianRequiredError()));
    } else {
      let guardianDataOk = true;
      if (!EMAIL_PATTERN.test(guardianEmail)) {
        errors.push(
          toRowError(new InvalidImportFieldError("tutor_email", "no tiene un formato de correo válido")),
        );
        guardianDataOk = false;
      }
      if (!(GUARDIAN_RELATIONSHIPS as readonly string[]).includes(relationship)) {
        errors.push(
          toRowError(new InvalidImportFieldError("tutor_parentesco", "no es un parentesco reconocido")),
        );
        guardianDataOk = false;
      }
      if (guardianDataOk) {
        guardian = {
          name: guardianName,
          email: guardianEmail,
          relationship: relationship as ImportedGuardianData["relationship"],
        };
      }
    }
  }

  if (errors.length > 0) {
    return { row, errors, data: null, email };
  }

  return {
    row,
    errors,
    email,
    data: {
      name,
      email: email!,
      dateOfBirth: dateOfBirth!.value,
      nativeLanguage,
      targetLanguage,
      currentLevel,
      guardian,
    },
  };
}

/**
 * Marca como inválidas TODAS las filas que comparten un correo, no solo la
 * segunda que aparece: no hay forma de saber cuál de las dos es la fila
 * "buena" —pueden traer datos distintos—, así que se deja a la escuela
 * decidir a mano en vez de que la importación elija una por su cuenta.
 */
function flagDuplicateEmails(drafts: RowDraft[]): void {
  const byEmail = new Map<string, RowDraft[]>();
  for (const draft of drafts) {
    if (!draft.email) continue;
    const key = draft.email.toLowerCase();
    const group = byEmail.get(key);
    if (group) group.push(draft);
    else byEmail.set(key, [draft]);
  }

  for (const [email, group] of byEmail) {
    if (group.length < 2) continue;
    for (const draft of group) {
      draft.data = null;
      draft.errors.push(toRowError(new DuplicateEmailInImportError(email)));
    }
  }
}
