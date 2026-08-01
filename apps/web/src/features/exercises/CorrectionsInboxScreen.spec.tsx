import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import type { PendingAttemptEntry } from "./types.js";

const {
  listPendingAttemptsMock,
  validateAttemptMock,
  returnAttemptMock,
  getSchoolTimezoneMock,
} = vi.hoisted(() => ({
  listPendingAttemptsMock: vi.fn(),
  validateAttemptMock: vi.fn(),
  returnAttemptMock: vi.fn(),
  getSchoolTimezoneMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    listPendingAttempts: listPendingAttemptsMock,
    validateAttempt: validateAttemptMock,
    returnAttempt: returnAttemptMock,
    getSchoolTimezone: getSchoolTimezoneMock,
  };
});

const { CorrectionsInboxScreen } = await import("./CorrectionsInboxScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CorrectionsInboxScreen />
    </QueryClientProvider>,
  );
}

/** Copiado de lo que sirve `GET /assessments/attempts/pending` contra el seed. */
const writingEntry: PendingAttemptEntry = {
  attemptId: "e85c4862-09e6-4c74-aabc-443c701f9924",
  exerciseId: "0bec42d6-3bc4-4254-ba4b-c3b8147a910f",
  exerciseType: "written_production",
  skill: "writing",
  prompt: {
    task: "Escribe un correo a tu médico de cabecera pidiendo cita.",
    minWords: 80,
    maxWords: 100,
    register: "formal",
  },
  response: { text: "Hola doctor, necesito una cita porque me encuentro mal desde el lunes...", wordCount: 81 },
  maxScore: 20,
  studentProfileId: "c0000000-0000-0000-0000-000000000001",
  studentName: "Tomás Ferrán",
  status: "ai_graded",
  attemptNumber: 1,
  aiScore: 11,
  aiFeedback: "Registro demasiado informal para la tarea.",
  // 23:30 UTC del 27 es ya el 28 en Madrid: si se pintara en la zona del
  // navegador (UTC en las pruebas) saldría el día 27.
  submittedAt: "2026-07-27T23:30:00.000Z",
};

const clozeEntry: PendingAttemptEntry = {
  attemptId: "af445000-4e3b-4f5e-be87-fe4c205ff7aa",
  exerciseId: "eaf81977-c3f3-462e-82eb-015c4c761ccb",
  exerciseType: "cloze",
  skill: "grammar",
  prompt: {
    text: "Me duele la garganta {{1}} hace tres días y no puedo {{2}} bien.",
    blanks: [{ id: 1 }, { id: 2 }],
    openEnded: true,
  },
  response: { "1": "desde", "2": "tragar" },
  maxScore: 2,
  studentProfileId: "b488a129-6c52-4c61-aafa-01f8d7bfeac9",
  studentName: "Lucía Ferrán",
  status: "ai_graded",
  attemptNumber: 1,
  aiScore: 2,
  aiFeedback: "Ambos huecos correctos.",
  submittedAt: "2026-07-26T10:00:00.000Z",
};

