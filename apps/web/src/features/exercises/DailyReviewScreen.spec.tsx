import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import { createTestRouter } from "./test-router.testsupport.js";
import type { DueCard, ExerciseToDo } from "./types.js";

const { listDueCardsMock, listExercisesToDoMock, submitAttemptMock, getMyStudentsMock } = vi.hoisted(
  () => ({
    listDueCardsMock: vi.fn(),
    listExercisesToDoMock: vi.fn(),
    submitAttemptMock: vi.fn(),
    getMyStudentsMock: vi.fn(),
  }),
);

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    listDueCards: listDueCardsMock,
    listExercisesToDo: listExercisesToDoMock,
    submitAttempt: submitAttemptMock,
  };
});

vi.mock("../portal/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../portal/api.js")>();
  return { ...actual, getMyStudents: getMyStudentsMock };
});

const { DailyReviewScreen } = await import("./DailyReviewScreen.js");

const STUDENT_ID = "b488a129-6c52-4c61-aafa-01f8d7bfeac9";
const EXERCISE_ID = "ad8e5c86-1c05-4d38-8759-e2f23b6edaea";

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter("/mi/repaso", [{ path: "/mi/repaso", component: DailyReviewScreen }]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const dueCard: DueCard = {
  id: "69b90119-16d9-4a65-a852-65a87aef35f3",
  exerciseId: EXERCISE_ID,
  ease: 1.7,
  intervalDays: 1,
  repetitions: 1,
  lapses: 3,
  dueOn: "2026-07-25",
  lastReviewedAt: "2026-07-24T19:41:57.242Z",
};

const minimalPairsExercise: ExerciseToDo = {
  exerciseId: EXERCISE_ID,
  contentUnitId: "33333333-3333-3333-3333-333333333333",
  unitCode: "ES-B1-U7",
  type: "minimal_pairs",
  skill: "phonetics",
  prompt: {
    question: "¿Qué palabra oyes?",
    pairs: [{ a: "pero", b: "perro", contrast: "vibrante simple vs. múltiple" }],
  },
  maxScore: 3,
  requiresTeacherValidation: false,
  srsEnabled: true,
  latestAttempt: null,
};

describe("DailyReviewScreen (Tarea 12 de la ola 2, Paso 4: repaso diario)", () => {
  beforeEach(() => {
    listDueCardsMock.mockReset();
    listExercisesToDoMock.mockReset().mockResolvedValue([minimalPairsExercise]);
    submitAttemptMock.mockReset();
    getMyStudentsMock.mockReset().mockResolvedValue([{ studentId: STUDENT_ID, name: "Lucía Ferrán" }]);
  });

  it("estado de carga: se anuncia mientras se resuelve el repaso", async () => {
    listDueCardsMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("estado vacío: sin tarjetas vencidas, lo dice", async () => {
    listDueCardsMock.mockResolvedValue([]);

    renderScreen();

    await screen.findByText("Hoy no tienes nada que repasar");
    screen.getByText("El repaso aparece cuando toca volver sobre lo que fallaste.");
  });

  it("un error de la API se muestra traducido, con botón de reintentar", async () => {
    listDueCardsMock.mockRejectedValue(
      new ApiError({
        code: "due_cards_access_denied",
        title: "No puedes ver el repaso de otra persona.",
        status: 403,
      }),
    );

    renderScreen();

    await screen.findByRole("alert");
    screen.getByText("No puedes ver el repaso de otra persona.");
    expect(screen.queryByText("due_cards_access_denied")).toBeNull();
    screen.getByRole("button", { name: "Reintentar" });
  });

  it("cruza cada tarjeta con su ejercicio y deja rehacerlo, enviando la respuesta que espera la API", async () => {
    const user = userEvent.setup();
    listDueCardsMock.mockResolvedValue([dueCard]);
    submitAttemptMock.mockResolvedValue({
      attemptId: "f38872c9-edd8-4723-91a9-719c38d16888",
      status: "ai_graded",
      aiScore: 3,
      aiFeedback: "3 de 3 respuesta(s) correcta(s).",
      maxScore: 3,
      requiresTeacherValidation: false,
    });

    renderScreen();

    await screen.findByText("1 tarjeta para repasar");
    // La fecha de vencimiento va formateada, no en crudo del servidor.
    screen.getByText("Vencía el 25 jul 2026 · 1 repasos · 3 fallos");

    await user.click(screen.getByLabelText("perro"));
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    await waitFor(() =>
      expect(submitAttemptMock).toHaveBeenCalledWith({
        exerciseId: EXERCISE_ID,
        studentProfileId: STUDENT_ID,
        response: { sequence: ["b"] },
      }),
    );

    await screen.findByText("Corregido: 3 de 3");
  });

  it("una tarjeta cuyo ejercicio ya no está publicado no desaparece en silencio", async () => {
    listDueCardsMock.mockResolvedValue([{ ...dueCard, exerciseId: "no-existe" }]);

    renderScreen();

    await screen.findByText("Este ejercicio ya no está disponible.");
  });
});
