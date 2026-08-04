import { useId, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Button, Panel, EmptyState, ErrorState, Skeleton, Chip, useToast } from "@langopia/ui";
import type { ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getSchoolTimezone, getUnitDetail, listPublishTargets, publishUnit, updateExercise } from "./api.js";
import type { ContentUnitExerciseView } from "./types.js";

const STATUS_VARIANT: Record<string, ChipVariant> = {
  draft: "neutral",
  in_review: "warning",
  published: "success",
  archived: "neutral",
};

/** `JSON.stringify` con sangría: lo que se edita es el JSON del enunciado tal cual lo guardó la API. */
function toJsonText(value: Record<string, unknown> | null): string {
  return value === null ? "" : JSON.stringify(value, null, 2);
}

type ExerciseCardProps = {
  contentUnitId: string;
  exercise: ContentUnitExerciseView;
  onSaved: () => void;
};

/**
 * Un ejercicio, editable por separado (Paso 3 del brief: «editables uno a
 * uno»). Cada tarjeta tiene su propio estado de edición y su propio error:
 * guardar uno no toca a los demás, ni siquiera visualmente.
 *
 * Lo que se manda es el JSON del enunciado y, si lo tiene, el de la clave de
 * respuesta. Que ese JSON CUMPLA el esquema del tipo lo decide
 * `validateExercise()` en la API, no este formulario: aquí solo se comprueba
 * que el texto sea JSON parseable, que es formato, no negocio.
 */
