import type { KpiChartProps } from "../molecules/KpiChart/KpiChart.js";

/**
 * Datos ficticios neutros para stories y specs de `KpiChart`.
 */

export const kpiUp: Pick<
  KpiChartProps,
  "title" | "value" | "delta" | "trend" | "trendLabel" | "data" | "chartLabel"
> = {
  title: "Visitas semanales",
  value: "12.480",
  delta: "+8,2 %",
  trend: "up",
  trendLabel: "sube un 8,2 %",
  data: [42, 55, 48, 61, 58, 72, 69, 84],
  chartLabel: "Evolución de las visitas semanales, tendencia ascendente",
};

export const kpiDown: Pick<
  KpiChartProps,
  "title" | "value" | "delta" | "trend" | "trendLabel" | "data" | "chartLabel"
> = {
  title: "Tiempo medio de respuesta",
  value: "3,4 s",
  delta: "-12,5 %",
  trend: "down",
  trendLabel: "baja un 12,5 %",
  data: [88, 76, 81, 64, 59, 47, 52, 39],
  chartLabel: "Evolución del tiempo medio de respuesta, tendencia descendente",
};
