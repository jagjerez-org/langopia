import type { Meta, StoryObj } from "@storybook/react";
import {
  checkoutBillingFields,
  checkoutItems,
  checkoutPageLabels,
  checkoutTotal,
} from "../../fixtures/checkout.js";
import { CheckoutPage } from "./CheckoutPage.js";

const meta = {
  title: "Organisms/CheckoutPage",
  component: CheckoutPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    items: checkoutItems,
    total: checkoutTotal,
    billingFields: checkoutBillingFields,
    labels: checkoutPageLabels,
    onSubmit: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof CheckoutPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPaymentSlot: Story = {
  args: {
    // En la app real este slot monta Stripe Elements; aquí es un placeholder.
    paymentSlot: (
      <div className="rounded-md border border-dashed border-border p-4 text-[length:var(--ink-text-sm)] text-muted">
        Zona del método de pago (la app monta aquí el proveedor).
      </div>
    ),
  },
};

export const Processing: Story = {
  args: {
    isProcessing: true,
  },
};

export const WithError: Story = {
  args: {
    error: "El pago fue rechazado. Revisa los datos e inténtalo de nuevo.",
  },
};
