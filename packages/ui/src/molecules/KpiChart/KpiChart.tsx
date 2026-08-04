import type { ReactElement } from "react";

export type KpiTrend = "up" | "down";

export interface KpiChartProps {
  /** Nombre de la métrica (ya traducido). */
  title: string;
  /** Valor principal, ya formateado por quien llama (p. ej. "1.240 €"). */
  value: string;
  /** Variación respecto al periodo anterior, ya formateada (p. ej. "+12 %"). */
  delta?: string;
  /** Dirección de la tendencia: color semántico e icono de flecha. */
  trend?: KpiTrend;
  /**
   * Lectura accesible de la tendencia (ya traducida, p. ej. "sube un 12 %").
   * Se renderiza como texto solo para lectores de pantalla.
   */
  trendLabel?: string;
  /** Serie temporal de la mini-gráfica; vacía muestra el estado vacío. */
  data?: number[];
  /** Nombre accesible de la gráfica (ya traducido). */
  chartLabel?: string;
  /** Texto del estado vacío cuando no hay datos. */
  emptyLabel?: string;
  /** Añade una tabla solo para lectores de pantalla con todos los puntos. */
  showDataTable?: boolean;
  /** Formato de cada punto en la tabla accesible; por defecto `String(punto)`. */
  formatPoint?: (point: number, index: number) => string;
}

// Geometría de la mini-gráfica: viewBox fijo, la serie se normaliza a él.
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 40;
const PADDING_Y = 3;

const cardStyles =
  "flex w-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4";
const headerStyles = "flex items-baseline justify-between gap-3";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-muted";
const valueStyles =
  "m-0 font-sans text-[length:var(--ink-text-3xl)] leading-[var(--ink-leading-3xl)] font-semibold text-text";
const trendStyles = [
  "inline-flex items-center gap-1 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium",
  "data-[trend=up]:text-success data-[trend=down]:text-critical",
].join(" ");
const chartStyles = "block h-16 w-full text-accent";
const emptyStyles =
  "flex h-16 items-center justify-center font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/** Flecha de tendencia: decorativa, la dirección la anuncia `trendLabel`. */
function TrendArrow({ trend }: { trend: KpiTrend }): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable={false}
    >
      {trend === "up" ? (
        <path
          d="M10 15V5m0 0l-4.5 4.5M10 5l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M10 5v10m0 0l4.5-4.5M10 15L5.5 10.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Normaliza la serie al viewBox: x repartido, y invertido con margen vertical. */
function toPoints(data: number[]): string {
  if (data.length === 1) {
    return `50,${VIEW_HEIGHT / 2}`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const usable = VIEW_HEIGHT - PADDING_Y * 2;
  return data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * VIEW_WIDTH;
      const y = VIEW_HEIGHT - PADDING_Y - ((value - min) / range) * usable;
      return `${x},${y}`;
    })
    .join(" ");
}

/**
 * Tarjeta de KPI: título, valor principal, tendencia con color semántico
 * (verde/rojo + flecha, nunca solo color: la lectura textual va en
 * `trendLabel`) y una mini-gráfica SVG propia, sin librerías — una polyline
 * con área normalizada al viewBox a partir de `data`. Los atributos de
 * geometría del SVG son datos, no estilos.
 */
export function KpiChart({
  title,
  value,
  delta,
  trend,
  trendLabel,
  data = [],
  chartLabel,
  emptyLabel = "Sin datos",
  showDataTable = false,
  formatPoint = (point) => String(point),
}: KpiChartProps): ReactElement {
  const points = toPoints(data);
  const area = `0,${VIEW_HEIGHT} ${points} ${VIEW_WIDTH},${VIEW_HEIGHT}`;

  return (
    <div className={cardStyles}>
      <div className={headerStyles}>
        <h3 className={titleStyles}>{title}</h3>
        {trend && delta && (
          <span className={trendStyles} data-trend={trend}>
            <TrendArrow trend={trend} />
            {trendLabel && <span className="sr-only">{trendLabel}</span>
            }
            {delta}
          </span>
        )}
      </div>
      <p className={valueStyles}>{value}</p>
      {data.length === 0 ? (
        <p className={emptyStyles}>{emptyLabel}</p>
      ) : (
        <>
          <svg
            className={chartStyles}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={chartLabel ?? title}
          >
            <polygon points={area} fill="currentColor" opacity="0.12" />
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {showDataTable && (
            <table className="sr-only">
              <tbody>
                {data.map((point, index) => (
                  <tr key={index}>
                    <td>{formatPoint(point, index)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
