import { createElement } from "react";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";

const { enrolStudentMock } = vi.hoisted(() => ({ enrolStudentMock: vi.fn() }));

vi.mock("./api.js", () => ({ enrolStudent: enrolStudentMock }));

const { StudentCreateScreen } = await import("./StudentCreateScreen.js");

/**
 * Paso 1 del brief de la Tarea 7: al poner una fecha de nacimiento de menor
 * aparecen los campos de tutor; sin tutor no deja enviar; el error
 * `guardian_required` de la API se muestra junto al campo correcto.
 */
function renderCreateScreen(): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const createRouteDef = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alumnos/nuevo",
    component: StudentCreateScreen,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alumnos/$studentId",
    component: () => createElement("p", null, "ficha"),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([createRouteDef, detailRoute]),
    history: createMemoryHistory({ initialEntries: ["/alumnos/nuevo"] }),
  });
  return createElement(I18nProvider, {
    locale: "es-ES",
    children: createElement(QueryClientProvider, {
      client: queryClient,
      children: createElement(RouterProvider, { router }),
    }),
  });
}

async function fillRequiredAdultFields(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(await screen.findByLabelText(/nombre completo/i), "Ana Adulta");
  await user.type(screen.getByLabelText(/correo electrónico/i), "ana@example.com");
  await user.type(screen.getByLabelText(/idioma nativo/i), "es");
  await user.type(screen.getByLabelText(/idioma que aprende/i), "en");
}

describe("StudentCreateScreen (Tarea 7, Paso 1)", () => {
  beforeEach(() => {
    enrolStudentMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("con una fecha de nacimiento de adulto, no muestra los campos de tutor", async () => {
    const user = userEvent.setup();
    render(renderCreateScreen());

    const dob = await screen.findByLabelText(/fecha de nacimiento/i);
    await user.type(dob, "1990-01-01");

    expect(screen.queryByLabelText(/nombre del tutor/i)).toBeNull();
  });

  it("con una fecha de nacimiento de menor, aparecen los campos de tutor legal", async () => {
    const user = userEvent.setup();
    render(renderCreateScreen());

    const dob = await screen.findByLabelText(/fecha de nacimiento/i);
    await user.type(dob, "2015-01-01");

    await screen.findByLabelText(/nombre del tutor/i);
    screen.getByLabelText(/correo del tutor/i);
    screen.getByLabelText(/parentesco/i);
  });

  it("con un menor y sin tutor, no deja enviar: no llama a enrolStudent y muestra los avisos", async () => {
    const user = userEvent.setup();
    render(renderCreateScreen());

    await fillRequiredAdultFields(user);
    const dob = screen.getByLabelText(/fecha de nacimiento/i);
    await user.type(dob, "2015-01-01");
    await screen.findByLabelText(/nombre del tutor/i);

    await user.click(screen.getByRole("button", { name: "Dar de alta" }));

    await waitFor(() => screen.getByText("Escribe el nombre del tutor legal."));
    expect(enrolStudentMock).not.toHaveBeenCalled();
  });

  it("con un menor y tutor completo, llama a enrolStudent con los datos del tutor", async () => {
    enrolStudentMock.mockResolvedValue({ studentId: "s1", guardianRequired: true, currentLevel: null });
    const user = userEvent.setup();
    render(renderCreateScreen());

    await fillRequiredAdultFields(user);
    await user.type(screen.getByLabelText(/fecha de nacimiento/i), "2015-01-01");
    await user.type(await screen.findByLabelText(/nombre del tutor/i), "Tutora Legal");
    await user.type(screen.getByLabelText(/correo del tutor/i), "tutora@example.com");
    await user.selectOptions(screen.getByLabelText(/parentesco/i), "mother");

    await user.click(screen.getByRole("button", { name: "Dar de alta" }));

    await waitFor(() =>
      expect(enrolStudentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ana Adulta",
          email: "ana@example.com",
          dateOfBirth: "2015-01-01",
          guardian: { name: "Tutora Legal", email: "tutora@example.com", relationship: "mother" },
        }),
      ),
    );
  });

  it("el error guardian_required de la API fuerza a mostrar la sección de tutor y su mensaje junto a ella", async () => {
    enrolStudentMock.mockRejectedValue(
      new ApiError({
        code: "guardian_required",
        title: "Un alumno menor de edad necesita al menos un tutor legal para darse de alta.",
        status: 409,
      }),
    );
    const user = userEvent.setup();
    render(renderCreateScreen());

    // Fecha de adulto: el cliente no cree que haga falta tutor, pero el
    // servidor manda — la sección debe aparecer igualmente tras el rechazo.
    await fillRequiredAdultFields(user);
    await user.type(screen.getByLabelText(/fecha de nacimiento/i), "1990-01-01");
    expect(screen.queryByLabelText(/nombre del tutor/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Dar de alta" }));

    await screen.findByLabelText(/nombre del tutor/i);
    await waitFor(() =>
      screen.getByText("Un alumno menor de edad necesita al menos un tutor legal para darse de alta."),
    );
  });
});
