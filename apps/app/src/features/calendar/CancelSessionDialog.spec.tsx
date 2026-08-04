import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgendaEntry } from "@langopia/contracts";

const { getCancellationPreviewMock, cancelSessionMock } = vi.hoisted(() => ({
  getCancellationPreviewMock: vi.fn(),
  cancelSessionMock: vi.fn(),
}));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return {
    ...actual,
    getCancellationPreview: getCancellationPreviewMock,
    cancelSession: cancelSessionMock,
  };
});

const { CancelSessionDialog } = await import("./CancelSessionDialog.js");

const session: AgendaEntry = {
  sessionId: "11111111-1111-1111-1111-111111111111",
  groupId: "22222222-2222-2222-2222-222222222222",
  groupName: "B1 tardes",
  courseCode: "ES-B1",
  teacherId: "33333333-3333-3333-3333-333333333333",
  teacherName: "Carla Ruiz",
  start: "2026-08-10T09:00:00.000Z",
  end: "2026-08-10T10:00:00.000Z",
  status: "scheduled",
  roomProvider: "zoom",
  roomUrl: "https://zoom.example/1",
  topic: null,
  enrolledStudents: 6,
};

function renderDialog(onCancelled = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CancelSessionDialog open session={session} onClose={() => {}} onCancelled={onCancelled} />
    </QueryClientProvider>,
  );
}

describe("CancelSessionDialog (Tarea 9, Paso 3)", () => {
  beforeEach(() => {
    getCancellationPreviewMock.mockReset();
    cancelSessionMock.mockReset();
  });

  it("con más de 24 h de antelación, la API anuncia devolución ANTES de confirmar", async () => {
    getCancellationPreviewMock.mockResolvedValue({ refundDue: true, noticeHours: 48 });

    renderDialog();

    await screen.findByText(/generará una devolución al alumno/);
    // El botón de confirmar sigue sin haberse pulsado: la API ya lo calculó
    // sin que se haya cancelado nada todavía.
    expect(cancelSessionMock).not.toHaveBeenCalled();
  });

  it("con menos de 24 h, la API anuncia que NO hay devolución", async () => {
    getCancellationPreviewMock.mockResolvedValue({ refundDue: false, noticeHours: 3 });

    renderDialog();

    await screen.findByText(/NO generará devolución/);
  });

  it("cambiar quién cancela (escuela/alumno) vuelve a pedir el adelanto", async () => {
    getCancellationPreviewMock.mockResolvedValue({ refundDue: true, noticeHours: 48 });
    const user = userEvent.setup();

    renderDialog();
    await screen.findByText(/generará una devolución al alumno/);
    const callsBefore = getCancellationPreviewMock.mock.calls.length;

    await user.selectOptions(screen.getByLabelText(/Quién cancela/), "student");

    await waitFor(() => expect(getCancellationPreviewMock.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(getCancellationPreviewMock).toHaveBeenLastCalledWith(session.sessionId, "student");
  });

  it("confirmar cancela de verdad, con el motivo escrito", async () => {
    getCancellationPreviewMock.mockResolvedValue({ refundDue: true, noticeHours: 48 });
    cancelSessionMock.mockResolvedValue({ sessionId: session.sessionId, refundDue: true, noticeHours: 48 });
    const onCancelled = vi.fn();
    const user = userEvent.setup();

    renderDialog(onCancelled);
    await screen.findByText(/generará una devolución al alumno/);

    await user.type(screen.getByLabelText(/Motivo/), "El profesor está enfermo");
    await user.click(screen.getByRole("button", { name: "Cancelar clase" }));

    await waitFor(() => expect(cancelSessionMock).toHaveBeenCalledWith(session.sessionId, { party: "school", reason: "El profesor está enfermo" }));
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith({ refundDue: true }));
  });
});
