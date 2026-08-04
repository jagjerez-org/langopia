import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";

const { getSessionMock, signInWithEmailMock, signInWithGoogleMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  signInWithEmailMock: vi.fn(),
  signInWithGoogleMock: vi.fn(),
}));

vi.mock("./api.js", () => ({
  getSession: getSessionMock,
  signInWithEmail: signInWithEmailMock,
  signInWithGoogle: signInWithGoogleMock,
}));
vi.mock("../impersonation/api.js", () => ({ getActiveImpersonation: vi.fn() }));

const { LoginScreen } = await import("./LoginScreen.js");

/**
 * `LoginScreen` navega con `useNavigate()` (Paso 4: se aparta a `/` si la
 * sesión ya está resuelta), así que necesita un enrutador de verdad debajo,
 * no solo un `QueryClientProvider`. Una ruta índice mínima basta para
 * comprobar que la navegación ocurre, sin montar el `router.tsx` real.
 */
function renderLoginScreen(): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/entrar", component: LoginScreen });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>inicio</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([loginRoute, homeRoute]),
    history: createMemoryHistory({ initialEntries: ["/entrar"] }),
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe("LoginScreen (Tarea 3, Paso 4)", () => {
  beforeEach(() => {
    getSessionMock.mockReset().mockResolvedValue(null);
    signInWithEmailMock.mockReset();
    signInWithGoogleMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pinta correo, contraseña, el botón de entrar y el de Google", async () => {
    render(renderLoginScreen());

    await screen.findByLabelText(/correo electrónico/i);
    screen.getByLabelText(/contraseña/i);
    screen.getByRole("button", { name: "Entrar" });
    screen.getByRole("button", { name: /Google/ });
  });

  it("sin rellenar nada, no llama a signInWithEmail y muestra los avisos de campo", async () => {
    const user = userEvent.setup();
    render(renderLoginScreen());
    await screen.findByLabelText(/correo electrónico/i);

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => screen.getByText("Escribe tu correo electrónico."));
    screen.getByText("Escribe tu contraseña.");
    expect(signInWithEmailMock).not.toHaveBeenCalled();
  });

  it("con credenciales, llama a signInWithEmail con lo escrito", async () => {
    signInWithEmailMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(renderLoginScreen());
    await screen.findByLabelText(/correo electrónico/i);

    await user.type(screen.getByLabelText(/correo electrónico/i), "carla.ruiz@atlantico.example");
    await user.type(screen.getByLabelText(/contraseña/i), "Langopia-demo-2026");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(signInWithEmailMock).toHaveBeenCalledWith(
        "carla.ruiz@atlantico.example",
        "Langopia-demo-2026",
      ),
    );
  });

  it("unas credenciales incorrectas muestran un mensaje traducido, nunca el code crudo", async () => {
    signInWithEmailMock.mockRejectedValue(
      new ApiError({
        code: "INVALID_EMAIL_OR_PASSWORD",
        title: "Invalid email or password",
        status: 401,
      }),
    );
    const user = userEvent.setup();
    render(renderLoginScreen());
    await screen.findByLabelText(/correo electrónico/i);

    await user.type(screen.getByLabelText(/correo electrónico/i), "carla.ruiz@atlantico.example");
    await user.type(screen.getByLabelText(/contraseña/i), "mal");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => screen.getByText("El correo o la contraseña no son correctos."));
    expect(screen.queryByText("INVALID_EMAIL_OR_PASSWORD")).toBeNull();
  });

  it("el botón de Google llama a signInWithGoogle", async () => {
    const user = userEvent.setup();
    render(renderLoginScreen());
    await screen.findByLabelText(/correo electrónico/i);

    await user.click(screen.getByRole("button", { name: /Google/ }));

    expect(signInWithGoogleMock).toHaveBeenCalledTimes(1);
  });
});
