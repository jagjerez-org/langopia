import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";

const { issueInvoiceMock, listStudentsForBillingMock, getBillingTargetsMock } = vi.hoisted(() => ({
  issueInvoiceMock: vi.fn(),
  listStudentsForBillingMock: vi.fn(),
  getBillingTargetsMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    issueInvoice: issueInvoiceMock,
    listStudentsForBilling: listStudentsForBillingMock,
    getBillingTargets: getBillingTargetsMock,
  };
});

const { IssueInvoiceDialog } = await import("./IssueInvoiceDialog.js");

function renderDialog(onIssued = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onIssued,
    ...render(
      <QueryClientProvider client={queryClient}>
        <IssueInvoiceDialog open onClose={() => {}} onIssued={onIssued} />
      </QueryClientProvider>,
    ),
  };
}

describe("IssueInvoiceDialog (Tarea 10, Paso 3)", () => {
  beforeEach(() => {
    issueInvoiceMock.mockReset();
    listStudentsForBillingMock.mockReset().mockResolvedValue([
      { studentId: "s1", membershipId: "m1", name: "Nerea Campos", guardianRequired: false },
    ]);
    getBillingTargetsMock.mockReset().mockResolvedValue([{ membershipId: "m1", name: "Nerea Campos" }]);
  });

  it("convierte el precio tecleado a céntimos y el IVA de % a puntos básicos al enviar", async () => {
    issueInvoiceMock.mockResolvedValue({
      invoiceId: "inv-1",
      number: "2026-0099",
      totalCents: 18_150,
      currency: "EUR",
      applicationFeeBps: 200,
      applicationFeeCents: 363,
    });
    const user = userEvent.setup();
    const onIssued = vi.fn();

    renderDialog(onIssued);

    await screen.findByRole("option", { name: "Nerea Campos" });
    await user.selectOptions(screen.getByLabelText(/Alumno/), "s1");
    await waitFor(() => expect(getBillingTargetsMock).toHaveBeenCalledWith("m1", "Nerea Campos"));
    await waitFor(() =>
      expect((screen.getByLabelText(/Facturar a/) as HTMLSelectElement).value).toBe("m1"),
    );

    await user.type(screen.getByLabelText(/Descripción/), "Mensualidad de agosto");
    await user.clear(screen.getByLabelText(/Cantidad/));
    await user.type(screen.getByLabelText(/Cantidad/), "1");
    await user.type(screen.getByLabelText(/Precio unitario/), "150,50");
    await user.clear(screen.getByLabelText(/IVA aplicable/));
    await user.type(screen.getByLabelText(/IVA aplicable/), "21");
    await user.type(screen.getByLabelText(/Fecha de vencimiento/), "2026-08-15");

    await user.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(issueInvoiceMock).toHaveBeenCalledTimes(1));
    const [payload] = issueInvoiceMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({
      studentId: "s1",
      billToMembershipId: "m1",
      lines: [{ description: "Mensualidad de agosto", quantity: 1, unitCents: 15_050 }],
      taxRateBps: 2100,
      dueOn: "2026-08-15T00:00:00.000Z",
    });
    expect(onIssued).toHaveBeenCalledWith({ invoiceId: "inv-1", number: "2026-0099" });
  });

  it("un precio no numérico se rechaza sin llamar a la API", async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByRole("option", { name: "Nerea Campos" });
    await user.selectOptions(screen.getByLabelText(/Alumno/), "s1");
    await waitFor(() => expect(getBillingTargetsMock).toHaveBeenCalled());
    await user.type(screen.getByLabelText(/Descripción/), "Mensualidad");
    await user.type(screen.getByLabelText(/Precio unitario/), "abc");
    await user.type(screen.getByLabelText(/Fecha de vencimiento/), "2026-08-15");

    await user.click(screen.getByRole("button", { name: "Emitir factura" }));

    await screen.findByText("Escribe un importe válido, con hasta dos decimales.");
    expect(issueInvoiceMock).not.toHaveBeenCalled();
  });

  it("un error de la API se muestra traducido, nunca el code crudo", async () => {
    issueInvoiceMock.mockRejectedValue(
      new ApiError({ code: "invalid_invoice_line", title: "Línea de factura no válida.", status: 400 }),
    );
    const user = userEvent.setup();
    renderDialog();

    await screen.findByRole("option", { name: "Nerea Campos" });
    await user.selectOptions(screen.getByLabelText(/Alumno/), "s1");
    await waitFor(() => expect(getBillingTargetsMock).toHaveBeenCalled());
    await user.type(screen.getByLabelText(/Descripción/), "Mensualidad");
    await user.type(screen.getByLabelText(/Precio unitario/), "150");
    await user.type(screen.getByLabelText(/Fecha de vencimiento/), "2026-08-15");

    await user.click(screen.getByRole("button", { name: "Emitir factura" }));

    await screen.findByText("Línea de factura no válida.");
    expect(screen.queryByText("invalid_invoice_line")).toBeNull();
  });
});
