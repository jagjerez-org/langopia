import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgendaEntry } from "@langopia/contracts";
import { ApiError } from "../../lib/api-client.js";

const { getSchoolTimezoneMock, getAgendaMock, getSessionMock } = vi.hoisted(() => ({
  getSchoolTimezoneMock: vi.fn(),
  getAgendaMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getSchoolTimezone: getSchoolTimezoneMock,
    getAgenda: getAgendaMock,
  };
});

// `CalendarScreen` usa `useSession()` (para distinguir el caché de una
// escuela del de otra, ver el comentario de `tenantCacheKey`): sin este
// mock intentaría un `fetch` real contra `/auth/get-session` en jsdom.
vi.mock("../auth/api.js", () => ({ getSession: getSessionMock }));
vi.mock("../impersonation/api.js", () => ({ getActiveImpersonation: vi.fn().mockResolvedValue(null) }));

const { CalendarScreen } = await import("./CalendarScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarScreen />
    </QueryClientProvider>,
  );
}

const session: AgendaEntry = {
  sessionId: "11111111-1111-1111-1111-111111111111",
  groupId: "22222222-2222-2222-2222-222222222222",
  groupName: "B1 tardes",
  courseCode: "ES-B1",
  teacherId: "33333333-3333-3333-3333-333333333333",
  teacherName: "Carla Ruiz",
  start: "2026-07-27T09:00:00.000Z",
  end: "2026-07-27T10:00:00.000Z",
  status: "scheduled",
  roomProvider: "zoom",
  roomUrl: "https://zoom.example/1",
  topic: null,
  enrolledStudents: 6,
};

describe("CalendarScreen (Tarea 9)", () => {
  beforeEach(() => {
    getSchoolTimezoneMock.mockReset();
    getAgendaMock.mockReset();
    getSessionMock.mockReset().mockResolvedValue({
      session: { id: "sess-1", expiresAt: "2099-01-01T00:00:00.000Z" },
      user: { id: "user-1", email: "marta.colomer@atlantico.example", name: "Marta", emailVerified: true },
    });
  });

  it("estado de carga: se anuncia mientras se resuelve la zona horaria de la escuela", () => {
    getSchoolTimezoneMock.mockReturnValue(new Promise(() => {})); // nunca se resuelve
    getAgendaMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    expect(screen.getByRole("status").textContent).toBe("Cargando…");
  });

  it("estado de error: si la zona horaria no carga, se ofrece reintentar con el mensaje traducido, nunca el code crudo", async () => {
    getSchoolTimezoneMock.mockRejectedValue(
      new ApiError({ code: "internal_error", title: "Fallo simulado", status: 500 }),
    );
    getAgendaMock.mockResolvedValue([]);

    renderScreen();

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.",
    );
    expect(screen.queryByText("internal_error")).toBeNull();
    screen.getByRole("button", { name: "Reintentar" });
  });

  it("estado vacío: una semana sin clases ofrece programar la primera", async () => {
    getSchoolTimezoneMock.mockResolvedValue({ timezone: "Europe/Madrid" });
    getAgendaMock.mockResolvedValue([]);

    renderScreen();

    await screen.findByText("Esta semana no tiene clases.");
    screen.getByText("Programa la primera con «Programar clase».");
  });

  it("con clases, pinta la vista semanal con la clase en la hora de la escuela", async () => {
    getSchoolTimezoneMock.mockResolvedValue({ timezone: "Europe/Madrid" });
    getAgendaMock.mockResolvedValue([session]);

    renderScreen();

    // 09:00 UTC de julio (CEST, +2) son las 11:00 en Madrid.
    await screen.findByRole("button", { name: /B1 tardes.*11:00.*Carla Ruiz/ });
  });

  it("la MISMA clase, vista desde una escuela en Brasil, se muestra a otra hora local", async () => {
    getSchoolTimezoneMock.mockResolvedValue({ timezone: "America/Sao_Paulo" });
    getAgendaMock.mockResolvedValue([session]);

    renderScreen();

    // 09:00 UTC en América/São_Paulo (UTC-3, sin horario de verano) son las 06:00.
    await screen.findByRole("button", { name: /B1 tardes.*06:00.*Carla Ruiz/ });
  });

  it("cambiar de semana vuelve a pedir la agenda", async () => {
    getSchoolTimezoneMock.mockResolvedValue({ timezone: "Europe/Madrid" });
    getAgendaMock.mockResolvedValue([]);
    const user = userEvent.setup();

    renderScreen();
    await screen.findByText("Esta semana no tiene clases.");
    const callsBefore = getAgendaMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Semana siguiente" }));

    await waitFor(() => expect(getAgendaMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
