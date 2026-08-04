import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import { createTestRouter } from "./test-router.testsupport.js";
import type { ExerciseToDo } from "./types.js";

const { listExercisesToDoMock, submitAttemptMock, getMyStudentsMock } = vi.hoisted(() => ({
  listExercisesToDoMock: vi.fn(),
  submitAttemptMock: vi.fn(),
  getMyStudentsMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, listExercisesToDo: listExercisesToDoMock, submitAttempt: submitAttemptMock };
});

vi.mock("../portal/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../portal/api.js")>();
  return { ...actual, getMyStudents: getMyStudentsMock };
});

const { ExercisesToDoScreen } = await import("./ExercisesToDoScreen.js");

const STUDENT_ID = "b488a129-6c52-4c61-aafa-01f8d7bfeac9";

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter("/mi/ejercicios", [
    { path: "/mi/ejercicios", component: ExercisesToDoScreen },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** Copiado de lo que sirve la API contra el seed para Lucía Ferrán. */
const clozeExercise: ExerciseToDo = {
  exerciseId: "eaf81977-c3f3-462e-82eb-015c4c761ccb",
  contentUnitId: "33333333-3333-3333-3333-333333333333",
  unitCode: "ES-B1-U7",
  type: "cloze",
  skill: "grammar",
  prompt: {
    text: "Me duele la garganta {{1}} hace tres días y no puedo {{2}} bien.",
    blanks: [{ id: 1, hint: "preposición temporal" }, { id: 2, hint: "verbo, infinitivo" }],
    openEnded: true,
  },
  maxScore: 2,
  requiresTeacherValidation: false,
  srsEnabled: true,
  latestAttempt: null,
};

const writingExercise: ExerciseToDo = {
  exerciseId: "0bec42d6-3bc4-4254-ba4b-c3b8147a910f",
  contentUnitId: "33333333-3333-3333-3333-333333333333",
  unitCode: "ES-B1-U7",
  type: "written_production",
  skill: "writing",
  prompt: {
    task: "Escribe un correo a tu médico de cabecera pidiendo cita.",
    minWords: 80,
    maxWords: 100,
    register: "formal",
  },
  maxScore: 20,
  requiresTeacherValidation: true,
  srsEnabled: false,
  latestAttempt: null,
};

describe("ExercisesToDoScreen (Tarea 12 de la ola 2, Pasos 1 y 3)", () => {
  beforeEach(() => {
    listExercisesToDoMock.mockReset();
    submitAttemptMock.mockReset();
    getMyStudentsMock.mockReset().mockResolvedValue([{ studentId: STUDENT_ID, name: "Lucía Ferrán" }]);
  });

  it("estado de carga: se anuncia mientras se resuelven los ejercicios", async () => {
    listExercisesToDoMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("estado vacío: sin ejercicios publicados, lo dice y no pinta ninguna tarjeta", async () => {
    listExercisesToDoMock.mockResolvedValue([]);

    renderScreen();

    await screen.findByText("No tienes ejercicios pendientes");
    screen.getByText("Cuando tu profesorado publique una unidad a tu grupo, aparecerá aquí.");
  });

  it("un error de la API se muestra traducido, con botón de reintentar, nunca el code crudo", async () => {
    listExercisesToDoMock.mockRejectedValue(
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

  it("pide los ejercicios del alumno que resuelve el portal, no de uno inventado", async () => {
    listExercisesToDoMock.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => expect(listExercisesToDoMock).toHaveBeenCalledWith(STUDENT_ID));
  });

  it("tipo automático: envía la respuesta con la forma que espera la API y enseña la corrección al momento", async () => {
    const user = userEvent.setup();
    listExercisesToDoMock.mockResolvedValue([clozeExercise]);
    submitAttemptMock.mockResolvedValue({
      attemptId: "af445000-4e3b-4f5e-be87-fe4c205ff7aa",
      status: "ai_graded",
      aiScore: 2,
      aiFeedback: "Ambos huecos correctos.",
      maxScore: 2,
      requiresTeacherValidation: false,
    });

    renderScreen();

    await screen.findByRole("heading", { name: "Huecos" });
    await user.type(screen.getByLabelText("Hueco (1)"), "desde");
    await user.type(screen.getByLabelText("Hueco (2)"), "tragar");
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    await waitFor(() =>
      expect(submitAttemptMock).toHaveBeenCalledWith({
        exerciseId: clozeExercise.exerciseId,
        studentProfileId: STUDENT_ID,
        response: { "1": "desde", "2": "tragar" },
      }),
    );

    await screen.findByText("Corregido: 2 de 2");
    screen.getByText("Ambos huecos correctos.");
    expect(screen.queryByText("Pendiente de revisión del profesor.")).toBeNull();
  });

  it("tipo de rúbrica: la nota de la IA se enseña como propuesta y queda pendiente de firma", async () => {
    const user = userEvent.setup();
    listExercisesToDoMock.mockResolvedValue([writingExercise]);
    submitAttemptMock.mockResolvedValue({
      attemptId: "e85c4862-09e6-4c74-aabc-443c701f9924",
      status: "ai_graded",
      aiScore: 16,
      aiFeedback: "Registro adecuado.",
      maxScore: 20,
      requiresTeacherValidation: true,
    });

    renderScreen();

    // El tipo («Expresión escrita») y la destreza («Expresión escrita») se
    // llaman igual en castellano: se busca por el encabezado de la tarjeta.
    await screen.findByRole("heading", { name: "Expresión escrita" });
    // La API dice que lo corrige el profesor; la tarjeta lo avisa antes de enviar.
    screen.getByText("Lo corrige el profesor");

    await user.type(screen.getByLabelText("Tu texto"), "Estimado doctor");
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    await screen.findByText("Pendiente de revisión del profesor.");
    screen.getByText("La IA propone 16 de 20. No cuenta hasta que el profesor lo firme.");
    expect(screen.queryByText("Corregido: 16 de 20")).toBeNull();
  });

  it("un error al enviar se muestra traducido y no se inventa ninguna corrección", async () => {
    const user = userEvent.setup();
    listExercisesToDoMock.mockResolvedValue([clozeExercise]);
    submitAttemptMock.mockRejectedValue(
      new ApiError({
        code: "attempt_access_denied",
        title: "No puedes enviar respuestas en nombre de otra persona.",
        status: 403,
      }),
    );

    renderScreen();

    await screen.findByRole("heading", { name: "Huecos" });
    await user.type(screen.getByLabelText("Hueco (1)"), "desde");
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    await screen.findByRole("alert");
    screen.getByText("No puedes enviar respuestas en nombre de otra persona.");
    expect(screen.queryByText(/Corregido/)).toBeNull();
  });

  it("sin nada contestado, el botón de enviar está deshabilitado", async () => {
    listExercisesToDoMock.mockResolvedValue([clozeExercise]);

    renderScreen();

    const submit = (await screen.findByRole("button", {
      name: "Enviar respuesta",
    })) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
