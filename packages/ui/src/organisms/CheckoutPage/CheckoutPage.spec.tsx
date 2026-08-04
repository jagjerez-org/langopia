import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  checkoutBillingFields,
  checkoutItems,
  checkoutPageLabels,
  checkoutTotal,
} from "../../fixtures/checkout.js";
import { CheckoutPage } from "./CheckoutPage.js";

const baseProps = {
  items: checkoutItems,
  total: checkoutTotal,
  billingFields: checkoutBillingFields,
  labels: checkoutPageLabels,
};

describe("CheckoutPage", () => {
  it("renderiza el resumen del pedido con las líneas y el total", () => {
    render(<CheckoutPage {...baseProps} onSubmit={() => {}} />);

    expect(screen.getByRole("heading", { name: "Finalizar compra" })).toBeDefined();
    expect(screen.getByText(/Curso de inglés — nivel B1/)).toBeDefined();
    expect(screen.getByText(/Material del curso/)).toBeDefined();
    expect(screen.getByText("205,00 €")).toBeDefined();
  });

  it("muestra el texto de pago por defecto y el slot cuando se pasa", () => {
    const { rerender } = render(<CheckoutPage {...baseProps} onSubmit={() => {}} />);
    expect(screen.getByText("El método de pago se configura al conectar el proveedor.")).toBeDefined();

    rerender(
      <CheckoutPage {...baseProps} paymentSlot={<p>Tarjeta (Stripe Elements)</p>} onSubmit={() => {}} />,
    );
    expect(screen.getByText("Tarjeta (Stripe Elements)")).toBeDefined();
    expect(
      screen.queryByText("El método de pago se configura al conectar el proveedor."),
    ).toBeNull();
  });

  it("confirmar llama a onSubmit con los datos de facturación", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CheckoutPage {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "Nombre completo" }), "Ana Torres");
    await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Confirmar pago" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0]![0];
    expect(values.fullName).toBe("Ana Torres");
    expect(values.email).toBe("ana@example.com");
    // Los campos vacíos también llegan, vacíos.
    expect(values.city).toBe("");
  });

  it("con isProcessing deshabilita campos y acciones y anuncia el progreso", () => {
    render(<CheckoutPage {...baseProps} isProcessing onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByRole("button", { name: "Confirmar pago" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox", { name: "Nombre completo" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toBe("Procesando el pago…");
  });

  it("muestra el error con role alert", () => {
    render(<CheckoutPage {...baseProps} error="El pago fue rechazado." onSubmit={() => {}} />);

    expect(screen.getByRole("alert").textContent).toBe("El pago fue rechazado.");
  });

  it("cancelar llama a onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<CheckoutPage {...baseProps} onSubmit={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("bloquea el doble submit mientras onSubmit no resuelve y permite reenviar después", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<CheckoutPage {...baseProps} onSubmit={onSubmit} />);

    const submitButton = screen.getByRole("button", { name: "Confirmar pago" });
    // Dos envíos antes de que la promesa resuelva (la prop isProcessing
    // llegaría un render tarde): solo debe llamarse una vez a onSubmit.
    await user.click(submitButton);
    await user.click(submitButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Al resolver se libera la guardia y se puede volver a enviar.
    resolveSubmit!();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await user.click(submitButton);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("también bloquea el doble disparo del mismo gesto con onSubmit síncrono", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CheckoutPage {...baseProps} onSubmit={onSubmit} />);

    const form = screen.getByRole("button", { name: "Confirmar pago" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);

    // La guardia se libera en el siguiente microtask: un envío posterior sí entra.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Confirmar pago" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
