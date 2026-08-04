import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import { createTestRouter } from "./test-router.testsupport.js";
import { formatElapsed } from "./GenerateUnitScreen.js";
import type { GenerationEstimate } from "./types.js";

const { generateUnitMock, getGenerationEstimateMock } = vi.hoisted(() => ({
  generateUnitMock: vi.fn(),
  getGenerationEstimateMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    generateUnit: generateUnitMock,
    getGenerationEstimate: getGenerationEstimateMock,
  };
});

const { GenerateUnitScreen } = await import("./GenerateUnitScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter("/contenido/nuevo", [
    { path: "/contenido", component: () => <></> },
    { path: "/contenido/nuevo", component: GenerateUnitScreen },
    { path: "/contenido/$contentUnitId", component: () => <></> },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** Saldo holgado: el servidor dice que no hay rechazo. */
const healthy: GenerationEstimate = {
  estimatedCredits: 40,
  currentBalance: 12_000,
  hardLimit: true,
  wouldBeRejected: false,
  // La lista la manda el servidor; el formulario no lleva ninguna copia.
  unavailableExerciseTypes: ["dictation", "shadowing", "listening_comprehension"],
};

async function fillMinimalForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/Código de la unidad/), "ES-B1-U7");
  await user.type(screen.getByLabelText(/Idioma que se enseña/), "es");
  await user.type(screen.getByLabelText(/^Tema/), "En la consulta del médico");
  await user.click(screen.getByLabelText("Gramática"));
  await user.click(screen.getByLabelText("Huecos"));
}

