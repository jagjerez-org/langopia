import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import type { DashboardSummary } from "./api.js";

const { getDashboardSummaryMock } = vi.hoisted(() => ({
  getDashboardSummaryMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, getDashboardSummary: getDashboardSummaryMock };
});

const { IndicatorsRow } = await import("./IndicatorsRow.js");

function renderIndicators() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IndicatorsRow />
    </QueryClientProvider>,
  );
}

// 18 940 céntimos, igual que el fixture ya verificado de `formatMoney`
// (`apps/web/src/i18n/format.spec.ts`): "189,40 €" en es-ES/EUR.
const summary: DashboardSummary = {
  activeStudents: 48,
  averageAttendanceRate: 0.83,
  nps: null,
  invoicedThisMonth: { amountCents: 18_940, currency: "EUR" },
  studentsRequiringAttention: [],
};

describe("IndicatorsRow (Tarea 6, Paso 1)", () => {
  beforeEach(() => {
    getDashboardSummaryMock.mockReset();
  });

  it("mientras carga, no enseña ninguna cifra todavía (solo las etiquetas)", () => {
    getDashboardSummaryMock.mockReturnValue(new Promise(() => {}));

    renderIndicators();

    screen.getByText("Alumnos activos");
    expect(screen.queryByText("48")).toBeNull();
  });

  it("con datos, pinta cada indicador con su cifra", async () => {
    getDashboardSummaryMock.mockResolvedValue(summary);

    renderIndicators();

    await waitFor(() => screen.getByText("48"));
    screen.getByText("83 %");
    screen.getByText("189,40 €");
  });

  it("el importe facturado sale en la moneda de la escuela, no fija en EUR", async () => {
    getDashboardSummaryMock.mockResolvedValue({
      ...summary,
      invoicedThisMonth: { amountCents: 18_940, currency: "BRL" },
    } satisfies DashboardSummary);

    renderIndicators();

    await waitFor(() => screen.getByText("189,40 BRL"));
    expect(screen.queryByText("189,40 €")).toBeNull();
  });

  it("el NPS está vacío hasta la ola 3, sin fabricar un cero", async () => {
    getDashboardSummaryMock.mockResolvedValue(summary);

    renderIndicators();

    await waitFor(() => screen.getByText("Próximamente"));
  });

  it("una escuela recién registrada, sin un solo dato, se pinta con ceros reales", async () => {
    getDashboardSummaryMock.mockResolvedValue({
      activeStudents: 0,
      averageAttendanceRate: 0,
      nps: null,
      invoicedThisMonth: { amountCents: 0, currency: "EUR" },
      studentsRequiringAttention: [],
    } satisfies DashboardSummary);

    renderIndicators();

    await waitFor(() => screen.getByText("0,00 €"));
    screen.getByText("0 %");
    screen.getByText("0");
  });

  it("un error de la API se muestra traducido, con botón de reintentar, nunca el code crudo", async () => {
    getDashboardSummaryMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "Requiere el rol admin",
        status: 403,
        params: { required: "owner" },
      }),
    );

    renderIndicators();

    await screen.findByRole("alert");
    screen.getByText("Esta acción requiere el rol owner.");
    expect(screen.queryByText("insufficient_role")).toBeNull();
    screen.getByRole("button", { name: "Reintentar" });
  });

  it("al reintentar tras un error, vuelve a llamar a getDashboardSummary", async () => {
    getDashboardSummaryMock.mockRejectedValueOnce(
      new ApiError({ code: "internal_error", title: "boom", status: 500 }),
    );
    getDashboardSummaryMock.mockResolvedValueOnce(summary);
    const user = userEvent.setup();

    renderIndicators();

    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => screen.getByText("48"));
    expect(getDashboardSummaryMock).toHaveBeenCalledTimes(2);
  });
});
