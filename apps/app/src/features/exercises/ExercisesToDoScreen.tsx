import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Skeleton } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { useMyStudentsQuery } from "../portal/hooks.js";
import { StudentSwitcher, usePortalStudentId } from "../portal/StudentSwitcher.js";
import { listExercisesToDo } from "./api.js";
import { ExerciseAttemptCard } from "./ExerciseAttemptCard.js";

/**
 * `/mi/ejercicios` (Tarea 12 de la ola 2, Pasos 1 y 3): lo que el alumno tiene
 * por hacer.
 *
 * Igual que `/mi/progreso`, el endpoint vive en `assessment` y exige el
 * `studentProfileId` en la ruta: se resuelve con la MISMA lista de
 * `GET /portal/me/students` que ya arma `StudentSwitcher` (el primero si la URL
 * no elige ninguno), para que un tutor con dos hijos pueda cambiar entre ellos.
 *
 * QUÉ ejercicios salen —publicados a los grupos activos de ese alumno— y si
 * cada uno exige firma del profesor lo decide la API; esta pantalla los pinta.
 */
export function ExercisesToDoScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { studentId, setStudentId } = usePortalStudentId();
  const studentsQuery = useMyStudentsQuery();

  const students = studentsQuery.data ?? [];
  const effectiveStudentId =
    studentId && students.some((s) => s.studentId === studentId) ? studentId : students[0]?.studentId;

  const exercisesQuery = useQuery({
    queryKey: ["exercises", "todo", effectiveStudentId],
    queryFn: () => listExercisesToDo(effectiveStudentId!),
    enabled: Boolean(effectiveStudentId),
  });

  const failure = studentsQuery.error ?? exercisesQuery.error;
  const isPending = studentsQuery.isPending || (Boolean(effectiveStudentId) && exercisesQuery.isPending);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("exercises.todo.title")}</h1>
      <StudentSwitcher students={students} value={studentId} onChange={setStudentId} />

      {failure && (
        <ErrorState
          title={
            failure instanceof ApiError ? errorMessage(failure.problem) : t("exercises.todo.errorTitle")
          }
          action={
            <Button
              onClick={() => {
                void studentsQuery.refetch();
                void exercisesQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      )}

      {!failure && isPending && (
        <>
          <p role="status">{t("common.loading")}</p>
          <Skeleton variant="text" lines={4} />
        </>
      )}

      {!failure && !isPending && (exercisesQuery.data ?? []).length === 0 && (
        <EmptyState
          title={t("exercises.todo.emptyTitle")}
          description={t("exercises.todo.emptyDescription")}
        />
      )}

      {!failure && effectiveStudentId && (
        <div className="flex flex-col gap-4 mt-4">
          {(exercisesQuery.data ?? []).map((exercise) => (
            <ExerciseAttemptCard
              key={exercise.exerciseId}
              exercise={exercise}
              studentProfileId={effectiveStudentId}
              onSubmitted={() => void exercisesQuery.refetch()}
            />
          ))}
        </div>
      )}
    </main>
  );
}