describe("GenerateUnitScreen (Tarea 11 de la ola 2, Pasos 1, 2 y 5)", () => {
  beforeEach(() => {
    localStorage.clear();
    generateUnitMock.mockReset();
    getGenerationEstimateMock.mockReset().mockResolvedValue(healthy);
  });

  it("estado de carga: la tarjeta de créditos se anuncia mientras se resuelve la estimación", async () => {
    getGenerationEstimateMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("Paso 1: enseña saldo y coste estimado ANTES de lanzar nada", async () => {
    renderScreen();

    await screen.findByText("Saldo disponible");
    screen.getByText("12.000");
    screen.getByText("Coste estimado de esta generación");
    screen.getByText("40");
    expect(generateUnitMock).not.toHaveBeenCalled();
  });

  it("Paso 5: con wouldBeRejected del servidor, bloquea el envío y lo explica", async () => {
    getGenerationEstimateMock.mockResolvedValue({ ...healthy, currentBalance: 0, wouldBeRejected: true });

    renderScreen();

    await screen.findByText("Saldo insuficiente");
    screen.getByText(/tope estricto de créditos/);
    expect((screen.getByRole("button", { name: "Generar unidad" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("Paso 5: el panel no recalcula el rechazo — con saldo 0 pero wouldBeRejected falso, deja generar", async () => {
    getGenerationEstimateMock.mockResolvedValue({
      estimatedCredits: 40,
      currentBalance: 0,
      hardLimit: false,
      wouldBeRejected: false,
      unavailableExerciseTypes: [],
    });

    renderScreen();

    await screen.findByText("Saldo disponible");
    expect(screen.queryByText("Saldo insuficiente")).toBeNull();
    expect((screen.getByRole("button", { name: "Generar unidad" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("exige al menos una destreza y un tipo de ejercicio antes de llamar a la API", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("Saldo disponible");
    await user.type(screen.getByLabelText(/Código de la unidad/), "ES-B1-U7");
    await user.type(screen.getByLabelText(/Idioma que se enseña/), "es");
    await user.type(screen.getByLabelText(/^Tema/), "El médico");
    await user.click(screen.getByRole("button", { name: "Generar unidad" }));

    await screen.findByText("Elige al menos una destreza.");
    screen.getByText("Elige al menos un tipo de ejercicio.");
    expect(generateUnitMock).not.toHaveBeenCalled();
  });

  it("los tipos que necesitan audio se ofrecen deshabilitados, con su explicación", async () => {
    renderScreen();

    await screen.findByText("Saldo disponible");
    expect((screen.getByLabelText(/Dictado/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByText(/Necesita un recurso de audio real/).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Huecos") as HTMLInputElement).disabled).toBe(false);
  });

  it("Paso 2: mientras genera, muestra el progreso, el tiempo transcurrido y el aviso de no cerrar", async () => {
    const user = userEvent.setup();
    generateUnitMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await screen.findByText("Saldo disponible");
    await fillMinimalForm(user);
    await user.click(screen.getByRole("button", { name: "Generar unidad" }));

    await screen.findByText("Puede tardar varios minutos: no cierres ni recargues esta pestaña.");
    screen.getByText("Tiempo transcurrido: 00:00");
    screen.getByText(/Si sales ahora/);
  });

  it("manda el formulario tal cual al endpoint de generación", async () => {
    const user = userEvent.setup();
    generateUnitMock.mockResolvedValue({
      contentUnitId: "22222222-2222-2222-2222-222222222222",
      status: "in_review",
    });

    renderScreen();

    await screen.findByText("Saldo disponible");
    await fillMinimalForm(user);
    await user.click(screen.getByRole("button", { name: "Generar unidad" }));

    await waitFor(() =>
      expect(generateUnitMock).toHaveBeenCalledWith({
        code: "ES-B1-U7",
        language: "es",
        level: "B1",
        topic: "En la consulta del médico",
        skills: ["grammar"],
        primaryLocale: "es-ES",
        exerciseTypes: ["cloze"],
        sourceMaterial: undefined,
      }),
    );
  });

  it("un error de la API se muestra traducido, nunca el code crudo", async () => {
    const user = userEvent.setup();
    generateUnitMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_credits",
        title: "Créditos insuficientes",
        status: 402,
        params: { required: 40, available: 0 },
      }),
    );

    renderScreen();

    await screen.findByText("Saldo disponible");
    await fillMinimalForm(user);
    await user.click(screen.getByRole("button", { name: "Generar unidad" }));

    await waitFor(() => expect(generateUnitMock).toHaveBeenCalled());
    await screen.findByRole("alert");
    expect(screen.queryByText("insufficient_credits")).toBeNull();
  });

  it("Paso 2: al volver tras cerrar la pestaña a mitad, avisa de la generación que no llegó a verse", async () => {
    localStorage.setItem(
      "langopia:content:pending-generation",
      JSON.stringify({ code: "ES-B1-U7", startedAt: new Date(Date.now() - 120_000).toISOString() }),
    );

    renderScreen();

    await screen.findByText("Había una generación en curso");
    screen.getByText(/ES-B1-U7/);
    screen.getByRole("link", { name: "Ver listado de unidades" });
  });

  it("descartar el aviso lo quita y lo olvida", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "langopia:content:pending-generation",
      JSON.stringify({ code: "ES-B1-U7", startedAt: new Date().toISOString() }),
    );

    renderScreen();

    await screen.findByText("Había una generación en curso");
    await user.click(screen.getByRole("button", { name: "Descartar aviso" }));

    expect(screen.queryByText("Había una generación en curso")).toBeNull();
    expect(localStorage.getItem("langopia:content:pending-generation")).toBeNull();
  });
});

describe("formatElapsed", () => {
  it("cuenta en mm:ss, que es lo que interpola progressElapsed", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(3_601)).toBe("60:01");
  });
});

describe("qué tipos se pueden pedir lo decide la API", () => {
  it("deshabilita exactamente los tipos que el servidor marca como no disponibles", async () => {
    getGenerationEstimateMock.mockResolvedValue(healthy);
    renderScreen();

    // La estimación es la que trae la lista: hasta que llega no hay nada que
    // deshabilitar, así que se espera a ella y no a la casilla.
    await screen.findByText("Saldo disponible");
    const dictado = screen.getByLabelText(/Dictado/) as HTMLInputElement;
    const huecos = screen.getByLabelText(/^Huecos$/) as HTMLInputElement;
    expect(dictado.disabled).toBe(true);
    expect(huecos.disabled).toBe(false);
  });

  it("si el servidor deja de marcar ninguno, el formulario los ofrece todos sin tocar el cliente", async () => {
    getGenerationEstimateMock.mockResolvedValue({ ...healthy, unavailableExerciseTypes: [] });
    renderScreen();

    await screen.findByText("Saldo disponible");
    const dictado = screen.getByLabelText(/Dictado/) as HTMLInputElement;
    expect(dictado.disabled).toBe(false);
  });
});