function ExerciseCard({ contentUnitId, exercise, onSaved }: ExerciseCardProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const { showToast } = useToast();
  const promptId = useId();
  const solutionId = useId();

  const [editing, setEditing] = useState(false);
  const [promptText, setPromptText] = useState(() => toJsonText(exercise.prompt));
  const [solutionText, setSolutionText] = useState(() => toJsonText(exercise.solution));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEditing = (): void => {
    setPromptText(toJsonText(exercise.prompt));
    setSolutionText(toJsonText(exercise.solution));
    setError(null);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    setError(null);
    let prompt: Record<string, unknown>;
    let solution: Record<string, unknown> | undefined;
    try {
      prompt = JSON.parse(promptText) as Record<string, unknown>;
      solution =
        solutionText.trim() === "" ? undefined : (JSON.parse(solutionText) as Record<string, unknown>);
    } catch {
      setError(t("content.review.invalidJson"));
      return;
    }
    setSaving(true);
    try {
      await updateExercise(contentUnitId, exercise.exerciseId, { prompt, solution });
      showToast({ variant: "success", title: t("content.review.updateSuccess") });
      setEditing(false);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? describeError(cause.problem)
          : t("content.review.updateGenericError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={t("content.review.exercisePosition", { position: exercise.position })}>
      <div className="flex flex-wrap gap-2 items-center">
        <Chip variant="neutral">{t(`content.exerciseType.${exercise.type}`)}</Chip>
        {exercise.skill && <Chip variant="neutral">{t(`content.skill.${exercise.skill}`)}</Chip>}
        {exercise.requiresTeacherValidation && (
          <Chip variant="warning">{t("content.review.requiresValidationTag")}</Chip>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={promptId}>{t("content.review.promptLabel")}</label>
          <textarea
            id={promptId}
            rows={8}
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
          />
          <label htmlFor={solutionId}>{t("content.review.solutionLabel")}</label>
          <textarea
            id={solutionId}
            rows={6}
            value={solutionText}
            onChange={(event) => setSolutionText(event.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" isLoading={saving} onClick={() => void save()}>
              {saving ? t("content.review.saving") : t("content.review.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t("content.review.cancelEdit")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p>{t("content.review.promptLabel")}</p>
          <pre>{toJsonText(exercise.prompt)}</pre>
          {exercise.solution && (
            <>
              <p>{t("content.review.solutionLabel")}</p>
              <pre>{toJsonText(exercise.solution)}</pre>
            </>
          )}
          <div>
            <Button type="button" variant="secondary" onClick={startEditing}>
              {t("content.review.edit")}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/**
 * `/contenido/:id` — revisión y publicación de una unidad (Pasos 3 y 4 del
 * brief).
 *
 * Los grupos a los que se puede publicar los da la API
 * (`GET /learning/units/:id/publish-targets`): el panel no decide cuál encaja
 * por idioma ni por nivel, solo pinta la lista y manda los marcados. Las
 * fechas van en la zona horaria de la ESCUELA.
 */
export function ReviewUnitScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const { showToast } = useToast();
  const { contentUnitId } = useParams({ strict: false }) as { contentUnitId?: string };

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const timezoneQuery = useQuery({
    queryKey: ["content", "school-timezone"],
    queryFn: getSchoolTimezone,
    staleTime: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ["content", "unit", contentUnitId],
    queryFn: () => getUnitDetail(contentUnitId!),
    enabled: Boolean(contentUnitId),
  });

  const targetsQuery = useQuery({
    queryKey: ["content", "publish-targets", contentUnitId],
    queryFn: () => listPublishTargets(contentUnitId!),
    enabled: Boolean(contentUnitId),
  });

  if (!contentUnitId) return <></>; // inalcanzable: la ruta exige el parámetro.

  if (detailQuery.isPending || timezoneQuery.isPending) {
    return (
      <main className="p-6" aria-busy="true">
        <p role="status">{t("common.loading")}</p>
        <Skeleton variant="rect" height="lg" />
      </main>
    );
  }

  if (detailQuery.isError || timezoneQuery.isError) {
    const failure = detailQuery.error ?? timezoneQuery.error;
    return (
      <main className="p-6">
        <ErrorState
          title={
            failure instanceof ApiError
              ? describeError(failure.problem)
              : t("content.review.errorTitle")
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void detailQuery.refetch();
                void timezoneQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
        <p className="mt-4">
          <Link to="/contenido">{t("content.review.backToList")}</Link>
        </p>
      </main>
    );
  }

  const unit = detailQuery.data;
  const timeZone = timezoneQuery.data.timezone;
  const formatInstant = (isoUtc: string): string =>
    formatDate(isoUtc, timeZone, locale, { dateStyle: "medium", timeStyle: "short" });

  const toggleGroup = (groupId: string): void => {
    setSelectedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  };

  const publish = async (): Promise<void> => {
    setPublishError(null);
    setPublishing(true);
    try {
      await publishUnit(contentUnitId, selectedGroupIds);
      showToast({ variant: "success", title: t("content.review.publishSuccess") });
      void detailQuery.refetch();
    } catch (cause) {
      setPublishError(
        cause instanceof ApiError
          ? describeError(cause.problem)
          : t("content.review.publishGenericError"),
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="p-6">
      <p>
        <Link to="/contenido">{t("content.review.backToList")}</Link>
      </p>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{unit.title}</h1>
        <Chip variant={STATUS_VARIANT[unit.status] ?? "neutral"}>{t(`content.status.${unit.status}`)}</Chip>
      </div>

      {unit.status === "in_review" && <p role="note">{t("content.review.aiProposesNotice")}</p>}

      <Panel title={unit.code}>
        <dl className="grid grid-cols-2 gap-2">
          <dt>{t("content.review.metaTopic")}</dt>
          <dd>{unit.topic}</dd>
          <dt>{t("content.review.metaCreditsSpent")}</dt>
          <dd>{new Intl.NumberFormat(locale).format(unit.creditsSpent)}</dd>
          <dt>{t("content.review.metaCreatedAt")}</dt>
          <dd>{formatInstant(unit.createdAt)}</dd>
          <dt>{t("content.review.metaSource")}</dt>
          <dd>{t(`content.source.${unit.source}`)}</dd>
        </dl>
        {unit.reviewedAt && <p>{t("content.review.reviewedMeta", { date: formatInstant(unit.reviewedAt) })}</p>}
        {unit.publishedAt && (
          <p>{t("content.review.publishedMeta", { date: formatInstant(unit.publishedAt) })}</p>
        )}
      </Panel>

      <Panel title={t("content.review.descriptionTitle")}>
        <p>{unit.description}</p>
      </Panel>

      <Panel title={t("content.review.bodyTitle")}>
        <pre>{unit.body}</pre>
      </Panel>

      {unit.assets && unit.assets.length > 0 && (
        <Panel title={t("content.review.resourcesTitle")}>
          <ul className="flex flex-col gap-2">
            {unit.assets.map((asset) => (
              <li key={asset.assetId} className="flex flex-col gap-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <Chip variant={asset.isBeta ? "warning" : "neutral"}>
                    {asset.kind === "video" && asset.isBeta
                      ? t("content.review.videoBetaTitle")
                      : asset.mimeType}
                  </Chip>
                </div>
                {asset.isBeta && (
                  <p role="note">{asset.betaNotice ?? t("content.review.betaNoticeDefault")}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <h2>{t("content.review.exercisesTitle")}</h2>
      {unit.exercises.length === 0 ? (
        <EmptyState title={t("content.review.exercisesEmpty")} />
      ) : (
        unit.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.exerciseId}
            contentUnitId={contentUnitId}
            exercise={exercise}
            onSaved={() => void detailQuery.refetch()}
          />
        ))
      )}

      <Panel title={t("content.review.publishTitle")}>
        <p>{t("content.review.publishDescription")}</p>

        {targetsQuery.isPending && <p role="status">{t("common.loading")}</p>}
        {targetsQuery.isError && (
          <p role="alert">
            {targetsQuery.error instanceof ApiError
              ? describeError(targetsQuery.error.problem)
              : t("common.unexpectedError")}
          </p>
        )}
        {targetsQuery.isSuccess && targetsQuery.data.length === 0 && (
          <p>{t("content.review.groupsEmptyHint")}</p>
        )}
        {targetsQuery.isSuccess && targetsQuery.data.length > 0 && (
          <fieldset className="border border-border rounded-md p-4">
            <legend>{t("content.review.groupsLabel")}</legend>
            {targetsQuery.data.map((target) => (
              <label key={target.groupId} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  value={target.groupId}
                  checked={selectedGroupIds.includes(target.groupId)}
                  onChange={() => toggleGroup(target.groupId)}
                />
                {target.name}
              </label>
            ))}
          </fieldset>
        )}

        {publishError && <p role="alert">{publishError}</p>}

        <Button type="button" isLoading={publishing} onClick={() => void publish()}>
          {publishing ? t("content.review.publishing") : t("content.review.publish")}
        </Button>
      </Panel>
    </main>
  );
}
