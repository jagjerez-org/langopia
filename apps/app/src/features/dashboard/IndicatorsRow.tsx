import type { ReactElement, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Panel, ErrorState, Skeleton, Chip } from "@langopia/ui";
import { useLocale, useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatMoney } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { formatPercent } from "./format.js";
import { DASHBOARD_SUMMARY_QUERY_KEY, getDashboardSummary } from "./api.js";

interface IndicatorProps {
  label: ReactNode;
  hint?: ReactNode;
  value?: ReactNode;
  isLoading: boolean;
  /** Ola 3: la métrica todavía no existe — no es un fallo de carga, es un estado propio. */
  pending?: ReactNode;
}

/** Una tarjeta. La cifra se pinta en cuanto llega, incluido un cero real: no hay "vacío" que fabricar aquí. */
function Indicator({ label, hint, value, isLoading, pending }: IndicatorProps): ReactElement {
  return (
    <Panel>
      <p className="font-medium text-muted text-[length:var(--ink-text-sm)]">{label}</p>
      {isLoading ? (
        <Skeleton variant="text" className="w-16 h-[var(--ink-text-3xl)]" />
      ) : pending !== undefined ? (
        <Chip variant="neutral">{pending}</Chip>
      ) : (
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p>
      )}
      {hint && !isLoading && <p className="mt-1 text-xs text-[color:var(--ink-text-tertiary)]">{hint}</p>}
    </Panel>
  );
}

/**
 * Fila de indicadores (Tarea 6, Paso 3): alumnos activos, asistencia media,
 * NPS y facturado en el mes. Sin minigráfico de tendencia — `GET
 * /dashboard/summary` (`DashboardSummary`, ya congelada y verificada) no
 * trae ninguna serie temporal ni delta con el periodo anterior, solo el
 * valor actual de cada métrica; fabricar una tendencia aquí sería la
 * decisión de negocio que `OLA-1-WEB.md` prohíbe tomar en el cliente. Ver
 * la nota del informe de esta tarea.
 */
export function IndicatorsRow(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const getErrorMessage = useErrorMessage();
  const query = useQuery({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY, queryFn: getDashboardSummary });

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? getErrorMessage(query.error.problem)
        : t("common.unexpectedError");
    return (
      <ErrorState
        title={message}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const summary = query.data;
  const isLoading = query.isPending;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
      <Indicator
        label={t("dashboard.indicators.activeStudents")}
        value={summary ? new Intl.NumberFormat(locale).format(summary.activeStudents) : undefined}
        isLoading={isLoading}
      />
      <Indicator
        label={t("dashboard.indicators.averageAttendance")}
        hint={t("dashboard.indicators.averageAttendanceHint")}
        value={summary ? formatPercent(summary.averageAttendanceRate, locale) : undefined}
        isLoading={isLoading}
      />
      <Indicator
        label={t("dashboard.indicators.nps")}
        pending={t("dashboard.indicators.npsPending")}
        isLoading={isLoading}
      />
      <Indicator
        label={t("dashboard.indicators.invoicedThisMonth")}
        hint={t("dashboard.indicators.invoicedThisMonthHint")}
        value={
          summary
            ? formatMoney(summary.invoicedThisMonth.amountCents, summary.invoicedThisMonth.currency, locale)
            : undefined
        }
        isLoading={isLoading}
      />
    </div>
  );
}
