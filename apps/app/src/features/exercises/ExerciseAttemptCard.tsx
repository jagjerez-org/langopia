import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Panel, Chip } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { submitAttempt } from "./api.js";
import { describeAttemptOutcome } from "./attempt-outcome.js";
import { ExerciseInput, audioSrcFromPrompt } from "./inputs/ExerciseInput.js";
import { labelFor } from "./labels.js";
import type { ExerciseResponse, ExerciseToDo, SubmitAttemptResult } from "./types.js";

export interface ExerciseAttemptCardProps {
  exercise: ExerciseToDo;
  studentProfileId: string;
  /** Datos extra de la tarjeta (por ejemplo, el estado de repaso espaciado). */
  meta?: ReactNode;
  /** Se avisa tras enviar, para que la pantalla refresque su listado. */
  onSubmitted?: () => void;
}

/**
 * Un ejercicio, su interacción y el envío de la respuesta. Lo comparten
 * `/mi/ejercicios` (Paso 1) y `/mi/repaso` (Paso 4): el mismo ejercicio se
 * hace igual venga de la lista de pendientes o del repaso de hoy.
 *
 * Todo lo que se decide aquí es de presentación. Si la nota cuenta o no lo
 * dice la API (`requiresTeacherValidation` y el `status` del intento), y esta
 * tarjeta lo repite tal cual: mientras el profesor no firme, se enseña como
 * propuesta, nunca como nota.
 */
export function ExerciseAttemptCard({
  exercise,
  studentProfileId,
  meta,
  onSubmitted,
}: ExerciseAttemptCardProps): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [response, setResponse] = useState<ExerciseResponse | undefined>(undefined);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);

  const mutation = useMutation({
    mutationFn: (body: ExerciseResponse) =>
      submitAttempt({ exerciseId: exercise.exerciseId, studentProfileId, response: body }),
    onSuccess: (submitted) => {
      setResult(submitted);
      onSubmitted?.();
    },
  });

  const outcome = result ? describeAttemptOutcome(result) : null;
  const failure = mutation.error;
  const failureText =
    failure instanceof ApiError ? errorMessage(failure.problem) : t("exercises.submitGenericError");

  return (
    <Panel
      title={labelFor(t, `content.exerciseType.${exercise.type}`, exercise.type)}
      actions={<Chip>{labelFor(t, `content.skill.${exercise.skill}`, exercise.skill)}</Chip>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {t("exercises.todo.unitAndScore", { unit: exercise.unitCode, max: exercise.maxScore })}
        </p>
        {meta}

        {exercise.requiresTeacherValidation && (
          <p className="text-sm">
            <Chip variant="warning">{t("exercises.todo.needsTeacherTag")}</Chip>
          </p>
        )}

        {exercise.latestAttempt && (
          <p className="text-sm">
            {t("exercises.todo.latestAttempt", {
              number: exercise.latestAttempt.attemptNumber,
              status: labelFor(
                t,
                `exercises.attemptStatus.${exercise.latestAttempt.status}`,
                exercise.latestAttempt.status,
              ),
            })}
          </p>
        )}

        <ExerciseInput
          type={exercise.type}
          prompt={exercise.prompt}
          value={response}
          onChange={setResponse}
          fieldPrefix={exercise.exerciseId}
          audioSrc={audioSrcFromPrompt(exercise.prompt)}
        />

        {failure && <p role="alert">{failureText}</p>}

        {outcome?.kind === "corrected" && (
          <div role="status" className="flex flex-col gap-1">
            <p>
              {t("exercises.outcome.corrected", { score: outcome.score, max: outcome.maxScore })}
            </p>
            {outcome.feedback && <p className="text-sm">{outcome.feedback}</p>}
          </div>
        )}

        {outcome?.kind === "pending_review" && (
          <div role="status" className="flex flex-col gap-1">
            <p>{t("exercises.outcome.pendingReview")}</p>
            {outcome.proposedScore !== null && (
              <p className="text-sm">
                {t("exercises.outcome.aiProposal", {
                  score: outcome.proposedScore,
                  max: outcome.maxScore,
                })}
              </p>
            )}
            {outcome.feedback && <p className="text-sm">{outcome.feedback}</p>}
          </div>
        )}

        <div>
          <Button
            onClick={() => response && mutation.mutate(response)}
            disabled={!response}
            isLoading={mutation.isPending}
          >
            {t("exercises.todo.submit")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
