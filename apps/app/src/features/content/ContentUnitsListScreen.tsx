import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, EmptyState, ErrorState, Selector, Table, Chip } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError, getSchoolSlug } from "../../lib/api-client.js";
import { useSession } from "../auth/session.js";
import { languageDisplayName } from "../courses/format.js";
import { getSchoolTimezone, listUnits } from "./api.js";
import { CONTENT_STATUSES } from "./types.js";
import type { ContentUnitListItem } from "./types.js";

const STATUS_VARIANT: Record<string, ChipVariant> = {
  draft: "neutral",
  in_review: "warning",
  published: "success",
  archived: "neutral",
};

/**
 * Listado de unidades didácticas (Paso 6 del brief: la puerta de entrada al
 * generador y a la pantalla de revisión).
 *
 * El filtro por estado viaja como `?status=` a `GET /learning/units` —lo
 * resuelve la API, no una comprobación en este componente—, y `createdAt` se
 * pinta en la zona horaria de la ESCUELA (`GET /scheduling/school-timezone`),
 * nunca en la del navegador.
 *
 * `tenantCacheKey` en las claves de consulta, igual que el listado de
 * facturas: sin ella, cambiar de escuela sin recargar serviría en silencio
 * las unidades cacheadas de la escuela anterior.
 */
export function ContentUnitsListScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const session = useSession();

  const [status, setStatus] = useState("");

  const tenantCacheKey =
    session.status === "ready" ? `${session.user.id}:${getSchoolSlug() ?? ""}` : "sin-sesion";

  const timezoneQuery = useQuery({
    queryKey: ["content", "school-timezone", tenantCacheKey],
    queryFn: getSchoolTimezone,
    staleTime: 60_000,
  });

  const unitsQuery = useQuery({
    queryKey: ["content", "units", tenantCacheKey, status],
    queryFn: () => listUnits(status || undefined),
  });

  const timeZone = timezoneQuery.data?.timezone;

  const columns: TableColumn<ContentUnitListItem>[] = useMemo(
    () => [
      {
        key: "code",
        header: t("content.list.columnCode"),
        render: (row) => (
          <Link to="/contenido/$contentUnitId" params={{ contentUnitId: row.contentUnitId }}>
            {row.code}
          </Link>
        ),
      },
      {
        key: "topic",
        header: t("content.list.columnTopic"),
        render: (row) => row.title ?? row.topic,
      },
      {
        key: "language",
        header: t("content.list.columnLanguage"),
        render: (row) => languageDisplayName(row.language, locale),
      },
      { key: "level", header: t("content.list.columnLevel"), render: (row) => row.level },
      {
        key: "status",
        header: t("content.list.columnStatus"),
        render: (row) => (
          <Chip variant={STATUS_VARIANT[row.status] ?? "neutral"}>{t(`content.status.${row.status}`)}</Chip>
        ),
      },
      {
        key: "credits",
        header: t("content.list.columnCredits"),
        numeric: true,
        render: (row) => new Intl.NumberFormat(locale).format(row.creditsSpent),
      },
      {
        key: "createdAt",
        header: t("content.list.columnCreatedAt"),
        numeric: true,
        render: (row) =>
          timeZone ? formatDate(row.createdAt, timeZone, locale, { dateStyle: "medium" }) : "—",
      },
    ],
    [t, locale, timeZone],
  );

  const isPending = unitsQuery.isPending || timezoneQuery.isPending;
  const failure = unitsQuery.error ?? timezoneQuery.error;
  const errorTitle =
    failure instanceof ApiError ? errorMessage(failure.problem) : t("content.list.errorTitle");

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{t("content.list.title")}</h1>
        <div className="flex gap-4">
          <Link to="/contenido/subir">{t("content.list.uploadMaterial")}</Link>
          <Link to="/contenido/nuevo">{t("content.list.newUnit")}</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <Selector
          label={t("content.list.statusLabel")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={CONTENT_STATUSES.map((value) => ({ value, label: t(`content.status.${value}`) }))}
          placeholder={t("content.list.statusAll")}
        />
      </div>

      {isPending && <p role="status">{t("common.loading")}</p>}

      <Table
        columns={columns}
        rows={unitsQuery.data ?? []}
        getRowKey={(row) => row.contentUnitId}
        caption={t("content.list.caption")}
        captionVisuallyHidden
        isLoading={isPending}
        error={
          failure ? (
            <ErrorState
              title={errorTitle}
              action={
                <Button
                  onClick={() => {
                    void unitsQuery.refetch();
                    void timezoneQuery.refetch();
                  }}
                >
                  {t("common.retry")}
                </Button>
              }
            />
          ) : undefined
        }
        emptyState={
          <EmptyState
            title={t("content.list.emptyTitle")}
            description={t("content.list.emptyDescription")}
            action={<Link to="/contenido/nuevo">{t("content.list.newUnit")}</Link>}
          />
        }
      />
    </main>
  );
}
