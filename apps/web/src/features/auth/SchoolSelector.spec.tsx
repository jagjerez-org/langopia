import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSchoolSlug, setSchoolSlug } from "../../lib/api-client.js";

const { useChooseSchoolMock } = vi.hoisted(() => ({ useChooseSchoolMock: vi.fn() }));

vi.mock("./session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./session.js")>();
  return { ...actual, useChooseSchool: useChooseSchoolMock };
});

const { SchoolSelector } = await import("./SchoolSelector.js");

/**
 * `SchoolSelector` navega con `useNavigate()` cuando no hay ninguna escuela
 * usable (Tarea 12: enlaza a `/registro`), así que necesita un enrutador de
 * verdad debajo — mismo patrón que `LoginScreen.spec.tsx`.
 */
function renderSelector(schools: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <SchoolSelector schools={schools} />,
  });
  const registerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/registro",
    component: () => <p>registro</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, registerRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  };
}

describe("SchoolSelector (Tarea 3, Paso 5)", () => {
  beforeEach(() => {
    useChooseSchoolMock.mockReset();
    setSchoolSlug(undefined);
  });

  afterEach(() => {
    setSchoolSlug(undefined);
  });

  it("con varias escuelas, ofrece un botón por cada slug que da la API", async () => {
    renderSelector(["atlantico", "paulista"]);

    // El enrutador resuelve la ruta inicial de forma asíncrona (mismo
    // patrón que `LoginScreen.spec.tsx`): la primera consulta espera.
    await screen.findByRole("button", { name: /atlantico/ });
    screen.getByRole("button", { name: /paulista/ });
  });

  it("sin escuelas usables, muestra un estado vacío con una salida hacia el registro (Tarea 12)", async () => {
    renderSelector([]);

    expect((await screen.findByRole("status")).textContent).toMatch(/ninguna escuela/i);
    // El único botón que queda es la salida hacia `/registro` — no hay
    // ningún slug entre el que elegir.
    screen.getByRole("button", { name: /registra tu escuela/i });
  });

  it("desde el estado vacío, el botón navega a /registro (Tarea 12): sin esto era un callejón sin salida", async () => {
    const user = userEvent.setup();
    renderSelector([]);

    await user.click(await screen.findByRole("button", { name: /registra tu escuela/i }));

    await waitFor(() => screen.getByText("registro"));
  });

  it("elegir una escuela fija la cabecera x-school-slug para las peticiones siguientes", async () => {
    useChooseSchoolMock.mockReturnValue(async (slug: string) => {
      setSchoolSlug(slug);
    });
    const user = userEvent.setup();
    renderSelector(["atlantico", "paulista"]);

    await user.click(await screen.findByRole("button", { name: /atlantico/ }));

    await waitFor(() => expect(getSchoolSlug()).toBe("atlantico"));
  });

  it("un fallo al confirmar (p. ej. missing_tenant) vuelve al selector: la lista sigue interactiva", async () => {
    useChooseSchoolMock.mockReturnValue(async () => {
      throw new Error("missing_tenant");
    });
    const user = userEvent.setup();
    renderSelector(["atlantico", "paulista"]);

    const button = (await screen.findByRole("button", { name: /atlantico/ })) as HTMLButtonElement;
    await user.click(button);

    // No queda atascado en "cargando": el selector vuelve a estar disponible
    // para intentarlo de nuevo (o para que el redirigido global de
    // `api-client.ts` se lleve a `/entrar` si la sesión de verdad se fue).
    await waitFor(() => expect(button.disabled).toBe(false));
    expect((screen.getByRole("button", { name: /paulista/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
