import type { Meta, StoryObj } from "@storybook/react";
import { KpiChart } from "./KpiChart.js";
import { kpiDown, kpiUp } from "../../fixtures/kpis.js";

const meta: Meta<typeof KpiChart> = {
  title: "Molecules/KpiChart",
  component: KpiChart,
  tags: ["autodocs"],
  args: kpiUp,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const TendenciaAlAlza: Story = {};

export const TendenciaALaBaja: Story = {
  args: kpiDown,
};

export const SinTendencia: Story = {
  args: {
    title: "Documentos activos",
    value: "348",
    data: [12, 18, 15, 22, 30, 27, 35],
    chartLabel: "Evolución de los documentos activos",
  },
};

export const SinDatos: Story = {
  args: {
    title: "Visitas semanales",
    value: "0",
    data: [],
    emptyLabel: "Aún no hay datos de este periodo",
  },
};

export const ConTablaAccesible: Story = {
  args: {
    ...kpiUp,
    showDataTable: true,
    formatPoint: (point: number) => `${point} visitas`,
  },
};
