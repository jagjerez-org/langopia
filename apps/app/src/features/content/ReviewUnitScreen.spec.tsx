import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import { ToastProvider } from "../../ui/index.js";
import { createTestRouter } from "./test-router.testsupport.js";
import type { ContentUnitDetail, PublishTarget } from "./types.js";

const {
  getUnitDetailMock,
  getSchoolTimezoneMock,
  listPublishTargetsMock,
  publishUnitMock,
  updateExerciseMock,
} = vi.hoisted(() => ({
  getUnitDetailMock: vi.fn(),
  getSchoolTimezoneMock: vi.fn(),
  listPublishTargetsMock: vi.fn(),
  publishUnitMock: vi.fn(),
  updateExerciseMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getUnitDetail: getUnitDetailMock,
    getSchoolTimezone: getSchoolTimezoneMock,
    listPublishTargets: listPublishTargetsMock,
    publishUnit: publishUnitMock,
    updateExercise: updateExerciseMock,
  };
});

const { ReviewUnitScreen } = await import("./ReviewUnitScreen.js");

const UNIT_ID = "22222222-2222-2222-2222-222222222222";

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createTestRouter(`/contenido/${UNIT_ID}`, [
    { path: "/contenido", component: () => <></> },
    { path: "/contenido/$contentUnitId", component: ReviewUnitScreen },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label="Avisos" closeLabel="Cerrar aviso">
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const detail: ContentUnitDetail = {
  contentUnitId: UNIT_ID,
  code: "ES-B1-U7",
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  skills: ["vocabulary", "grammar"],
  status: "in_review",
  source: "ai_generated",
  primaryLocale: "es-ES",
  creditsSpent: 23,
  generationCostCents: 232,
  createdAt: "2026-07-27T23:30:00.000Z",
  reviewedAt: null,
  publishedAt: null,
  title: "En la consulta del médico",
  description: "Unidad de vocabulario médico básico.",
  body: "# En la consulta\n\nTexto de la unidad.",
  exercises: [
    {
      exerciseId: "33333333-3333-3333-3333-333333333333",
      position: 1,
      type: "cloze",
      skill: "grammar",
      prompt: { text: "Me ___ la cabeza.", blanks: [{ id: "b1" }] },
      solution: { answers: { b1: "duele" } },
      maxScore: 1,
      requiresTeacherValidation: false,
    },
    {
      exerciseId: "44444444-4444-4444-4444-444444444444",
      position: 2,
      type: "written_production",
      skill: "writing",
      prompt: { task: "Escribe un correo a tu médico." },
      solution: null,
      maxScore: 20,
      requiresTeacherValidation: true,
    },
  ],
};

const target: PublishTarget = {
  groupId: "55555555-5555-5555-5555-555555555555",
  name: "B1 Martes y jueves",
  courseId: "66666666-6666-6666-6666-666666666666",
  courseCode: "ES-B1",
  level: "B1",
  language: "es",
  status: "active",
};

describe("ReviewUnitScreen (Tarea 11 de la ola 2, Pasos 3 y 4)", () => {
  beforeEach(() => {
    getUnitDetailMock.mockReset().mockResolvedValue(detail);
    getSchoolTimezoneMock.mockReset().mockResolvedValue({ timezone: "Europe/Madrid" });
    listPublishTargetsMock.mockReset().mockResolvedValue([target]);
    publishUnitMock.mockReset().mockResolvedValue({ contentUnitId: UNIT_ID, status: "published" });
    updateExerciseMock.mockReset().mockResolvedValue({ exerciseId: detail.exercises[0]!.exerciseId });
  });

  it("estado de carga: se anuncia mientras se resuelve la unidad", async () => {
    getUnitDetailMock.mockReturnValue(new Promise(() => {}));

    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Cargando…").length).toBeGreaterThan(0));
  });

  it("un error de la API se muestra traducido, con reintentar y vuelta al listado", async () => {
    getUnitDetailMock.mockRejectedValue(
      new ApiError({ code: "not_found", title: "No encontrado", status: 404 }),
    );

    renderScreen();

    await screen.findByRole("alert");
    screen.getByRole("button", { name: "Reintentar" });
    screen.getByRole("link", { name: "Volver al listado" });
    expect(screen.queryByText("not_found")).toBeNull();
  });

  it("estado vacío: una unidad sin ejercicios lo dice en vez de una lista en blanco", async () => {
    getUnitDetailMock.mockResolvedValue({ ...detail, exercises: [] });

    renderScreen();

    await screen.findByText("Esta unidad todavía no tiene ejercicios.");
  });

  it("pinta el aviso de que la IA propone y el profesor firma mientras está pendiente de revisión", async () => {
    renderScreen();

    await screen.findByText(/Generada por IA y pendiente de revisión/);
    screen.getByText("Requiere firma del profesor");
  });

  it("muestra los vídeos beta con aviso explícito", async () => {
    getUnitDetailMock.mockResolvedValue({
      ...detail,
      assets: [
        {
          assetId: "77777777-7777-4777-8777-777777777777",
          kind: "video",
          mimeType: "video/mp4",
          storageKey: `${UNIT_ID}/units/ES-B1-U7/video-1`,
          durationMs: 42_000,
          isBeta: true,
          betaNotice: "Vídeo beta: puede fallar o no estar disponible para todos los alumnos.",
        },
      ],
    });

    renderScreen();

    await screen.findByText("Recursos");
    screen.getByText("Vídeo beta");
    screen.getByText("Vídeo beta: puede fallar o no estar disponible para todos los alumnos.");
  });

  it("las fechas van en la zona horaria de la escuela, no en la del navegador", async () => {
    renderScreen();

    await screen.findByText("Créditos gastados");
    screen.getByText(/28 jul 2026/);
  });

  it("Paso 3: edita un ejercicio y manda el JSON a PATCH .../exercises/:id", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("Ejercicio 1");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]!);

    const prompt = screen.getByLabelText("Enunciado (JSON)");
    await user.clear(prompt);
    await user.type(prompt, '{{"text":"Me duele la ___."}');
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(updateExerciseMock).toHaveBeenCalledWith(
        UNIT_ID,
        "33333333-3333-3333-3333-333333333333",
        { prompt: { text: "Me duele la ___." }, solution: { answers: { b1: "duele" } } },
      ),
    );
  });

  it("Paso 3: un JSON inválido se avisa aquí y no llega a la API", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("Ejercicio 1");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]!);

    const prompt = screen.getByLabelText("Enunciado (JSON)");
    await user.clear(prompt);
    await user.type(prompt, "esto no es json");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await screen.findByText("No es un JSON válido.");
    expect(updateExerciseMock).not.toHaveBeenCalled();
  });

  it("Paso 4: publica a los grupos marcados en el selector múltiple", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("B1 Martes y jueves");
    await user.click(screen.getByLabelText("B1 Martes y jueves"));
    await user.click(screen.getByRole("button", { name: "Publicar unidad" }));

    await waitFor(() =>
      expect(publishUnitMock).toHaveBeenCalledWith(UNIT_ID, [
        "55555555-5555-5555-5555-555555555555",
      ]),
    );
  });

  it("Paso 4: sin ningún grupo elegible, lo explica y aun así deja publicar", async () => {
    const user = userEvent.setup();
    listPublishTargetsMock.mockResolvedValue([]);
    renderScreen();

    await screen.findByText("No hay ningún grupo con un curso de este idioma y nivel.");
    await user.click(screen.getByRole("button", { name: "Publicar unidad" }));

    await waitFor(() => expect(publishUnitMock).toHaveBeenCalledWith(UNIT_ID, []));
  });

  it("Paso 4: un fallo al publicar se muestra traducido, nunca el code crudo", async () => {
    const user = userEvent.setup();
    publishUnitMock.mockRejectedValue(
      new ApiError({
        code: "insufficient_role",
        title: "Requiere el rol owner",
        status: 403,
        params: { required: "owner" },
      }),
    );
    renderScreen();

    await screen.findByText("B1 Martes y jueves");
    await user.click(screen.getByRole("button", { name: "Publicar unidad" }));

    await screen.findByText("Esta acción requiere el rol owner.");
    expect(screen.queryByText("insufficient_role")).toBeNull();
  });

  it("si los grupos publicables no se pueden cargar, se dice en su tarjeta sin tumbar la pantalla", async () => {
    listPublishTargetsMock.mockRejectedValue(
      new ApiError({ code: "not_found", title: "No encontrado", status: 404 }),
    );
    renderScreen();

    await screen.findByText("Ejercicio 1");
    await screen.findByText("No existe ese recurso en esta escuela.");
    screen.getByRole("button", { name: "Publicar unidad" });
  });
});
