import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import type { AtRiskStudent, DashboardSummary } from "./api.js";

const { getDashboardSummaryMock } = vi.hoisted(() => ({
  getDashboardSummaryMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, getDashboardSummary: getDashboardSummaryMock };
});

const { AtRiskStudentsTable } = await import("./AtRiskStudentsTable.js");

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AtRiskStudentsTable />
    </QueryClientProvider>,
  );
}

function summaryWith(students: AtRiskStudent[]): DashboardSummary {
  return {
    activeStudents: 48,
    averageAttendanceRate: 0.7,
    nps: null,
    invoicedThisMonth: { amountCents: 0, currency: "EUR" },
    studentsRequiringAttention: students,
  };
}

describe("AtRiskStudentsTable (Tarea 6, Paso 4)", () => {
  beforeEach(() => {
    getDashboardSummaryMock.mockReset();
  });

  it("mientras carga, pinta la tabla como ocupada", () => {
    getDashboardSummaryMock.mockReturnValue(new Promise(() => {}));

    renderTable();

    const table = screen.getByRole("table");
    expect(table.getAttribute("aria-busy")).toBe("true");
  });

  it("sin alumnos en riesgo, muestra el estado vacío (una buena noticia, no un fallo)", async () => {
    getDashboardSummaryMock.mockResolvedValue(summaryWith([]));

    renderTable();

    await screen.findByRole("status");
    screen.getByText("Ningún alumno requiere atención ahora mismo.");
  });

  it("con alumnos, pinta nombre (enlazado a la ficha), asistencia, valoración y estado", async () => {
    getDashboardSummaryMock.mockResolvedValue(
      summaryWith([
        {
          studentId: "11111111-1111-1111-1111-111111111111",
          name: "Zaira Nogales",
          attendanceRate: 0.42,
          weeksSinceLastEvaluation: 5,
          reasons: ["low_attendance"],
        },
        {
          studentId: "22222222-2222-2222-2222-222222222222",
          name: "Andrés Cuevas",
          attendanceRate: null,
          weeksSinceLastEvaluation: null,
          reasons: ["no_recent_evaluation"],
        },
      ]),
    );

    renderTable();

    const link = await screen.findByRole("link", { name: "Zaira Nogales" });
    expect(link.getAttribute("href")).toBe("/alumnos/11111111-1111-1111-1111-111111111111");
    screen.getByText("42 %");
    screen.getByText("hace 5 semanas");
    screen.getByText("Riesgo de baja");

    screen.getByText("Sin clases en el periodo");
    screen.getByText("Nunca valorado");
    screen.getByText("Pendiente de revisar");
  });

  it("un alumno con las dos razones muestra las dos etiquetas de estado", async () => {
    getDashboardSummaryMock.mockResolvedValue(
      summaryWith([
        {
          studentId: "33333333-3333-3333-3333-333333333333",
          name: "Berta Lozano",
          attendanceRate: 0.3,
          weeksSinceLastEvaluation: 6,
          reasons: ["low_attendance", "no_recent_evaluation"],
        },
      ]),
    );

    renderTable();

    const row = (await screen.findByText("Berta Lozano")).closest("tr");
    if (!row) throw new Error("no se encontró la fila de Berta Lozano");
    within(row).getByText("Riesgo de baja");
    within(row).getByText("Pendiente de revisar");
  });

  it("un error de la API se muestra traducido, con botón de reintentar", async () => {
    getDashboardSummaryMock.mockRejectedValue(
      new ApiError({ code: "internal_error", title: "Ha ocurrido un error", status: 500 }),
    );

    renderTable();

    await screen.findByRole("alert");
    screen.getByText("Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.");
    screen.getByRole("button", { name: "Reintentar" });
  });

  it("no pierde ninguna fila cuando la lista es larga (33 de 48, como en el seed de Atlántico)", async () => {
    const students: AtRiskStudent[] = Array.from({ length: 33 }, (_, index) => ({
      studentId: `student-${index}`,
      name: `Alumno ${index}`,
      attendanceRate: 0.5,
      weeksSinceLastEvaluation: 4,
      reasons: ["low_attendance"],
    }));
    getDashboardSummaryMock.mockResolvedValue(summaryWith(students));

    renderTable();

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(34)); // 33 + cabecera
  });
});
