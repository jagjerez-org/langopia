import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import type { ImpersonationAuditEntry } from "./types.js";

const { listImpersonationHistoryMock, getSchoolTimezoneMock } = vi.hoisted(() => ({
  listImpersonationHistoryMock: vi.fn(),
  getSchoolTimezoneMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    listImpersonationHistory: listImpersonationHistoryMock,
    getSchoolTimezone: getSchoolTimezoneMock,
  };
});

const { ImpersonationHistoryScreen } = await import("./ImpersonationHistoryScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImpersonationHistoryScreen />
    </QueryClientProvider>,
  );
}

const entries: ImpersonationAuditEntry[] = [
  {
    impersonationId: "imp-1",
    targetMembershipId: "m-1",
    targetName: "Ana Alumna",
    targetRole: "student",
    impersonatorName: "Sara Soporte",
    impersonatorEmail: "sara@langopia.app",
    reason: "ticket 4711: no le carga el calendario",
    involvesMinor: true,
    startedAt: "2026-07-27T10:00:00.000Z",
    endedAt: null,
    expiresAt: "2026-07-27T10:30:00.000Z",
    durationSeconds: null,
  },
  {
    impersonationId: "imp-2",
    targetMembershipId: "m-2",
    targetName: "Pablo Profesor",
    targetRole: "teacher",
    impersonatorName: "Dario Dirección",
    impersonatorEmail: "dario@atlantico.test",
    reason: "Comprobar por qué no ve el grupo de los jueves",
    involvesMinor: false,
    startedAt: "2026-07-26T09:00:00.000Z",
    endedAt: "2026-07-26T09:12:30.000Z",
    expiresAt: "2026-07-26T09:30:00.000Z",
    durationSeconds: 750,
  },
];

describe("ImpersonationHistoryScreen (Tarea 17, paso 12)", () => {
  beforeEach(() => {
    listImpersonationHistoryMock.mockReset().mockResolvedValue(entries);
    getSchoolTimezoneMock.mockReset().mockResolvedValue({ timezone: "Europe/Madrid" });
  });

  it("muestra quién actuó como quién, cuándo, por qué y si había un menor", async () => {
    renderScreen();

    await screen.findByRole("heading", { name: "Auditoría de impersonaciones" });

    // Quién parecía y quién era: las dos caras de cada fila.
    await screen.findByText(/Sara Soporte/);
    screen.getByText(/sara@langopia\.app/);
    screen.getByText(/Ana Alumna/);
    screen.getByText(/student/);
    screen.getByText("ticket 4711: no le carga el calendario");

    // Acceso a datos de un menor, marcado aparte (regla del brief).
    screen.getByText("Sí");

    // La fila aún abierta se reconoce como tal; la cerrada enseña su duración.
    screen.getByText("En curso");
    screen.getByText("12 min 30 s");
  });

  it("explica el vacío cuando nadie ha impersonado todavía en la escuela", async () => {
    listImpersonationHistoryMock.mockResolvedValue([]);
    renderScreen();

    await screen.findByText("Nadie ha impersonado a nadie en esta escuela todavía.");
  });

  it("ofrece reintentar cuando la API falla", async () => {
    listImpersonationHistoryMock.mockRejectedValue(
      new ApiError({ code: "network_error", title: "No se pudo contactar con el servidor.", status: 0 }),
    );
    renderScreen();

    await screen.findByRole("alert");
    screen.getByRole("button", { name: "Reintentar" });
  });
});
