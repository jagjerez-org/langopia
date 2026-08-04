import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceListItem } from "@langopia/contracts";
import { ApiError } from "../../lib/api-client.js";
import { createTestRouter } from "./test-router.testsupport.js";

const { listInvoicesMock, getBillingSummaryMock, getSessionMock, listStudentsForBillingMock } = vi.hoisted(
  () => ({
    listInvoicesMock: vi.fn(),
    getBillingSummaryMock: vi.fn(),
    getSessionMock: vi.fn(),
    listStudentsForBillingMock: vi.fn(),
  }),
);

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    listInvoices: listInvoicesMock,
    getBillingSummary: getBillingSummaryMock,
    listStudentsForBilling: listStudentsForBillingMock,
  };
});

vi.mock("../auth/api.js", () => ({ getSession: getSessionMock }));
vi.mock("../impersonation/api.js", () => ({ getActiveImpersonation: vi.fn().mockResolvedValue(null) }));

const { InvoicesListScreen } = await import("./InvoicesListScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter("/facturacion", [
    { path: "/facturacion", component: InvoicesListScreen },
    { path: "/facturacion/$invoiceId", component: () => <></> },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const invoice: InvoiceListItem = {
  invoiceId: "11111111-1111-1111-1111-111111111111",
  number: "2026-0001",
  direction: "school_to_student",
  status: "paid",
  currency: "EUR",
  billedToName: "Nerea Campos",
  totalCents: 19_000,
  amountPaidCents: 19_000,
  amountRefundedCents: 0,
  hasFailedPayment: false,
  issuedOn: "2026-07-01T00:00:00.000Z",
  dueOn: "2026-07-08T00:00:00.000Z",
  paidAt: "2026-07-02T10:00:00.000Z",
};

describe("InvoicesListScreen (Tarea 10, Paso 1)", () => {
  beforeEach(() => {
    listInvoicesMock.mockReset();
    getBillingSummaryMock.mockReset();
    listStudentsForBillingMock.mockReset().mockResolvedValue([]);
    getSessionMock.mockReset().mockResolvedValue({
      session: { id: "sess-1", expiresAt: "2099-01-01T00:00:00.000Z" },
      user: { id: "user-1", email: "marta.colomer@atlantico.example", name: "Marta", emailVerified: true },
    });
  });

  it("estado de carga: se anuncia mientras se resuelven las facturas y el total del mes", async () => {
    listInvoicesMock.mockReturnValue(new Promise(() => {}));
    getBillingSummaryMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("estado vacío: sin facturas y sin filtro, invita a emitir la primera", async () => {
    listInvoicesMock.mockResolvedValue([]);
    getBillingSummaryMock.mockResolvedValue({ monthTotal: { currency: "EUR", totalCents: 0 } });

    renderScreen();

    await waitFor(() => screen.getByText("Todavía no hay ninguna factura."));
  });

  it("pinta el importe en la moneda de la factura, el estado y el total del mes", async () => {
    listInvoicesMock.mockResolvedValue([invoice]);
    getBillingSummaryMock.mockResolvedValue({ monthTotal: { currency: "EUR", totalCents: 45_000 } });

    renderScreen();

    await waitFor(() => screen.getByText("190,00 €"));
    within(screen.getByRole("table")).getByText("Pagada");
    screen.getByText("450,00 €");
    screen.getByText("Nerea Campos");
  });

  it("una factura con un cobro fallido muestra la etiqueta de aviso", async () => {
    listInvoicesMock.mockResolvedValue([{ ...invoice, status: "past_due", hasFailedPayment: true }]);
    getBillingSummaryMock.mockResolvedValue({ monthTotal: { currency: "EUR", totalCents: 0 } });

    renderScreen();

    await waitFor(() => screen.getByText("Cobro fallido"));
  });

  it("cambiar el filtro de estado vuelve a pedir el listado con ?status=", async () => {
    listInvoicesMock.mockResolvedValue([]);
    getBillingSummaryMock.mockResolvedValue({ monthTotal: { currency: "EUR", totalCents: 0 } });
    const user = userEvent.setup();

    renderScreen();

    await waitFor(() => expect(listInvoicesMock).toHaveBeenCalledWith(undefined));

    await user.selectOptions(screen.getByLabelText("Estado"), "paid");

    await waitFor(() => expect(listInvoicesMock).toHaveBeenCalledWith("paid"));
  });

  it("un error de la API se muestra traducido, con botón de reintentar, nunca el code crudo", async () => {
    listInvoicesMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "Requiere el rol owner",
        status: 403,
        params: { required: "owner" },
      }),
    );
    getBillingSummaryMock.mockResolvedValue({ monthTotal: { currency: "EUR", totalCents: 0 } });

    renderScreen();

    await screen.findByRole("alert");
    screen.getByText("Esta acción requiere el rol owner.");
    expect(screen.queryByText("insufficient_role")).toBeNull();
    screen.getByRole("button", { name: "Reintentar" });
  });
});
