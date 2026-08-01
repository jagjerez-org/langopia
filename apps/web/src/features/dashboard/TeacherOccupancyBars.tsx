import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, Skeleton, Tag } from "../../ui/index.js";
import type { TagVariant } from "../../ui/index.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError } from "../../lib/api-client.js";
import { formatHours, formatPercent } from "./format.js";
import { currentWeekRange } from "./current-week-range.js";
import { getTeacherOccupancy } from "./api.js";
import type { TeacherOccupancyView } from "./api.js";
import styles from "./TeacherOccupancyBars.module.css";

const TAG_VARIANT_BY_SIGNAL: Record<TeacherOccupancyView["signal"], TagVariant> = {
  healthy: "success",
  overloaded: "critical",
  underused: "warning",
};

/**
 * Ocupación del profesorado (Tarea 6, Paso 5): barras con la `signal` ya
 * calculada por la API (`GetTeacherOccupancyHandler`: sobrecarga por encima
 * del 90 %, infrautilización por debajo del 60 %). El color y la etiqueta
 * de cada barra SON el umbral — este componente no repite esos dos números
 * en el cliente. Dos copias del mismo umbral es justo el riesgo que
 * prohíbe `OLA-1-WEB.md` («dos verdades y una acabará equivocándose»); aquí
 * solo se traduce la clasificación que ya llegó resuelta.
 *
 * El rango es la semana en curso (`currentWeekRange`, Paso 5): con el seed
 * de la Escuela Atlántico reproduce exactamente Carla 92 %, Dan 83 %,
 * Sofia 75 %, Yuki 46 % y Marc 38 % (verificado contra Postgres real, ver
 * el informe de esta tarea) sin que este fichero calcule ningún
 * porcentaje — los trae la API ya hechos.
 */
export function TeacherOccupancyBars(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const getErrorMessage = useErrorMessage();
  const range = currentWeekRange();
  const query = useQuery({
    queryKey: ["scheduling", "teacher-occupancy", range.from, range.to],
    queryFn: () => getTeacherOccupancy(range),
  });

  const signalLabel: Record<TeacherOccupancyView["signal"], string> = {
    healthy: t("dashboard.occupancy.signalHealthy"),
    overloaded: t("dashboard.occupancy.signalOverloaded"),
    underused: t("dashboard.occupancy.signalUnderused"),
  };

  const body = ((): ReactElement => {
    if (query.isError) {
      return (
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
      );
    }

    if (query.isPending) {
      return (
        <ul className={styles.list}>
          {[0, 1, 2].map((index) => (
            <li key={index} className={styles.row}>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="rect" height="0.5rem" />
            </li>
          ))}
        </ul>
      );
    }

    const rows = query.data ?? [];
    if (rows.length === 0) {
      return <EmptyState title={t("dashboard.occupancy.emptyTitle")} />;
    }

    return (
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.teacherId} className={styles.row}>
            <div className={styles.rowHeader}>
              <span className={styles.name}>{row.teacherName}</span>
              <Tag variant={TAG_VARIANT_BY_SIGNAL[row.signal]}>{signalLabel[row.signal]}</Tag>
              <span className={styles.percent}>{formatPercent(row.occupancyRate, locale)}</span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div
                className={styles.fill}
                data-signal={row.signal}
                style={{ width: `${Math.min(row.occupancyRate, 1) * 100}%` }}
              />
            </div>
            <p className={styles.detail}>
              {t("dashboard.occupancy.detail", {
                scheduled: formatHours(row.scheduledHours, locale),
                contracted: formatHours(row.contractedHours, locale),
                count: row.sessionCount,
              })}
            </p>
          </li>
        ))}
      </ul>
    );
  })();

  return <Card title={t("dashboard.occupancy.title")}>{body}</Card>;
}
