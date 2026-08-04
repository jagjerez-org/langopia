import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-client.js";
import "./dialog-polyfill.testsupport.js";

const { scheduleSessionMock } = vi.hoisted(() => ({ scheduleSessionMock: vi.fn() }));

vi.mock("./api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api.js")>();
  return { ...actual, scheduleSession: scheduleSessionMock };
});

const { ScheduleSessionDialog } = await import("./ScheduleSessionDialog.js");

describe("ScheduleSessionDialog (Tarea 9, Paso 2 y Paso 5)", () => {
  beforeEach(() => {
    scheduleSessionMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pinta el selector de aula con LiveKit, Zoom, Meet, Teams y presencial", () => {
    render(
      <ScheduleSessionDialog
        open
        onClose={() => {}}
        onScheduled={() => {}}
        timeZone="Europe/Madrid"
        groups={[{ groupId: "g1", label: "ES-B1 — B1 tardes" }]}
        teachers={[{ teacherId: "t1", teacherName: "Carla Ruiz" }]}
      />,
    );

    const select = screen.getByLabelText(/Tipo de aula/) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.textContent);
    expect(optionLabels).toEqual([
      "Aula propia (LiveKit)",
      "Zoom",
      "Google Meet",
      "Microsoft Teams",
      "Presencial",
    ]);
  });

  it("teacher_overlap se muestra junto al campo de profesor, no como aviso genérico", async () => {
    scheduleSessionMock.mockRejectedValue(
      new ApiError({
        code: "teacher_overlap",
        title: "El profesor ya tiene otra clase a esa hora.",
        status: 409,
      }),
    );
    const user = userEvent.setup();

    render(
      <ScheduleSessionDialog
        open
        onClose={() => {}}
        onScheduled={() => {}}
        timeZone="Europe/Madrid"
        groups={[{ groupId: "g1", label: "ES-B1 — B1 tardes" }]}
        teachers={[{ teacherId: "t1", teacherName: "Carla Ruiz" }]}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^Grupo/), "g1");
    await user.selectOptions(screen.getByLabelText(/Tipo de aula/), "in_person");
    await user.type(screen.getByLabelText(/Fecha y hora de inicio/), "2026-08-03T10:00");
    await user.click(screen.getByRole("button", { name: "Programar" }));

    await waitFor(() =>
      expect(screen.getByText("El profesor ya tiene otra clase que se solapa con esa franja.")).toBeTruthy(),
    );
    // El mensaje aparece junto al `Select` de profesor: comprobado buscando su `aria-describedby`.
    const teacherSelect = screen.getByLabelText(/^Profesor/) as HTMLSelectElement;
    expect(teacherSelect.getAttribute("aria-invalid")).toBe("true");
  });

  it("convierte la hora local de la escuela a UTC al enviar", async () => {
    scheduleSessionMock.mockResolvedValue({ sessionId: "s1" });
    const onScheduled = vi.fn();
    const user = userEvent.setup();

    render(
      <ScheduleSessionDialog
        open
        onClose={() => {}}
        onScheduled={onScheduled}
        timeZone="America/Sao_Paulo"
        groups={[{ groupId: "g1", label: "ES-B1 — B1 tardes" }]}
        teachers={[]}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^Grupo/), "g1");
    // Presencial: el único proveedor de aula que no exige enlace ni
    // identificador de reunión, así que este envío no necesita rellenarlos.
    await user.selectOptions(screen.getByLabelText(/Tipo de aula/), "in_person");
    await user.type(screen.getByLabelText(/Fecha y hora de inicio/), "2026-08-03T11:00");
    await user.click(screen.getByRole("button", { name: "Programar" }));

    await waitFor(() => expect(scheduleSessionMock).toHaveBeenCalledTimes(1));
    const [payload] = scheduleSessionMock.mock.calls[0] as [{ startsAt: string }];
    expect(payload.startsAt).toBe("2026-08-03T14:00:00.000Z");
    expect(onScheduled).toHaveBeenCalledTimes(1);
  });
});
