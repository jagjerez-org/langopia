import type { Meta, StoryObj } from "@storybook/react";
import {
  checkoutItems,
  checkoutSuccessActions,
  checkoutTotal,
} from "../../fixtures/checkout.js";
import { CheckoutSuccess } from "./CheckoutSuccess.js";

const meta = {
  title: "Organisms/CheckoutSuccess",
  component: CheckoutSuccess,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    title: "Pago completado",
    message: "Recibirás un correo con los detalles de la compra.",
    actions: checkoutSuccessActions,
  },
} satisfies Meta<typeof CheckoutSuccess>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithOrderSummary: Story = {
  args: {
    orderReference: "AB-0001",
    orderReferenceLabel: "Referencia del pedido",
    items: checkoutItems,
    total: checkoutTotal,
    totalLabel: "Total",
  },
};
