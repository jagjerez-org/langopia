import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, Table, Tag } from "../../ui/index.js";
import type { TableColumn } from "../../ui/index.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError } from "../../lib/api-client.js";
import { formatPercent } from "./format.js";
import { DASHBOARD_SUMMARY_QUERY_KEY, getDashboardSummary } from "./api.js";
import type { AtRiskStudent } from "./api.js";
import styles from "./AtRiskStudentsTable.module.css";

/**
 * Alumnos que requieren atención (Tarea 6, Paso 4): la tabla del diseño, con
 * enlace a la ficha. Comparte clave de consulta con `IndicatorsRow` — misma
 * respuesta de `GET /dashboard/summary` (`studentsRequiringAttention`), sin
 * repetir la petición.
 *
 * En la Escuela Atlántico del seed esta lista sale con 33 de 48 alumnos
 * activos (el criterio de riesgo, sin ponderar todavía, llega a la ola 3):
 * se pintan todas las filas que devuelva la API, sin recortar ni paginar
 * aquí — la tabla comparte contenedor con Card, así que crece con la
 * pantalla en vez de con un límite inventado en el cliente.
 *
 * Enlace con `<a>`, no con el `Link` tipado de TanStack Router: la ficha
 * (`/alumnos/:id`) la produce la Tarea 7, en marcha en paralelo, y esa ruta
 * no está en el árbol de `router.tsx` en el momento de escribir esto — un
 * `Link to="/alumnos/$id"` no compilaría contra rutas que no existen
 * todavía. Un enlace normal navega igual en cuanto esa ruta exista.
 */
export function AtRiskStudentsTable(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const getErrorMessage = useErrorMessage();
  const query = useQuery({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY, queryFn: getDashboardSummary });

  const columns: TableColumn<AtRiskStudent>[] = [
    {
      key: "name",
      header: t("dashboard.atRisk.columnStudent"),
      render: (row) => (
        <a className={styles.name} href={`/alumnos/${row.studentId}`}>
          {row.name}
        </a>
      ),
    },
    {
      key: "attendance",
      header: t("dashboard.atRisk.columnAttendance"),
      numeric: true,
      render: (row) =>
        row.attendanceRate === null
          ? t("dashboard.atRisk.attendanceUnknown")
          : formatPercent(row.attendanceRate, locale),
    },
    {
      key: "evaluation",
      header: t("dashboard.atRisk.columnLastEvaluation"),
      numeric: true,
      render: (row) =>
        row.weeksSinceLastEvaluation === null
          ? t("dashboard.atRisk.lastEvaluationNever")
          : t("dashboard.atRisk.lastEvaluationWeeks", { weeks: row.weeksSinceLastEvaluation }),
    },
    {
      key: "status",
      header: t("dashboard.atRisk.columnStatus"),
      render: (row) => (
        <span className={styles.tags}>
          {row.reasons.includes("low_attendance") && (
            <Tag variant="critical">{t("dashboard.atRisk.reasonLowAttendance")}</Tag>
          )}
          {row.reasons.includes("no_recent_evaluation") && (
            <Tag variant="warning">{t("dashboard.atRisk.reasonNoRecentEvaluation")}</Tag>
          )}
        </span>
      ),
    },
  ];

  const errorNode = query.isError ? (
    <ErrorState
      title={
        query.error instanceof ApiError
          ? getErrorMessage(query.error.problem)
          : t("common.unexpectedError")
      }
      action={
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t("common.retry")}
        </Button>
      }
    />
  ) : undefined;

  return (
    <Card title={t("dashboard.atRisk.title")}>
      <Table
        columns={columns}
        rows={query.data?.studentsRequiringAttention ?? []}
        getRowKey={(row) => row.studentId}
        caption={t("dashboard.atRisk.title")}
        captionVisuallyHidden
        isLoading={query.isPending}
        error={errorNode}
        emptyState={<EmptyState title={t("dashboard.atRisk.emptyTitle")} />}
      />
    </Card>
  );
}
