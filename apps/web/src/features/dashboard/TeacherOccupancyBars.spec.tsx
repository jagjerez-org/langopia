import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import type { TeacherOccupancyView } from "./api.js";

const { getTeacherOccupancyMock } = vi.hoisted(() => ({
  getTeacherOccupancyMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, getTeacherOccupancy: getTeacherOccupancyMock };
});

const { TeacherOccupancyBars } = await import("./TeacherOccupancyBars.js");

function renderBars() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherOccupancyBars />
    </QueryClientProvider>,
  );
}

/**
 * Igual que en el seed de la Escuela Atlántico
 * (`packages/db/src/seed/scenarios/atlantico.ts`): 22, 20, 18, 11 y 9
 * sesiones de una hora sobre 24 horas contratadas — verificado contra
 * Postgres real con el mismo rango que calcula `currentWeekRange` (ver el
 * informe de esta tarea) — con la `signal` que calcularía
 * `GetTeacherOccupancyHandler` (sobrecarga ≥ 90 %, infrautilización < 60 %).
 */
const seedOccupancy: TeacherOccupancyView[] = [
  {
    teacherId: "carla",
    teacherName: "Carla Ruiz",
    scheduledHours: 22,
    contractedHours: 24,
    occupancyRate: 22 / 24,
    sessionCount: 22,
    signal: "overloaded",
  },
  {
    teacherId: "dan",
    teacherName: "Dan Whitfield",
    scheduledHours: 20,
    contractedHours: 24,
    occupancyRate: 20 / 24,
    sessionCount: 20,
    signal: "healthy",
  },
  {
    teacherId: "sofia",
    teacherName: "Sofia Mancini",
    scheduledHours: 18,
    contractedHours: 24,
    occupancyRate: 18 / 24,
    sessionCount: 18,
    signal: "healthy",
  },
  {
    teacherId: "yuki",
    teacherName: "Yuki Tanaka",
    scheduledHours: 11,
    contractedHours: 24,
    occupancyRate: 11 / 24,
    sessionCount: 11,
    signal: "underused",
  },
  {
    teacherId: "marc",
    teacherName: "Marc Delaunay",
    scheduledHours: 9,
    contractedHours: 24,
    occupancyRate: 9 / 24,
    sessionCount: 9,
    signal: "underused",
  },
];

describe("TeacherOccupancyBars (Tarea 6, Paso 5)", () => {
  beforeEach(() => {
    getTeacherOccupancyMock.mockReset();
  });

  it("mientras carga, no pinta ninguna barra todavía", () => {
    getTeacherOccupancyMock.mockReturnValue(new Promise(() => {}));

    renderBars();

    expect(screen.queryByText("Carla Ruiz")).toBeNull();
  });

  it("sin profesorado con clases en la semana, muestra el estado vacío", async () => {
    getTeacherOccupancyMock.mockResolvedValue([]);

    renderBars();

    await screen.findByRole("status");
    screen.getByText("No hay profesorado con clases programadas esta semana.");
  });

  it("Paso 6 del brief: reproduce los porcentajes exactos del seed sobre 24 horas contratadas", async () => {
    getTeacherOccupancyMock.mockResolvedValue(seedOccupancy);

    renderBars();

    await screen.findByText("Carla Ruiz");
    screen.getByText("92 %");
    screen.getByText("Dan Whitfield");
    screen.getByText("83 %");
    screen.getByText("Sofia Mancini");
    screen.getByText("75 %");
    screen.getByText("Yuki Tanaka");
    screen.getByText("46 %");
    screen.getByText("Marc Delaunay");
    screen.getByText("38 %");
  });

  it("cada barra lleva la etiqueta de estado que ya decidió la API, no una recalculada aquí", async () => {
    getTeacherOccupancyMock.mockResolvedValue(seedOccupancy);

    renderBars();

    await screen.findByText("Carla Ruiz");
    screen.getByText("Sobrecarga");
    expect(screen.getAllByText("Equilibrado")).toHaveLength(2);
    expect(screen.getAllByText("Infrautilizado")).toHaveLength(2);
  });

  it("un error de la API se muestra traducido, con botón de reintentar", async () => {
    getTeacherOccupancyMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "boom",
        status: 403,
        params: { required: "owner" },
      }),
    );

    renderBars();

    await screen.findByRole("alert");
    screen.getByText("Esta acción requiere el rol owner.");
    screen.getByRole("button", { name: "Reintentar" });
  });
});
