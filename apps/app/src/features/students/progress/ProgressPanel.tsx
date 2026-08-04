import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel, EmptyState, ErrorState, Skeleton, Table } from "@langopia/ui";
import type { TableColumn } from "@langopia/ui";
import { useErrorMessage } from "../../../i18n/errors.js";
import { formatPercent } from "../../../i18n/format.js";
import { useLocale, useT } from "../../../i18n/translate.js";
import { ApiError } from "../../../lib/api-client.js";
import { getStudentProgress } from "../api.js";
import type { ProgressTrendPoint, SkillProgress } from "../types.js";

/** Compartida por la ficha del alumno y `PortalProgressScreen`: misma clave de caché en las dos. */
export function studentProgressQueryKey(studentId: string): readonly ["students", "progress", string] {
  return ["students", "progress", studentId] as const;
}

/**
 * Progreso del alumno (Tarea 16 de la ola 2): porcentaje completado, nota
 * media (solo lo firmado), desglose por destreza, tendencia y racha de
 * repaso.
 *
 * Un único componente para las dos pantallas que lo enseñan —la ficha del
 * alumno (`StudentDetailScreen`, dirección y profesorado) y el portal
 * (`PortalProgressScreen`, el propio alumno y su tutor legal)—: los datos
 * vienen del mismo endpoint (`GET /assessments/students/:studentId/
 * progress`), y quién puede verlo lo decide la API, nunca esta pantalla.
 */
export function ProgressPanel({ studentId }: { studentId: string }): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const query = useQuery({
    queryKey: studentProgressQueryKey(studentId),
    queryFn: () => getStudentProgress(studentId),
  });

  if (query.isPending) {
    return <Skeleton variant="text" lines={4} />;
  }

  if (query.isError) {
    const problem = query.error instanceof ApiError ? query.error.problem : null;
    return <ErrorState title={problem ? errorMessage(problem) : t("progress.errorTitle")} />;
  }

  const progress = query.data;

  const skillColumns: TableColumn<SkillProgress>[] = [
    {
      key: "skill",
      header: t("progress.skillColumnSkill"),
      render: (row) => (t.has(`progress.skill.${row.skill}`) ? t(`progress.skill.${row.skill}`) : row.skill),
    },
    {
      key: "average",
      header: t("progress.skillColumnAverage"),
      numeric: true,
      render: (row) => formatPercent(row.averageScore, locale),
    },
    {
      key: "count",
      header: t("progress.skillColumnCount"),
      numeric: true,
      render: (row) => row.attemptCount.toString(),
    },
  ];

  const trendColumns: TableColumn<ProgressTrendPoint>[] = [
    { key: "week", header: t("progress.trendColumnWeek"), render: (row) => row.weekStart },
    {
      key: "average",
      header: t("progress.trendColumnAverage"),
      numeric: true,
      render: (row) => formatPercent(row.averageScore, locale),
    },
    {
      key: "moving",
      header: t("progress.trendColumnMoving"),
      numeric: true,
      render: (row) => formatPercent(row.movingAverage, locale),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("progress.completionTitle")}>
        {progress.completionRate === null ? (
          <p>{t("progress.completionEmpty")}</p>
        ) : (
          <p>
            {t("progress.completionValue", {
              percent: formatPercent(progress.completionRate, locale),
              completed: progress.completedExercises,
              published: progress.publishedExercises,
            })}
          </p>
        )}
      </Panel>

      <Panel title={t("progress.averageTitle")}>
        {progress.averageScore === null ? (
          <p>{t("progress.averageEmpty")}</p>
        ) : (
          <p>
            {t("progress.averageValue", {
              percent: formatPercent(progress.averageScore, locale),
              count: progress.validatedAttempts,
            })}
          </p>
        )}
      </Panel>

      <Panel title={t("progress.skillTitle")}>
        <Table
          columns={skillColumns}
          rows={progress.skillBreakdown}
          getRowKey={(row) => row.skill}
          caption={t("progress.skillTitle")}
          captionVisuallyHidden
          emptyState={<EmptyState title={t("progress.skillEmpty")} />}
        />
      </Panel>

      <Panel title={t("progress.trendTitle")}>
        <Table
          columns={trendColumns}
          rows={progress.trend}
          getRowKey={(row) => row.weekStart}
          caption={t("progress.trendTitle")}
          captionVisuallyHidden
          emptyState={<EmptyState title={t("progress.trendEmpty")} />}
        />
      </Panel>

      <Panel title={t("progress.streakTitle")}>
        <p>
          {progress.reviewStreakDays > 0
            ? t("progress.streakValue", { days: progress.reviewStreakDays })
            : t("progress.streakEmpty")}
        </p>
      </Panel>
    </div>
  );
}
