import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import { ToastProvider } from "../../ui/index.js";

const { getSchoolSettingsMock, updateSchoolSettingsMock, inviteTeacherMock } = vi.hoisted(() => ({
  getSchoolSettingsMock: vi.fn(),
  updateSchoolSettingsMock: vi.fn(),
  inviteTeacherMock: vi.fn(),
}));

vi.mock("./api.js", () => ({
  getSchoolSettings: getSchoolSettingsMock,
  updateSchoolSettings: updateSchoolSettingsMock,
  inviteTeacher: inviteTeacherMock,
}));

const { WelcomeScreen } = await import("./WelcomeScreen.js");

const TRIAL_SETTINGS = {
  name: "Academia Nueva",
  defaultLocale: "es-ES",
  supportedLocales: ["es-ES"],
  status: "trial" as const,
  trialEndsAt: "2026-08-10T00:00:00.000Z",
};

/** `WelcomeScreen` navega con `useNavigate()` ("Ir al panel"): hace falta un enrutador de verdad. */
function renderWelcomeScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const welcomeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bienvenida", component: WelcomeScreen });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <p>panel</p> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([welcomeRoute, homeRoute]),
    history: createMemoryHistory({ initialEntries: ["/bienvenida"] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label="Avisos" closeLabel="Cerrar aviso">
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("WelcomeScreen (Tarea 12, Pasos 2 y 3)", () => {
  beforeEach(() => {
    getSchoolSettingsMock.mockReset();
    updateSchoolSettingsMock.mockReset();
    inviteTeacherMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("en periodo de prueba, muestra el aviso discreto de días restantes", async () => {
    getSchoolSettingsMock.mockResolvedValue(TRIAL_SETTINGS);
    renderWelcomeScreen();

    await screen.findByText(/prueba gratuita/i);
  });

  it("fuera de prueba (escuela activa), no muestra ningún aviso de días", async () => {
    getSchoolSettingsMock.mockResolvedValue({ ...TRIAL_SETTINGS, status: "active", trialEndsAt: null });
    renderWelcomeScreen();

    await screen.findByText(TRIAL_SETTINGS.name, { exact: false }).catch(() => undefined);
    await screen.findByRole("heading", { name: /marca/i });
    expect(screen.queryByText(/prueba gratuita/i)).toBeNull();
  });

  it("un error al cargar los ajustes se traduce y ofrece reintentar", async () => {
    getSchoolSettingsMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "No tienes permiso.",
        status: 403,
        params: { required: "owner" },
      }),
    );
    renderWelcomeScreen();

    await screen.findByText("Esta acción requiere el rol owner.");
    screen.getByRole("button", { name: "Reintentar" });
  });

  it("paso de marca: guardar llama a updateSchoolSettings con el nombre nuevo", async () => {
    getSchoolSettingsMock.mockResolvedValue(TRIAL_SETTINGS);
    updateSchoolSettingsMock.mockResolvedValue({ ...TRIAL_SETTINGS, name: "Nuevo Nombre" });
    const user = userEvent.setup();
    renderWelcomeScreen();

    const nameInput = await screen.findByLabelText(/nombre de la escuela/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Nuevo Nombre");
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[0]!);

    await waitFor(() => expect(updateSchoolSettingsMock).toHaveBeenCalledWith({ name: "Nuevo Nombre" }));
  });

  it("paso de primer profesor: invitar llama a inviteTeacher y muestra confirmación honesta", async () => {
    getSchoolSettingsMock.mockResolvedValue(TRIAL_SETTINGS);
    inviteTeacherMock.mockResolvedValue({ invitationId: "i1", token: "tok", expiresAt: "2026-08-01T00:00:00.000Z" });
    const user = userEvent.setup();
    renderWelcomeScreen();

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, "profe@example.com");
    await user.click(screen.getByRole("button", { name: "Invitar" }));

    await waitFor(() => expect(inviteTeacherMock).toHaveBeenCalledWith("profe@example.com"));
    await screen.findByText(/profe@example\.com/);
    // Honesto: no finge que se envió un correo.
    screen.getByText(/todavía no envía la invitación por correo/i);
  });

  it("saltar el paso de primer curso lo marca como saltado sin abrir el diálogo", async () => {
    getSchoolSettingsMock.mockResolvedValue(TRIAL_SETTINGS);
    const user = userEvent.setup();
    renderWelcomeScreen();

    // "Crear curso" ya está visible: confirma que el paso empieza pendiente.
    await screen.findByRole("button", { name: "Crear curso" });
    // Los cuatro pasos comparten el mismo texto "Saltar"; el del curso es el
    // último en el orden en que se pintan (marca, idioma, profesor, curso).
    const skipButtons = screen.getAllByRole("button", { name: "Saltar" });
    await user.click(skipButtons[skipButtons.length - 1]!);

    // El botón "Crear curso" desaparece: el paso quedó saltado.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Crear curso" })).toBeNull());
  });

  it("'Ir al panel' navega a / en cualquier momento, sin exigir completar nada", async () => {
    getSchoolSettingsMock.mockResolvedValue(TRIAL_SETTINGS);
    const user = userEvent.setup();
    renderWelcomeScreen();

    await user.click(await screen.findByRole("button", { name: "Ir al panel" }));

    await screen.findByText("panel");
  });
});
