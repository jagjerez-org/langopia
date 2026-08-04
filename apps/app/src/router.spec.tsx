import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, setSchoolSlug } from "./lib/api-client.js";

/**
 * Integración de extremo a extremo del enrutador (Tarea 3, Paso 1 del
 * brief, verbatim): sin sesión redirige a `/entrar`; con sesión y una
 * escuela entra directo; con varias muestra el selector; un
 * `missing_tenant` de la API (aquí, al resolver tenant) vuelve al selector.
 * Solo se sustituyen las dos llamadas de red reales (`getSession` y la
 * sonda de tenant que reutiliza `getActiveImpersonation`): el resto —el
 * `routeTree`, `ProtectedLayout`, `useSession()`— es el de verdad.
 */
const { getSessionMock, getActiveImpersonationMock, getDashboardSummaryMock, getTeacherOccupancyMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    getActiveImpersonationMock: vi.fn(),
    getDashboardSummaryMock: vi.fn(),
    getTeacherOccupancyMock: vi.fn(),
  }));

vi.mock("./features/auth/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./features/auth/api.js")>();
  return { ...actual, getSession: getSessionMock };
});
vi.mock("./features/impersonation/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./features/impersonation/api.js")>();
  return { ...actual, getActiveImpersonation: getActiveImpersonationMock };
});
// La ruta protegida `/` ya es el panel de dirección de verdad (Tarea 6): se
// sustituyen sus dos llamadas de red para que este archivo siga probando
// solo el enrutador (sesión, tenant, selector de escuela), no el contenido
// del panel — eso ya lo cubre `features/dashboard/*.spec.tsx`.
vi.mock("./features/dashboard/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./features/dashboard/api.js")>();
  return {
    ...actual,
    getDashboardSummary: getDashboardSummaryMock,
    getTeacherOccupancy: getTeacherOccupancyMock,
  };
});

const { rootRoute, loginRoute, protectedRoute, homeRoute } = await import("./router.js");

const verifiedUser = {
  id: "user-1",
  email: "carla.ruiz@atlantico.example",
  name: "Carla Ruiz",
  emailVerified: true,
};

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const routeTree = rootRoute.addChildren([loginRoute, protectedRoute.addChildren([homeRoute])]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("router (Tarea 3, Paso 1)", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getActiveImpersonationMock.mockReset();
    getDashboardSummaryMock.mockReset().mockResolvedValue({
      activeStudents: 0,
      averageAttendanceRate: 0,
      nps: null,
      invoicedThisMonth: { amountCents: 0, currency: "EUR" },
      studentsRequiringAttention: [],
    });
    getTeacherOccupancyMock.mockReset().mockResolvedValue([]);
    setSchoolSlug(undefined);
  });

  afterEach(() => {
    setSchoolSlug(undefined);
  });

  it("sin sesión, una ruta protegida redirige a /entrar", async () => {
    getSessionMock.mockResolvedValue(null);

    const router = renderAt("/");

    await waitFor(() => expect(router.state.location.pathname).toBe("/entrar"));
    await screen.findByRole("heading", { name: "Inicia sesión" });
  });

  it("con sesión y una sola escuela, entra directo a la ruta protegida", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: verifiedUser,
    });
    getActiveImpersonationMock.mockResolvedValue(null);

    const router = renderAt("/");

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    // El panel de dirección de verdad (Tarea 6), no ya el marcador de la
    // Tarea 3: prueba que se pintó contenido real, no solo que la URL cambió.
    await screen.findByRole("heading", { name: "Panel de dirección" });
  });

  it("con sesión y varias escuelas, muestra el selector en vez del contenido", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: { ...verifiedUser, email: "dan.whitfield@langopia-teachers.example" },
    });
    getActiveImpersonationMock.mockRejectedValue(
      new ApiError({
        code: "tenant_resolution_failed",
        title: "No se ha podido determinar la escuela para esta petición.",
        status: 403,
        params: { schools: ["atlantico", "paulista"] },
      }),
    );

    const router = renderAt("/");

    await screen.findByRole("heading", { name: "Elige tu escuela" });
    screen.getByRole("button", { name: /atlantico/ });
    screen.getByRole("button", { name: /paulista/ });
    // No navega a /entrar: sigue en la ruta protegida, mostrando el selector.
    expect(router.state.location.pathname).toBe("/");
  });

  it("un missing_tenant de la API al resolver tenant vuelve al selector", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: verifiedUser,
    });
    getActiveImpersonationMock.mockRejectedValue(
      new ApiError({ code: "missing_tenant", title: "Necesitas iniciar sesión.", status: 403 }),
    );

    const router = renderAt("/");

    // Sin escuelas que ofrecer: el selector cae a su estado vacío, no a un
    // selector con opciones inventadas ni a un redirigido a `/entrar` — la
    // sesión existe, solo falta el tenant.
    await screen.findByRole("status");
    expect(router.state.location.pathname).toBe("/");
  });

  it("ya con sesión resuelta, visitar /entrar redirige de vuelta a /", async () => {
    getSessionMock.mockResolvedValue({
      session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" },
      user: verifiedUser,
    });
    getActiveImpersonationMock.mockResolvedValue(null);

    const router = renderAt("/entrar");

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
