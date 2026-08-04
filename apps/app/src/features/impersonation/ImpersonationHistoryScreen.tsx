import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { SchoolTimezone } from "@langopia/contracts";
import type { TableColumn } from "@langopia/ui";
import { Button, EmptyState, ErrorState, Table, Chip } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getSchoolTimezone, listImpersonationHistory } from "./api.js";
import type { ImpersonationAuditEntry } from "./types.js";

/**
 * Pantalla de auditoría (paso 12 del brief): quién actuó como quién, cuándo
 * y por qué. `owner`/`admin` solamente en la API
 * (`ImpersonationController.history`); esta pantalla solo pinta lo que
 * `GET /iam/impersonation/history` devuelve, ya filtrado por RLS a la
 * escuela activa — nunca la de otra.
 *
 * Es lo que separa esto de una puerta trasera: que el cliente pueda
 * auditarte.
 *
 * Las fechas son instantes de verdad (`timestamptz`): se pintan en la zona
 * horaria de LA ESCUELA (`GET /scheduling/school-timezone`, mismo patrón que
 * `billing` y `calendar`), nunca en la del navegador de quien mira.
 */
export function ImpersonationHistoryScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();

  const historyQuery = useQuery({
    queryKey: ["impersonation", "history"],
    queryFn: listImpersonationHistory,
  });
  const timezoneQuery = useQuery<SchoolTimezone>({
    queryKey: ["impersonation", "school-timezone"],
    queryFn: getSchoolTimezone,
  });
  const timeZone = timezoneQuery.data?.timezone;

  const formatInstant = (isoUtc: string): string =>
    timeZone ? formatDate(isoUtc, timeZone, locale, { dateStyle: "medium", timeStyle: "short" }) : "";

  const columns: TableColumn<ImpersonationAuditEntry>[] = [
    {
      key: "actor",
      header: t("impersonationHistory.columnActor"),
      render: (entry) => `${entry.impersonatorName} (${entry.impersonatorEmail})`,
    },
    {
      key: "target",
      header: t("impersonationHistory.columnTarget"),
      render: (entry) => `${entry.targetName} — ${entry.targetRole}`,
    },
    {
      key: "reason",
      header: t("impersonationHistory.columnReason"),
      render: (entry) => entry.reason,
    },
    {
      key: "minor",
      header: t("impersonationHistory.columnMinor"),
      // Acceso de un adulto que no es su tutor a los datos de un menor: se
      // marca aparte (regla del brief), no como una fila más.
      render: (entry) =>
        entry.involvesMinor ? (
          <Chip variant="warning">{t("impersonationHistory.minorYes")}</Chip>
        ) : (
          t("impersonationHistory.minorNo")
        ),
    },
    {
      key: "startedAt",
      header: t("impersonationHistory.columnStartedAt"),
      numeric: true,
      render: (entry) => formatInstant(entry.startedAt),
    },
    {
      key: "endedAt",
      header: t("impersonationHistory.columnEndedAt"),
      numeric: true,
      render: (entry) => (entry.endedAt ? formatInstant(entry.endedAt) : "—"),
    },
    {
      key: "duration",
      header: t("impersonationHistory.columnDuration"),
      numeric: true,
      render: (entry) =>
        entry.durationSeconds === null
          ? t("impersonationHistory.ongoing")
          : t("impersonationHistory.duration", {
              minutes: Math.floor(entry.durationSeconds / 60),
              seconds: entry.durationSeconds % 60,
            }),
    },
  ];

  const firstError = historyQuery.error ?? timezoneQuery.error;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("impersonationHistory.title")}</h1>

      <Table
        columns={columns}
        rows={historyQuery.data ?? []}
        getRowKey={(entry) => entry.impersonationId}
        caption={t("impersonationHistory.caption")}
        captionVisuallyHidden
        isLoading={historyQuery.isPending || timezoneQuery.isPending}
        emptyState={
          <EmptyState
            title={t("impersonationHistory.emptyTitle")}
            description={t("impersonationHistory.emptyDescription")}
          />
        }
        error={
          firstError ? (
            <ErrorState
              title={
                firstError instanceof ApiError
                  ? errorMessage(firstError.problem)
                  : t("impersonationHistory.errorTitle")
              }
              action={
                <Button
                  onClick={() => {
                    void historyQuery.refetch();
                    void timezoneQuery.refetch();
                  }}
                >
                  {t("common.retry")}
                </Button>
              }
            />
          ) : undefined
        }
      />
    </main>
  );
}
