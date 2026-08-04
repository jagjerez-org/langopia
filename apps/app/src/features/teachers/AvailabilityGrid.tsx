import type { ReactElement } from "react";
import { useT } from "../../i18n/translate.js";
import { WEEKDAYS, cellKey, gridHours } from "./availability-grid.js";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export interface AvailabilityGridProps {
  cells: Set<string>;
  onToggle: (weekday: number, hour: number) => void;
  disabled?: boolean;
}

/**
 * Cuadrícula editable de disponibilidad semanal (Tarea 8, Paso 1): una fila
 * por día, una columna por hora (06:00 a 22:00), cada celda un botón
 * `aria-pressed` que se activa con clic o con teclado (Espacio/Intro, como
 * cualquier `<button>`) — sin inventar un widget ARIA propio para lo que un
 * botón nativo ya resuelve.
 */
export function AvailabilityGrid({ cells, onToggle, disabled = false }: AvailabilityGridProps): ReactElement {
  const t = useT();
  const hours = gridHours();

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <caption className="sr-only">{t("teachers.availability.caption")}</caption>
        <thead>
          <tr>
            <th scope="col"></th>
            {hours.map((hour) => (
              <th key={hour} scope="col" className="text-xs text-muted font-normal px-1 py-1 text-center">
                {hour}:00
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((weekday, index) => (
            <tr key={weekday}>
              <th scope="row" className="text-sm text-left pr-3 whitespace-nowrap font-medium">
                {t(`teachers.availability.${WEEKDAY_KEYS[index]}`)}
              </th>
              {hours.map((hour) => {
                const active = cells.has(cellKey(weekday, hour));
                return (
                  <td key={hour} className="p-0.5">
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={active}
                      aria-label={t("teachers.availability.cellLabel", {
                        weekday: t(`teachers.availability.${WEEKDAY_KEYS[index]}`),
                        hour,
                        state: active
                          ? t("teachers.availability.cellStateActive")
                          : t("teachers.availability.cellStateInactive"),
                      })}
                      onClick={() => onToggle(weekday, hour)}
                      className="w-7 h-7 rounded-sm border border-border"
                      style={{
                        background: active ? "var(--ink-accent-default)" : "var(--ink-bg-surface-secondary)",
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
