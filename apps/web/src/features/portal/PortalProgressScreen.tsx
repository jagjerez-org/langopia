import type { ReactElement } from "react";
import { Button, EmptyState, ErrorState, Skeleton } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError } from "../../lib/api-client.js";
import { ProgressPanel } from "../students/progress/ProgressPanel.js";
import { useMyStudentsQuery } from "./hooks.js";
import { StudentSwitcher, usePortalStudentId } from "./StudentSwitcher.js";

/**
 * `/mi/progreso` (Tarea 16 de la ola 2): «mi progreso» del alumno o de su
 * tutor legal.
 *
 * A diferencia de `/mi/clases`, `/mi/facturas` y `/mi/asistencia` —que piden
 * sin `studentId` y dejan que la API resuelva «el propio»—, el progreso vive
 * en `assessment` (`GET /assessments/students/:studentId/progress`, el mismo
 * endpoint que usa la ficha del alumno) y exige el identificador en la ruta:
 * esta pantalla lo resuelve aquí, con la MISMA lista de `GET /portal/me/
 * students` que ya arma `StudentSwitcher` — el primero de la lista si la URL
 * no elige ninguno, igual que hace `StudentSwitcher` para pintar la
 * selección activa.
 */
export function PortalProgressScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { studentId, setStudentId } = usePortalStudentId();
  const studentsQuery = useMyStudentsQuery();

  if (studentsQuery.isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (studentsQuery.isError) {
    const problem = studentsQuery.error instanceof ApiError ? studentsQuery.error.problem : null;
    return (
      <main className="p-6">
        <ErrorState
          title={problem ? errorMessage(problem) : t("portal.progress.errorTitle")}
          action={<Button onClick={() => void studentsQuery.refetch()}>{t("common.retry")}</Button>}
        />
      </main>
    );
  }

  const students = studentsQuery.data ?? [];
  const effectiveStudentId =
    studentId && students.some((s) => s.studentId === studentId) ? studentId : students[0]?.studentId;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("portal.progress.title")}</h1>
      <StudentSwitcher students={students} value={studentId} onChange={setStudentId} />
      {effectiveStudentId ? (
        <ProgressPanel studentId={effectiveStudentId} />
      ) : (
        <EmptyState title={t("portal.progress.emptyTitle")} />
      )}
    </main>
  );
}
