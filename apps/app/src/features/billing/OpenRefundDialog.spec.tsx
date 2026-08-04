import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";

const { openRefundMock } = vi.hoisted(() => ({ openRefundMock: vi.fn() }));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, openRefund: openRefundMock };
});

const { OpenRefundDialog } = await import("./OpenRefundDialog.js");

describe("OpenRefundDialog (Tarea 10, Paso 3)", () => {
  beforeEach(() => {
    openRefundMock.mockReset();
  });

  it("enseña lo disponible para devolver, tal cual lo trae la API", () => {
    render(
      <OpenRefundDialog
        open
        invoiceId="inv-1"
        currency="EUR"
        refundableCents={12_100}
        onClose={() => {}}
        onRefunded={() => {}}
      />,
    );

    screen.getByText("Disponible para devolver: 121,00 €.");
  });

  it("convierte el importe tecleado a céntimos al enviar", async () => {
    openRefundMock.mockResolvedValue({
      refundId: "ref-1",
      status: "pending",
      feeReversedCents: 0,
      receiptNumber: null,
    });
    const onRefunded = vi.fn();
    const user = userEvent.setup();

    render(
      <OpenRefundDialog
        open
        invoiceId="inv-1"
        currency="EUR"
        refundableCents={12_100}
        onClose={() => {}}
        onRefunded={onRefunded}
      />,
    );

    await user.type(screen.getByLabelText(/Importe a devolver/), "50");
    await user.selectOptions(screen.getByLabelText(/Motivo/), "service_not_provided");
    await user.click(screen.getByRole("button", { name: "Abrir devolución" }));

    await waitFor(() => expect(openRefundMock).toHaveBeenCalledTimes(1));
    const [invoiceId, payload] = openRefundMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(invoiceId).toBe("inv-1");
    expect(payload).toMatchObject({ amountCents: 5_000, reason: "service_not_provided" });
    expect(onRefunded).toHaveBeenCalledWith({ refundId: "ref-1" });
  });

  it("refund_exceeds_payment se muestra junto al campo de importe, no como aviso genérico", async () => {
    openRefundMock.mockRejectedValue(
      new ApiError({ code: "refund_exceeds_payment", title: "No se puede devolver más de lo cobrado.", status: 409 }),
    );
    const user = userEvent.setup();

    render(
      <OpenRefundDialog
        open
        invoiceId="inv-1"
        currency="EUR"
        refundableCents={5_000}
        onClose={() => {}}
        onRefunded={() => {}}
      />,
    );

    await user.type(screen.getByLabelText(/Importe a devolver/), "500");
    await user.selectOptions(screen.getByLabelText(/Motivo/), "goodwill");
    await user.click(screen.getByRole("button", { name: "Abrir devolución" }));

    await waitFor(() => screen.getByText("No se puede devolver más de lo cobrado."));
    const amountInput = screen.getByLabelText(/Importe a devolver/) as HTMLInputElement;
    expect(amountInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("sin credenciales del proveedor de pago, un envío válido falla de forma limpia (internal_error)", async () => {
    openRefundMock.mockRejectedValue(
      new ApiError({
        code: "internal_error",
        title: "Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.",
        status: 500,
      }),
    );
    const user = userEvent.setup();

    render(
      <OpenRefundDialog
        open
        invoiceId="inv-1"
        currency="EUR"
        refundableCents={5_000}
        onClose={() => {}}
        onRefunded={() => {}}
      />,
    );

    await user.type(screen.getByLabelText(/Importe a devolver/), "50");
    await user.selectOptions(screen.getByLabelText(/Motivo/), "goodwill");
    await user.click(screen.getByRole("button", { name: "Abrir devolución" }));

    await screen.findByText("Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.");
  });
});
