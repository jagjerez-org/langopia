import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  checkoutItems,
  checkoutSuccessActions,
  checkoutTotal,
} from "../../fixtures/checkout.js";
import { CheckoutSuccess } from "./CheckoutSuccess.js";

describe("CheckoutSuccess", () => {
  it("renderiza título, mensaje y referencia del pedido", () => {
    render(
      <CheckoutSuccess
        title="Pago completado"
        message="Recibirás un correo con los detalles de la compra."
        orderReference="AB-0001"
        orderReferenceLabel="Referencia del pedido"
        actions={checkoutSuccessActions}
      />,
    );

    expect(screen.getByRole("heading", { name: "Pago completado" })).toBeDefined();
    expect(screen.getByText("Recibirás un correo con los detalles de la compra.")).toBeDefined();
    expect(screen.getByText(/Referencia del pedido/)).toBeDefined();
    expect(screen.getByText("AB-0001")).toBeDefined();
  });

  it("muestra el resumen del pedido cuando se pasa", () => {
    render(
      <CheckoutSuccess
        title="Pago completado"
        items={checkoutItems}
        total={checkoutTotal}
        totalLabel="Total"
        actions={checkoutSuccessActions}
      />,
    );

    expect(screen.getByText(/Tasa de matrícula/)).toBeDefined();
    expect(screen.getByText("205,00 €")).toBeDefined();
  });

  it("sin resumen ni referencia solo muestra título y acciones", () => {
    render(<CheckoutSuccess title="Pago completado" actions={checkoutSuccessActions} />);

    expect(screen.queryByText(/Referencia del pedido/)).toBeNull();
    expect(screen.queryByText(/Tasa de matrícula/)).toBeNull();
  });

  it("las acciones son enlaces a sus destinos", () => {
    render(<CheckoutSuccess title="Pago completado" actions={checkoutSuccessActions} />);

    expect(screen.getByRole("link", { name: "Volver al panel" }).getAttribute("href")).toBe("/panel");
    expect(screen.getByRole("link", { name: "Ver factura" }).getAttribute("href")).toBe(
      "/facturas/AB-0001",
    );
  });
});