describe("CorrectionsInboxScreen (Tarea 12 de la ola 2, Paso 5: bandeja del profesor)", () => {
  beforeEach(() => {
    listPendingAttemptsMock.mockReset();
    validateAttemptMock.mockReset().mockResolvedValue({});
    returnAttemptMock.mockReset().mockResolvedValue({});
    getSchoolTimezoneMock.mockReset().mockResolvedValue({ timezone: "Europe/Madrid" });
  });

  it("estado de carga: se anuncia mientras se resuelve la bandeja", async () => {
    listPendingAttemptsMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("estado vacío: sin nada que firmar, lo dice", async () => {
    listPendingAttemptsMock.mockResolvedValue([]);

    renderScreen();

    await screen.findByText("No hay nada pendiente de firmar");
    screen.getByText("Cuando el alumnado envíe respuestas, aparecerán aquí.");
  });

  it("un error de la API se muestra traducido, con botón de reintentar, nunca el code crudo", async () => {
    listPendingAttemptsMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "Requiere el rol teacher",
        status: 403,
        params: { required: "teacher" },
      }),
    );

    renderScreen();

    await screen.findByRole("alert");
    screen.getByText("Esta acción requiere el rol teacher.");
    expect(screen.queryByText("insufficient_role")).toBeNull();
    screen.getByRole("button", { name: "Reintentar" });
  });

  it("enseña la respuesta legible, la propuesta de la IA y la fecha en la zona de la escuela", async () => {
    listPendingAttemptsMock.mockResolvedValue([writingEntry, clozeEntry]);

    renderScreen();

    await screen.findByRole("heading", { name: "Tomás Ferrán" });
    screen.getByText("La IA propone; la nota no cuenta hasta que la firmas.");
    screen.getByText("Hola doctor, necesito una cita porque me encuentro mal desde el lunes...");
    screen.getByText("La IA propone 11 de 20. No cuenta hasta que el profesor lo firme.");
    // 23:30 UTC del 27 → 28 de julio en Madrid.
    screen.getByText(/Intento 1 · Corregido por la IA · enviado el 28 jul 2026/);

    // Un `cloze` se lee hueco a hueco, no como JSON crudo.
    screen.getByText("Hueco (1): desde");
    screen.getByText("Hueco (2): tragar");
    expect(screen.queryByText(/\{"1"/)).toBeNull();
  });

  it("firmar manda la nota del profesor, prellenada con la propuesta de la IA", async () => {
    const user = userEvent.setup();
    listPendingAttemptsMock.mockResolvedValue([clozeEntry]);

    renderScreen();

    const score = (await screen.findByLabelText("Nota (de 0 a 2)")) as HTMLInputElement;
    expect(score.value).toBe("2");

    await user.type(screen.getByLabelText("Comentario para el alumno"), "De acuerdo.");
    await user.click(screen.getByRole("button", { name: "Firmar la corrección" }));

    await waitFor(() =>
      expect(validateAttemptMock).toHaveBeenCalledWith(clozeEntry.attemptId, {
        teacherScore: 2,
        teacherFeedback: "De acuerdo.",
      }),
    );
  });

  it("devolver exige comentario: sin él el botón está deshabilitado", async () => {
    const user = userEvent.setup();
    listPendingAttemptsMock.mockResolvedValue([clozeEntry]);

    renderScreen();

    const returnButton = (await screen.findByRole("button", {
      name: "Devolver para rehacer",
    })) as HTMLButtonElement;
    expect(returnButton.disabled).toBe(true);

    await user.type(screen.getByLabelText("Comentario para el alumno"), "Repasa el segundo hueco.");
    await user.click(screen.getByRole("button", { name: "Devolver para rehacer" }));

    await waitFor(() =>
      expect(returnAttemptMock).toHaveBeenCalledWith(clozeEntry.attemptId, {
        teacherFeedback: "Repasa el segundo hueco.",
      }),
    );
  });

  it("un fallo al firmar se muestra traducido y no se da la firma por hecha", async () => {
    const user = userEvent.setup();
    listPendingAttemptsMock.mockResolvedValue([clozeEntry]);
    validateAttemptMock.mockRejectedValue(
      new ApiError({
        code: "validation_failed",
        title: "La nota supera el máximo del ejercicio.",
        status: 422,
      }),
    );

    renderScreen();

    await screen.findByRole("button", { name: "Firmar la corrección" });
    await user.click(screen.getByRole("button", { name: "Firmar la corrección" }));

    await screen.findByRole("alert");
    // `validation_failed` SÍ está en el catálogo del panel, así que gana su
    // traducción sobre el `title` de la API (`useErrorMessage`, Tarea 5).
    screen.getByText("Los datos enviados no son válidos.");
    expect(screen.queryByText("validation_failed")).toBeNull();
  });
});
