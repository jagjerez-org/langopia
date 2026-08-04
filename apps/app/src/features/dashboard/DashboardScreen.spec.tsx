import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, it, vi } from "vitest";
import { expect } from "vitest";
import type { DashboardSummary, TeacherOccupancyView } from "./api.js";

const { getDashboardSummaryMock, getTeacherOccupancyMock } = vi.hoisted(() => ({
  getDashboardSummaryMock: vi.fn(),
  getTeacherOccupancyMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getDashboardSummary: getDashboardSummaryMock,
    getTeacherOccupancy: getTeacherOccupancyMock,
  };
});

const { DashboardScreen } = await import("./DashboardScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardScreen />
    </QueryClientProvider>,
  );
}

const emptySummary: DashboardSummary = {
  activeStudents: 0,
  averageAttendanceRate: 0,
  nps: null,
  invoicedThisMonth: { amountCents: 0, currency: "EUR" },
  studentsRequiringAttention: [],
};

const emptyOccupancy: TeacherOccupancyView[] = [];

describe("DashboardScreen (Tarea 6)", () => {
  beforeEach(() => {
    getDashboardSummaryMock.mockReset();
    getTeacherOccupancyMock.mockReset();
  });

  it("pinta los tres bloques de arriba abajo en el orden del brief: indicadores, riesgo, ocupación", async () => {
    getDashboardSummaryMock.mockResolvedValue(emptySummary);
    getTeacherOccupancyMock.mockResolvedValue(emptyOccupancy);

    renderScreen();

    await screen.findByText("Alumnos activos");
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Panel de dirección",
      "Alumnos que requieren atención",
      "Ocupación del profesorado",
    ]);
  });

  it("una escuela recién registrada, sin un solo dato, se pinta entera sin romperse", async () => {
    getDashboardSummaryMock.mockResolvedValue(emptySummary);
    getTeacherOccupancyMock.mockResolvedValue(emptyOccupancy);

    renderScreen();

    await screen.findByText("0,00 €");
    screen.getByText("0 %");
    screen.getByText("Ningún alumno requiere atención ahora mismo.");
    screen.getByText("No hay profesorado con clases programadas esta semana.");
  });
});
