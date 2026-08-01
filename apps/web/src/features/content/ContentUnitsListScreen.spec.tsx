import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import { createTestRouter } from "./test-router.testsupport.js";
import type { ContentUnitListItem } from "./types.js";

const { listUnitsMock, getSchoolTimezoneMock, getSessionMock } = vi.hoisted(() => ({
  listUnitsMock: vi.fn(),
  getSchoolTimezoneMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, listUnits: listUnitsMock, getSchoolTimezone: getSchoolTimezoneMock };
});

vi.mock("../auth/api.js", () => ({ getSession: getSessionMock }));
vi.mock("../impersonation/api.js", () => ({ getActiveImpersonation: vi.fn().mockResolvedValue(null) }));

const { ContentUnitsListScreen } = await import("./ContentUnitsListScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter("/contenido", [
    { path: "/contenido", component: ContentUnitsListScreen },
    { path: "/contenido/nuevo", component: () => <></> },
    { path: "/contenido/$contentUnitId", component: () => <></> },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const unit: ContentUnitListItem = {
  contentUnitId: "22222222-2222-2222-2222-222222222222",
  code: "ES-B1-U7",
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  status: "in_review",
  source: "ai_generated",
  creditsSpent: 23,
  // 23:30 UTC del día 27 es ya el 28 en Madrid: si la fecha se pintara en la
  // zona del navegador (UTC en las pruebas) saldría el día 27.
  createdAt: "2026-07-27T23:30:00.000Z",
  title: "En la consulta del médico",
};

describe("ContentUnitsListScreen (Tarea 11 de la ola 2, Paso 6)", () => {
  beforeEach(() => {
    listUnitsMock.mockReset();
    getSchoolTimezoneMock.mockReset().mockResolvedValue({ timezone: "Europe/Madrid" });
    getSessionMock.mockReset().mockResolvedValue({
      session: { id: "sess-1", expiresAt: "2099-01-01T00:00:00.000Z" },
      user: { id: "user-1", email: "marta.colomer@atlantico.example", name: "Marta", emailVerified: true },
    });
  });

  it("estado de carga: se anuncia mientras se resuelven las unidades", async () => {
    listUnitsMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("estado vacío: sin unidades, invita a generar la primera", async () => {
    listUnitsMock.mockResolvedValue([]);

    renderScreen();

    await screen.findByText("Todavía no hay ninguna unidad");
    screen.getByText("Genera la primera unidad con IA para empezar.");
  });

  it("pinta el estado traducido y la fecha en la zona horaria de la escuela, no la del navegador", async () => {
    listUnitsMock.mockResolvedValue([unit]);

    renderScreen();

    await screen.findByRole("link", { name: "ES-B1-U7" });
    const table = screen.getByRole("table");
    within(table).getByText("Pendiente de revisión");
    within(table).getByText("28 jul 2026");
  });

  it("cambiar el filtro de estado vuelve a pedir el listado con ?status=", async () => {
    listUnitsMock.mockResolvedValue([]);
    const user = userEvent.setup();

    renderScreen();

    await waitFor(() => expect(listUnitsMock).toHaveBeenCalledWith(undefined));

    await user.selectOptions(screen.getByLabelText("Estado"), "published");

    await waitFor(() => expect(listUnitsMock).toHaveBeenCalledWith("published"));
  });

  it("un error de la API se muestra traducido, con botón de reintentar, nunca el code crudo", async () => {
    listUnitsMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "Requiere el rol owner",
        status: 403,
        params: { required: "owner" },
      }),
    );

    renderScreen();

    await screen.findByRole("alert");
    screen.getByText("Esta acción requiere el rol owner.");
    expect(screen.queryByText("insufficient_role")).toBeNull();
    screen.getByRole("button", { name: "Reintentar" });
  });
});
