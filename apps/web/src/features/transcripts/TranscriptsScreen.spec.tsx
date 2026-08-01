import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptView } from "./api.js";

const { listTranscriptsMock } = vi.hoisted(() => ({
  listTranscriptsMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, listTranscripts: listTranscriptsMock };
});

const { TranscriptsScreen } = await import("./TranscriptsScreen.js");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TranscriptsScreen />
    </QueryClientProvider>,
  );
}

const transcripts: TranscriptView[] = [
  {
    transcriptId: "transcript-1",
    sessionId: "session-1",
    title: "B1 · Conversación médica",
    startsAt: "2026-07-27T09:00:00.000Z",
    status: "ready",
    provider: "livekit",
    language: "es",
    durationMs: 370000,
    summary: "La clase repasó síntomas y citas médicas.",
    blockedReason: null,
    readyAt: "2026-07-27T09:55:00.000Z",
    segments: [
      { segmentId: "s1", startMs: 0, endMs: 4200, speakerLabel: "Dan Whitfield", text: "Buenos días, vamos a practicar síntomas.", isTeacher: true },
      { segmentId: "s2", startMs: 61000, endMs: 66000, speakerLabel: "Lucía Ferrán", text: "Me duele la garganta desde ayer.", isTeacher: false },
    ],
  },
  {
    transcriptId: "transcript-2",
    sessionId: "session-2",
    title: "A2 · Tutoría menor",
    startsAt: "2026-07-27T12:00:00.000Z",
    status: "blocked_no_consent",
    provider: "livekit",
    language: "es",
    durationMs: null,
    summary: null,
    blockedReason: "Falta consentimiento de Hugo Peiró o su tutor legal.",
    readyAt: null,
    segments: [],
  },
];

describe("TranscriptsScreen (Ola 3, Tarea 10)", () => {
  beforeEach(() => {
    listTranscriptsMock.mockReset().mockResolvedValue(transcripts);
  });

  it("muestra visor con timestamps y filtra segmentos por búsqueda", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByRole("heading", { name: "Transcripciones" });
    await screen.findByText("01:01");
    screen.getByText("Me duele la garganta desde ayer.");

    await user.type(screen.getByLabelText("Buscar en la transcripción"), "garganta");

    const viewer = screen.getByRole("region", { name: "Visor de transcripción" });
    within(viewer).getByText("Me duele la garganta desde ayer.");
    expect(within(viewer).queryByText("Buenos días, vamos a practicar síntomas.")).toBeNull();
  });

  it("avisa con motivo claro cuando una transcripción está bloqueada", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "Abrir A2 · Tutoría menor" }));

    screen.getByRole("alert");
    screen.getByText("Transcripción bloqueada");
    screen.getByText("Falta consentimiento de Hugo Peiró o su tutor legal.");
  });
});
