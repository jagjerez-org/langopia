import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";

const { getSessionMock, getActiveImpersonationMock, signUpMock, registerSchoolMock, checkSlugAvailabilityMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    getActiveImpersonationMock: vi.fn(),
    signUpMock: vi.fn(),
    registerSchoolMock: vi.fn(),
    checkSlugAvailabilityMock: vi.fn(),
  }),
);

vi.mock("../auth/api.js", () => ({
  getSession: getSessionMock,
  signInWithGoogle: vi.fn(),
}));
vi.mock("../impersonation/api.js", () => ({ getActiveImpersonation: getActiveImpersonationMock }));
vi.mock("./api.js", () => ({
  signUp: signUpMock,
  registerSchool: registerSchoolMock,
  checkSlugAvailability: checkSlugAvailabilityMock,
}));

const { RegisterScreen } = await import("./RegisterScreen.js");

const VERIFIED_USER = { id: "u1", email: "duena@example.com", name: "Dueña", emailVerified: true };

/**
 * `RegisterScreen` navega con `useNavigate()` (a `/` cuando ya hay escuela
 * resuelta), igual que `LoginScreen`: hace falta un enrutador de verdad.
 */
function renderRegisterScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/registro", component: RegisterScreen });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <p>inicio</p> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([registerRoute, homeRoute]),
    history: createMemoryHistory({ initialEntries: ["/registro"] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("RegisterScreen (Tarea 12, Paso 1)", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getActiveImpersonationMock.mockReset();
    signUpMock.mockReset();
    registerSchoolMock.mockReset();
    checkSlugAvailabilityMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("anónimo: pinta el formulario de creación de cuenta", async () => {
    getSessionMock.mockResolvedValue(null);
    renderRegisterScreen();

    await screen.findByLabelText(/tu nombre/i);
    screen.getByLabelText(/correo electrónico/i);
    screen.getByLabelText(/contraseña/i);
    screen.getByRole("button", { name: "Crear cuenta" });
  });

  it("crear la cuenta pasa a la pantalla de verificación con el correo escrito", async () => {
    getSessionMock.mockResolvedValue(null);
    signUpMock.mockResolvedValue({ user: { email: "nueva@example.com" } });
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(await screen.findByLabelText(/tu nombre/i), "Dueña Nueva");
    await user.type(screen.getByLabelText(/correo electrónico/i), "nueva@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "contraseña-larga");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await screen.findByText(/nueva@example\.com/);
    expect(signUpMock).toHaveBeenCalledWith({
      name: "Dueña Nueva",
      email: "nueva@example.com",
      password: "contraseña-larga",
    });
  });

  it("verificado sin ninguna escuela: pinta el formulario de alta con el aviso de disponibilidad", async () => {
    getSessionMock.mockResolvedValue({ session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" }, user: VERIFIED_USER });
    getActiveImpersonationMock.mockRejectedValue(
      new ApiError({ code: "tenant_resolution_failed", title: "Sin escuela.", status: 403, params: { schools: [] } }),
    );
    checkSlugAvailabilityMock.mockResolvedValue({ available: true });
    renderRegisterScreen();

    await screen.findByLabelText(/nombre de la escuela/i);
    screen.getByLabelText(/identificador/i);
  });

  it("con sesión ya resuelta en una escuela, se aparta a / sin mostrar nada del registro", async () => {
    getSessionMock.mockResolvedValue({ session: { id: "s1", expiresAt: "2026-08-01T00:00:00.000Z" }, user: VERIFIED_USER });
    getActiveImpersonationMock.mockResolvedValue(null);
    renderRegisterScreen();

    await screen.findByText("inicio");
  });

  it("pulsar 'ya he verificado' sin haberlo hecho de verdad avisa y no bloquea", async () => {
    getSessionMock.mockResolvedValue(null);
    signUpMock.mockResolvedValue({ user: { email: "pendiente@example.com" } });
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(await screen.findByLabelText(/tu nombre/i), "Dueña");
    await user.type(screen.getByLabelText(/correo electrónico/i), "pendiente@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "contraseña-larga");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await screen.findByText(/pendiente@example\.com/);

    // Sigue sin sesión: verificar todavía no ha ocurrido de verdad.
    getSessionMock.mockResolvedValue(null);
    await user.click(screen.getByRole("button", { name: "Ya he verificado mi correo" }));

    await waitFor(() => screen.getByText(/todavía no detectamos la verificación/i));
  });
});
