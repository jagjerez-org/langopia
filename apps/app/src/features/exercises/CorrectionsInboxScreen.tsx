import { useState } from "react";
import type { ReactElement } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Panel, EmptyState, ErrorState, Input, Skeleton, Chip } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { AttemptResponseSummary } from "./AttemptResponseSummary.js";
import { getSchoolTimezone, listPendingAttempts, returnAttempt, validateAttempt } from "./api.js";
import { labelFor } from "./labels.js";
import type { PendingAttemptEntry } from "./types.js";

/**
 * `/correcciones` (Tarea 12 de la ola 2, Paso 5): la bandeja del profesor con
 * los intentos que siguen esperando su firma.
 *
 * «La IA propone, el profesor firma»: lo que trae `aiScore`/`aiFeedback` se
 * enseña siempre como PROPUESTA, y hasta que se firma (`validate`) la nota no
 * cuenta para el expediente. Quién puede firmar lo comprueba la API
 * (`@Roles("owner", "admin", "teacher")`), no esta pantalla.
 */
export function CorrectionsInboxScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();

  const timezoneQuery = useQuery({
    queryKey: ["exercises", "school-timezone"],
    queryFn: getSchoolTimezone,
    staleTime: 60_000,
  });

  const pendingQuery = useQuery({
    queryKey: ["exercises", "pending-attempts"],
    queryFn: listPendingAttempts,
  });

  const failure = pendingQuery.error ?? timezoneQuery.error;
  const isPending = pendingQuery.isPending || timezoneQuery.isPending;
  const entries = pendingQuery.data ?? [];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-2">{t("exercises.inbox.title")}</h1>
      <p className="mb-4">{t("exercises.inbox.aiProposesNotice")}</p>

      {failure && (
        <ErrorState
          title={
            failure instanceof ApiError ? errorMessage(failure.problem) : t("exercises.inbox.errorTitle")
          }
          action={
            <Button
              onClick={() => {
                void pendingQuery.refetch();
                void timezoneQuery.refetch();
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

      {!failure && !isPending && entries.length === 0 && (
        <EmptyState
          title={t("exercises.inbox.emptyTitle")}
          description={t("exercises.inbox.emptyDescription")}
        />
      )}

      {!failure && !isPending && entries.length > 0 && (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <PendingAttemptCard
              key={entry.attemptId}
              entry={entry}
              timeZone={timezoneQuery.data?.timezone}
              locale={locale}
              onDone={() => void pendingQuery.refetch()}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function PendingAttemptCard({
  entry,
  timeZone,
  locale,
  onDone,
}: {
  entry: PendingAttemptEntry;
  timeZone: string | undefined;
  locale: ReturnType<typeof useLocale>;
  onDone: () => void;
}): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [score, setScore] = useState(entry.aiScore === null ? "" : String(entry.aiScore));
  const [feedback, setFeedback] = useState("");
  const feedbackId = `${entry.attemptId}-feedback`;

  const signMutation = useMutation({
    mutationFn: () =>
      validateAttempt(entry.attemptId, {
        teacherScore: Number(score),
        ...(feedback.trim() ? { teacherFeedback: feedback.trim() } : {}),
      }),
    onSuccess: onDone,
  });

  const returnMutation = useMutation({
    mutationFn: () => returnAttempt(entry.attemptId, { teacherFeedback: feedback.trim() }),
    onSuccess: onDone,
  });

  const failure = signMutation.error ?? returnMutation.error;
  const failureText =
    failure instanceof ApiError ? errorMessage(failure.problem) : t("exercises.inbox.genericError");

  return (
    <Panel
      title={entry.studentName}
      actions={<Chip>{labelFor(t, `content.exerciseType.${entry.exerciseType}`, entry.exerciseType)}</Chip>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {t("exercises.inbox.meta", {
            attempt: entry.attemptNumber,
            status: labelFor(t, `exercises.attemptStatus.${entry.status}`, entry.status),
            submittedAt: timeZone ? formatDate(entry.submittedAt, timeZone, locale) : "—",
          })}
        </p>

        <section>
          <h3 className="font-medium">{t("exercises.inbox.responseTitle")}</h3>
          <AttemptResponseSummary prompt={entry.prompt} response={entry.response} />
        </section>

        {entry.aiScore !== null && (
          <section>
            <h3 className="font-medium">{t("exercises.inbox.aiProposalTitle")}</h3>
            <p className="text-sm">
              {t("exercises.outcome.aiProposal", { score: entry.aiScore, max: entry.maxScore })}
            </p>
            {entry.aiFeedback && <p className="text-sm">{entry.aiFeedback}</p>}
          </section>
        )}

        <Input
          label={t("exercises.inbox.scoreLabel", { max: entry.maxScore })}
          type="number"
          min={0}
          max={entry.maxScore}
          step="any"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          id={`${entry.attemptId}-score`}
        />

        <label htmlFor={feedbackId} className="font-medium">
          {t("exercises.inbox.feedbackLabel")}
        </label>
        <textarea
          id={feedbackId}
          rows={3}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />

        {failure && <p role="alert">{failureText}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => signMutation.mutate()}
            disabled={score.trim() === ""}
            isLoading={signMutation.isPending}
          >
            {t("exercises.inbox.sign")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => returnMutation.mutate()}
            disabled={feedback.trim() === ""}
            isLoading={returnMutation.isPending}
          >
            {t("exercises.inbox.return")}
          </Button>
        </div>
        <p className="text-sm">{t("exercises.inbox.returnHint")}</p>
      </div>
    </Panel>
  );
}
