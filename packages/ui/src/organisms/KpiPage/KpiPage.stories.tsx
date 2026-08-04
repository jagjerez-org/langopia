import type { Meta, StoryObj } from "@storybook/react";
import {
  kpiDetailItems,
  kpiPageLabels,
  kpiRangeOptions,
  managementKpis,
} from "../../fixtures/management.js";
import { KpiPage } from "./KpiPage.js";

const meta = {
  title: "Organisms/KpiPage",
  component: KpiPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    kpis: managementKpis,
    ranges: kpiRangeOptions,
    labels: kpiPageLabels,
    onRangeChange: () => {},
  },
} satisfies Meta<typeof KpiPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDetail: Story = {
  args: {
    detail: kpiDetailItems,
  },
};
