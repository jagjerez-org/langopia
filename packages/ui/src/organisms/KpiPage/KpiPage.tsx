import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Selector } from "../../atoms/Selector/Selector.js";
import { KpiChart } from "../../molecules/KpiChart/KpiChart.js";
import type { KpiChartProps } from "../../molecules/KpiChart/KpiChart.js";
import { List } from "../../molecules/List/List.js";
import type { ListItem } from "../../molecules/List/List.js";
import { Section } from "../../molecules/Section/Section.js";

/** Opción del selector de rango temporal (p. ej. 7/30/90 días). */
export interface KpiRangeOption {
  value: string;
  /** Texto visible de la opción (ya traducido). */
  label: string;
}

export interface KpiPageLabels {
  /** Título de la página. */
  title: string;
  /** Etiqueta del selector de rango temporal. */
  rangeSelectorLabel: string;
  /** Título de la sección de detalle (obligatorio si hay `detail`). */
  detailTitle?: string;
  /** Nombre accesible de la lista de detalle (obligatorio si hay `detail`). */
  detailListLabel?: string;
}

export interface KpiPageProps {
  /** Tarjetas de KPI: cada entrada se pasa tal cual a `KpiChart`. */
  kpis: KpiChartProps[];
  /** Rangos temporales disponibles, en orden. */
  ranges: KpiRangeOption[];
  /** Rango seleccionado (modo controlado). Si no se pasa, lo gestiona la página. */
  selectedRange?: string;
  /** Rango inicial en modo no controlado; por defecto el primero. */
  defaultRange?: string;
  /** Notifica cada cambio de rango con el `value` de la opción. */
  onRangeChange?: (range: string) => void;
  /** Filas de la sección opcional de detalle (se renderiza con `List`). */
  detail?: ListItem[];
  /** Textos de la interfaz, ya traducidos. */
  labels: KpiPageLabels;
}

const wrapperStyles = "flex w-full flex-col gap-4";
const headerStyles = "flex flex-wrap items-end justify-between gap-3";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const selectorStyles = "w-56";
const gridStyles =
  "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4";

/**
 * Página de métricas: una rejilla de `KpiChart` con un `Selector` de rango
 * temporal que notifica `onRangeChange` (el refresco de datos es cosa de la
 * app; aquí solo cambia la selección) y una sección opcional de detalle con
 * una `List` dentro de una `Section`.
 */
export function KpiPage({
  kpis,
  ranges,
  selectedRange,
  defaultRange,
  onRangeChange,
  detail,
  labels,
}: KpiPageProps): ReactElement {
  const [innerRange, setInnerRange] = useState(defaultRange ?? ranges[0]?.value);
  const range = selectedRange ?? innerRange;

  const changeRange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (selectedRange === undefined) {
      setInnerRange(event.target.value);
    }
    onRangeChange?.(event.target.value);
  };

  return (
    <div className={wrapperStyles}>
      <div className={headerStyles}>
        <h1 className={titleStyles}>{labels.title}</h1>
        <div className={selectorStyles}>
          <Selector
            label={labels.rangeSelectorLabel}
            options={ranges}
            value={range}
            onChange={changeRange}
          />
        </div>
      </div>
      <ul className={gridStyles}>
        {kpis.map((kpi) => (
          <li key={kpi.title}>
            <KpiChart {...kpi} />
          </li>
        ))}
      </ul>
      {detail !== undefined && labels.detailTitle !== undefined && (
        <Section title={labels.detailTitle}>
          <List items={detail} ariaLabel={labels.detailListLabel ?? labels.detailTitle} />
        </Section>
      )}
    </div>
  );
}
