import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Skeleton } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { useMyStudentsQuery } from "../portal/hooks.js";
import { StudentSwitcher, usePortalStudentId } from "../portal/StudentSwitcher.js";
import { listDueCards, listExercisesToDo } from "./api.js";
import { ExerciseAttemptCard } from "./ExerciseAttemptCard.js";
import type { DueCard, ExerciseToDo } from "./types.js";

/**
 * `/mi/repaso` (Tarea 12 de la ola 2, Paso 4): las tarjetas de repaso
 * espaciado que vencen hoy.
 *
 * `GET /learning/students/:id/due-cards` devuelve las tarjetas —qué toca hoy y
 * en qué orden lo decide el servidor, en la zona horaria de la ESCUELA— pero
 * solo con el `exerciseId`, sin el enunciado. El enunciado se toma del listado
 * de ejercicios del alumno (`GET /assessments/students/:id/exercises`), que ya
 * trae el `prompt` completo: cruzarlos por identificador es un empalme de
 * datos, no una decisión (ni el orden ni la selección salen de aquí).
 *
 * Una tarjeta cuyo ejercicio ya no esté publicado a sus grupos se enseña igual
 * con su estado de repaso, pero sin nada que hacer: preferible a hacerla
 * desaparecer en silencio.
 */
export function DailyReviewScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { studentId, setStudentId } = usePortalStudentId();
  const studentsQuery = useMyStudentsQuery();

  const students = studentsQuery.data ?? [];
  const effectiveStudentId =
    studentId && students.some((s) => s.studentId === studentId) ? studentId : students[0]?.studentId;

  const cardsQuery = useQuery({
    queryKey: ["exercises", "due-cards", effectiveStudentId],
    queryFn: () => listDueCards(effectiveStudentId!),
    enabled: Boolean(effectiveStudentId),
  });

  const exercisesQuery = useQuery({
    queryKey: ["exercises", "todo", effectiveStudentId],
    queryFn: () => listExercisesToDo(effectiveStudentId!),
    enabled: Boolean(effectiveStudentId),
  });

  const failure = studentsQuery.error ?? cardsQuery.error ?? exercisesQuery.error;
  const isPending =
    studentsQuery.isPending ||
    (Boolean(effectiveStudentId) && (cardsQuery.isPending || exercisesQuery.isPending));

  const cards = cardsQuery.data ?? [];
  const byExerciseId = new Map<string, ExerciseToDo>(
    (exercisesQuery.data ?? []).map((exercise) => [exercise.exerciseId, exercise]),
  );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("exercises.review.title")}</h1>
      <StudentSwitcher students={students} value={studentId} onChange={setStudentId} />

      {failure && (
        <ErrorState
          title={
            failure instanceof ApiError ? errorMessage(failure.problem) : t("exercises.review.errorTitle")
          }
          action={
            <Button
              onClick={() => {
                void cardsQuery.refetch();
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
          <Skeleton variant="text" lines={3} />
        </>
      )}

      {!failure && !isPending && cards.length === 0 && (
        <EmptyState
          title={t("exercises.review.emptyTitle")}
          description={t("exercises.review.emptyDescription")}
        />
      )}

      {!failure && !isPending && cards.length > 0 && (
        <>
          <p role="status" className="mb-4">
            {t("exercises.review.dueCount", { count: cards.length })}
          </p>
          <div className="flex flex-col gap-4">
            {cards.map((card) => {
              const exercise = byExerciseId.get(card.exerciseId);
              if (!exercise || !effectiveStudentId) {
                return (
                  <p key={card.id} role="status">
                    {t("exercises.review.exerciseUnavailable")}
                  </p>
                );
              }
              return (
                <ExerciseAttemptCard
                  key={card.id}
                  exercise={exercise}
                  studentProfileId={effectiveStudentId}
                  meta={<CardMeta card={card} />}
                  onSubmitted={() => {
                    void cardsQuery.refetch();
                    void exercisesQuery.refetch();
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

/**
 * El estado de la tarjeta, tal como lo lleva el servidor: cuántas veces se ha
 * repasado, cuántas se ha fallado y desde cuándo vencía. `dueOn` es una fecha
 * sin hora que la API ya resolvió en la zona de la escuela, así que se enseña
 * literal — convertirla a `Date` aquí la movería a la zona del navegador.
 */
function CardMeta({ card }: { card: DueCard }): ReactElement {
  const t = useT();
  const locale = useLocale();
  return (
    <p className="text-sm">
      {t("exercises.review.cardMeta", {
        // `dueOn` es una fecha SIN hora que el servidor ya resolvió en la zona
        // de la escuela. Se formatea fijando UTC a propósito: cualquier otra
        // zona la correría un día arriba o abajo y enseñaría una fecha que la
        // escuela nunca calculó.
        dueOn: formatDate(`${card.dueOn}T00:00:00Z`, "UTC", locale, { dateStyle: "medium" }),
        repetitions: card.repetitions,
        lapses: card.lapses,
      })}
    </p>
  );
}
