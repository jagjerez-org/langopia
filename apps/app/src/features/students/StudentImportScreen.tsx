import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Chip, useToast } from "@langopia/ui";
import { useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError } from "../../lib/api-client.js";
import { commitStudentsImport, previewStudentsImport } from "./api.js";
import { STUDENTS_QUERY_KEY } from "./StudentsListScreen.js";
import type { ImportReport } from "./types.js";

type Step = { kind: "upload" } | { kind: "review"; csv: string; report: ImportReport } | { kind: "done"; report: ImportReport };

/**
 * Importación de alumnado por CSV, en dos pasos (Tarea 7, Paso 6).
 *
 * El fichero viaja como texto dentro de un JSON — no `multipart/form-data`,
 * igual que el resto de la API (comentario de `ImportStudentsCsvDto`) —, así
 * que esta pantalla solo lee el `.csv` local con `FileReader` y manda su
 * contenido tal cual. Toda la validación —fila a fila, y la del fichero
 * entero— la hace el servidor (`analyzeStudentsCsv`); esta pantalla solo
 * presenta su informe de forma que se pueda actuar sobre él, no como un
 * volcado: qué filas fallan, por qué, y con eso ya delante, confirmar o no.
 */
export function StudentImportScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>({ kind: "upload" });
  const [fileError, setFileError] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: (csv: string) => previewStudentsImport(csv),
  });

  const commitMutation = useMutation({
    mutationFn: (csv: string) => commitStudentsImport(csv),
  });

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read error"));
      reader.readAsText(file);
    });

  const handleAnalyze = async (): Promise<void> => {
    setFileError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setFileError(t("students.import.chooseFileFirst"));
      return;
    }
    try {
      const csv = await readFile(file);
      const report = await previewMutation.mutateAsync(csv);
      setStep({ kind: "review", csv, report });
    } catch (error) {
      if (error instanceof ApiError) {
        setFileError(errorMessage(error.problem));
      } else {
        setFileError(t("students.import.fileReadError"));
      }
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (step.kind !== "review") return;
    try {
      const report = await commitMutation.mutateAsync(step.csv);
      setStep({ kind: "done", report });
      showToast({
        variant: "success",
        title: t("students.import.commitTitle"),
        description: t("students.import.commitSummary", {
          created: report.createdCount ?? 0,
          updated: report.updatedCount ?? 0,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
    } catch {
      // El error ya se enseña vía `commitMutation.error` más abajo.
    }
  };

  return (
    <main className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">{t("students.import.title")}</h1>

      {step.kind === "upload" && (
        <div className="flex flex-col gap-4">
          <EmptyState
            title={t("students.import.step1Title")}
            description={t("students.import.step1Description")}
          />
          <div className="flex flex-col gap-2 max-w-sm">
            <label htmlFor="students-csv-file" className="font-medium">
              {t("students.import.fileLabel")}
            </label>
            <input id="students-csv-file" ref={fileInputRef} type="file" accept=".csv,text/csv" />
          </div>
          {fileError && <p role="alert">{fileError}</p>}
          {previewMutation.isError && !fileError && (
            <ErrorState
              title={
                previewMutation.error instanceof ApiError
                  ? errorMessage(previewMutation.error.problem)
                  : t("students.import.errorTitle")
              }
            />
          )}
          <div>
            <Button onClick={() => void handleAnalyze()} isLoading={previewMutation.isPending}>
              {previewMutation.isPending ? t("students.import.analyzing") : t("students.import.analyze")}
            </Button>
          </div>
        </div>
      )}

      {step.kind === "review" && (
        <ImportReview
          report={step.report}
          onBack={() => setStep({ kind: "upload" })}
          onConfirm={() => void handleConfirm()}
          isConfirming={commitMutation.isPending}
          confirmError={
            commitMutation.isError
              ? commitMutation.error instanceof ApiError
                ? errorMessage(commitMutation.error.problem)
                : t("students.import.errorTitle")
              : null
          }
        />
      )}

      {step.kind === "done" && (
        <div className="flex flex-col gap-4">
          <Chip variant="success">
            {t("students.import.commitSummary", {
              created: step.report.createdCount ?? 0,
              updated: step.report.updatedCount ?? 0,
            })}
          </Chip>
          <ImportReportTable report={step.report} />
          <div>
            <Button variant="secondary" onClick={() => setStep({ kind: "upload" })}>
              {t("students.import.back")}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function ImportReview({
  report,
  onBack,
  onConfirm,
  isConfirming,
  confirmError,
}: {
  report: ImportReport;
  onBack: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  confirmError: string | null;
}): ReactElement {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-medium">{t("students.import.step2Title")}</h2>
      <p>
        {t("students.import.summary", {
          total: report.totalRows,
          valid: report.validCount,
          invalid: report.invalidCount,
        })}
      </p>
      <ImportReportTable report={report} />
      {confirmError && <p role="alert">{confirmError}</p>}
      {report.validCount === 0 && <p role="alert">{t("students.import.noValidRows")}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t("students.import.back")}
        </Button>
        <Button onClick={onConfirm} isLoading={isConfirming} disabled={report.validCount === 0}>
          {isConfirming ? t("students.import.confirming") : t("students.import.confirm")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Tabla fila a fila del informe: es el valor de la funcionalidad (brief,
 * verbatim), así que cada fila inválida enseña TODOS sus errores, ya
 * traducidos por la API, en vez de un recuento genérico.
 */
function ImportReportTable({ report }: { report: ImportReport }): ReactElement {
  const t = useT();
  return (
    <table className="w-full">
      <caption className="sr-only">{t("students.import.step2Title")}</caption>
      <thead>
        <tr>
          <th className="text-left">{t("students.import.columnRow")}</th>
          <th className="text-left">{t("students.import.columnStatus")}</th>
          <th className="text-left">{t("students.import.columnSummary")}</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map((row) => (
          <tr key={row.row}>
            <td>{row.row}</td>
            <td>
              {row.status === "invalid" ? (
                <Chip variant="critical">{t("students.import.rowInvalid")}</Chip>
              ) : row.status === "created" ? (
                <Chip variant="success">{t("students.import.rowCreated")}</Chip>
              ) : row.status === "updated" ? (
                <Chip variant="success">{t("students.import.rowUpdated")}</Chip>
              ) : (
                <Chip variant="success">{t("students.import.rowValid")}</Chip>
              )}
            </td>
            <td>
              {row.status === "invalid" ? (
                <ul>
                  {row.errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              ) : row.status === "valid" ? (
                `${row.data.name} — ${row.data.email}`
              ) : (
                row.studentId
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
