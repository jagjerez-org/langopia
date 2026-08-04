import type { Meta, StoryObj } from "@storybook/react";
import {
  managementPayments,
  paymentActions,
  paymentsPageLabels,
  paymentSummaryKpis,
} from "../../fixtures/management.js";
import { PaymentsPage } from "./PaymentsPage.js";

const meta = {
  title: "Organisms/PaymentsPage",
  component: PaymentsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    summary: paymentSummaryKpis,
    payments: managementPayments,
    actions: paymentActions,
    labels: paymentsPageLabels,
    onAction: () => {},
  },
} satisfies Meta<typeof PaymentsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Paginated: Story = {
  args: {
    pageSize: 3,
  },
};
