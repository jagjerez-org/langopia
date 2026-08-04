import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceDetail } from "@langopia/contracts";
import { ApiError } from "../../lib/api-client.js";
import { ToastProvider } from "../../ui/index.js";
import "./dialog-polyfill.testsupport.js";
import { createTestRouter } from "./test-router.testsupport.js";

const { getInvoiceDetailMock, getSchoolTimezoneMock, openRefundMock } = vi.hoisted(() => ({
  getInvoiceDetailMock: vi.fn(),
  getSchoolTimezoneMock: vi.fn(),
  openRefundMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getInvoiceDetail: getInvoiceDetailMock,
    getSchoolTimezone: getSchoolTimezoneMock,
    openRefund: openRefundMock,
  };
});

const { InvoiceDetailScreen } = await import("./InvoiceDetailScreen.js");

function renderScreen(invoiceId = "11111111-1111-1111-1111-111111111111") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter(`/facturacion/${invoiceId}`, [
    { path: "/facturacion", component: () => <></> },
    { path: "/facturacion/$invoiceId", component: InvoiceDetailScreen },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label="Avisos" closeLabel="Cerrar aviso">
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

// Factura de Atlántico (2 % de comisión) pagada: 190,00 € de subtotal, sin
// IVA (enseñanza reglada exenta), 2 % de comisión = 3,80 €. Cifras exactas,
// no recalculadas aquí — las trae la API tal cual.
const detail: InvoiceDetail = {
  invoiceId: "11111111-1111-1111-1111-111111111111",
  number: "2026-0001",
  direction: "school_to_student",
  status: "paid",
  currency: "EUR",
  locale: "es-ES",
  billedToName: "Nerea Campos",
  subtotalCents: 19_000,
  taxCents: 0,
  taxRateBps: 0,
  totalCents: 19_000,
  applicationFeeBps: 200,
  applicationFeeCents: 380,
  issuedOn: "2026-07-01T00:00:00.000Z",
  dueOn: "2026-07-08T00:00:00.000Z",
  paidAt: "2026-07-02T10:00:00.000Z",
  amountPaidCents: 19_000,
  amountRefundedCents: 0,
  remainingCents: 0,
  refundableCents: 19_000,
  lines: [
    {
      id: "line-1",
      description: "Preparación DELE C1 — mensualidad de julio",
      quantity: 1,
      unitCents: 19_000,
      totalCents: 19_000,
      courseId: null,
      sessionId: null,
    },
  ],
  payments: [
    {
      paymentId: "pay-1",
      status: "succeeded",
      method: "card",
      amountCents: 19_000,
      currency: "EUR",
      applicationFeeCents: 380,
      provider: "stripe",
      paidAt: "2026-07-02T10:00:00.000Z",
      failureCode: null,
      failureMessage: null,
      createdAt: "2026-07-02T10:00:00.000Z",
    },
  ],
  refunds: [],
};

describe("InvoiceDetailScreen (Tarea 10, Paso 2)", () => {
  beforeEach(() => {
    getInvoiceDetailMock.mockReset();
    getSchoolTimezoneMock.mockReset().mockResolvedValue({ timezone: "Europe/Madrid" });
    openRefundMock.mockReset();
  });

  it("pinta las líneas, el subtotal, el IVA y el total tal cual los trae la API", async () => {
    getInvoiceDetailMock.mockResolvedValue(detail);

    renderScreen();

    await waitFor(() => screen.getByText("Preparación DELE C1 — mensualidad de julio"));
    // El importe de la línea y el total de la factura son el MISMO número
    // (una sola línea, sin IVA): comprobado que aparecen, no recalculado.
    expect(screen.getAllByText("190,00 €").length).toBeGreaterThanOrEqual(2);
  });

  it("desglosa la comisión de plataforma: tasa y céntimos retenidos, tal cual los congeló la API", async () => {
    getInvoiceDetailMock.mockResolvedValue(detail);

    renderScreen();

    await waitFor(() => screen.getByText("2%"));
    // Aparece dos veces a propósito: en la sección de comisión de la factura
    // y en la columna "Comisión retenida" de su único cobro — el mismo dato,
    // congelado, en los dos sitios donde el brief exige mostrarlo.
    expect(screen.getAllByText("3,80 €").length).toBe(2);
  });

  it("una factura sin comisión (Nordwind, o comisión desactivada) lo dice explícitamente, sin pintar 0 %", async () => {
    getInvoiceDetailMock.mockResolvedValue({ ...detail, applicationFeeBps: 0, applicationFeeCents: 0 });

    renderScreen();

    await waitFor(() => screen.getByText("Esta factura no lleva comisión de plataforma."));
  });

  it("una devolución parcial se ve en su propia tabla, con la comisión revertida", async () => {
    getInvoiceDetailMock.mockResolvedValue({
      ...detail,
      amountRefundedCents: 2_300,
      refundableCents: 16_700,
      refunds: [
        {
          refundId: "ref-1",
          paymentId: "pay-1",
          amountCents: 2_300,
          currency: "EUR",
          reason: "service_not_provided",
          status: "succeeded",
          reversesApplicationFee: true,
          applicationFeeReversedCents: 46,
          note: "Dos clases canceladas por la escuela",
          createdAt: "2026-07-15T09:00:00.000Z",
          processedAt: "2026-07-15T09:00:00.000Z",
        },
      ],
    });

    renderScreen();

    await waitFor(() => screen.getByText("23,00 €"));
    const refundsTable = screen.getByRole("table", { name: "Devoluciones" });
    within(refundsTable).getByText("Clase no impartida");
    screen.getByText("0,46 €");
  });

  it("un cobro fallido muestra su motivo, sin marcar la factura como pagada", async () => {
    getInvoiceDetailMock.mockResolvedValue({
      ...detail,
      status: "past_due",
      paidAt: null,
      amountPaidCents: 0,
      refundableCents: 0,
      remainingCents: 19_000,
      payments: [
        {
          ...detail.payments[0]!,
          status: "failed",
          paidAt: null,
          failureCode: "card_declined",
          failureMessage: "La tarjeta fue rechazada por el emisor",
        },
      ],
    });

    renderScreen();

    await waitFor(() => screen.getByText("La tarjeta fue rechazada por el emisor"));
    screen.getByText("Todavía sin pagar");
  });

  it("abre una devolución con motivo desde el botón de la factura", async () => {
    getInvoiceDetailMock.mockResolvedValue(detail);
    openRefundMock.mockResolvedValue({
      refundId: "ref-2",
      status: "pending",
      feeReversedCents: 0,
      receiptNumber: null,
    });
    const user = userEvent.setup();

    renderScreen();

    // Antes de abrir, el `<dialog>` (Tarea 4) todavía no tiene el atributo
    // `open`, así que su contenido no es accesible y solo hay un botón con
    // este nombre: el que abre. El texto del botón que abre y el del que
    // confirma el envío coinciden a propósito ("Abrir devolución" en los
    // dos) — tras abrir, hay que distinguir el segundo por posición.
    await screen.findByRole("button", { name: "Abrir devolución" });
    await user.click(screen.getByRole("button", { name: "Abrir devolución" }));
    await user.type(screen.getByLabelText(/Importe a devolver/), "50");
    await user.selectOptions(screen.getByLabelText(/Motivo/), "goodwill");
    const buttons = await screen.findAllByRole("button", { name: "Abrir devolución" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[buttons.length - 1]!);

    await waitFor(() =>
      expect(openRefundMock).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", {
        amountCents: 5_000,
        reason: "goodwill",
      }),
    );
  });

  it("una factura que no existe muestra el mensaje de no encontrada, no un error genérico", async () => {
    getInvoiceDetailMock.mockRejectedValue(
      new ApiError({ code: "not_found", title: "No existe ese recurso.", status: 404 }),
    );

    renderScreen();

    await waitFor(() => screen.getByText("No existe esa factura en esta escuela."));
  });
});
