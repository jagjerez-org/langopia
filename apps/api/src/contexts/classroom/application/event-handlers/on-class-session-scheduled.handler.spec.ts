import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import { ClassSessionScheduled } from "../../../scheduling/domain/events/class-session.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { RoomProvider } from "../../domain/model/room-provider.js";
import type { RoomProviderPort } from "../../domain/ports/room-provider.port.js";
import type { SessionRoomPort } from "../../domain/ports/session-room.port.js";
import { OnClassSessionScheduled } from "./on-class-session-scheduled.handler.js";

const SESSION_ID = "55555555-5555-4555-8555-555555555555";
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";

function buildEvent(provider: RoomProvider): ClassSessionScheduled {
  return new ClassSessionScheduled({
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    groupId: "22222222-2222-4222-8222-222222222222",
    teacherId: "33333333-3333-4333-8333-333333333333",
    start: new Date("2026-09-01T10:00:00Z"),
    end: new Date("2026-09-01T11:00:00Z"),
    roomProvider: provider,
  });
}

/** Doble de la unidad de trabajo: ejecuta el trabajo tal cual, sin transacción real. */
function fakeUow(): UnitOfWork {
  return {
    execute: (work) => work(),
    read: (work) => work(),
  };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

describe("OnClassSessionScheduled", () => {
  it("crea la sala y guarda su url y su id externo", async () => {
    const attachRoom = vi.fn().mockResolvedValue(undefined);
    const createRoom = vi
      .fn()
      .mockResolvedValue({ status: "created", url: "https://aula.langopia.app/r/" + SESSION_ID, externalId: null });
    const rooms: RoomProviderPort = { createRoom, issueJoinToken: vi.fn(), deleteRoom: vi.fn() };
    const sessionRooms: SessionRoomPort = { find: vi.fn(), attachRoom };

    const handler = new OnClassSessionScheduled(rooms, sessionRooms, fakeUow(), fakeLogger());
    await handler.handle(buildEvent(RoomProvider.LiveKit));

    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        schoolId: SCHOOL_ID,
        provider: RoomProvider.LiveKit,
      }),
    );
    expect(attachRoom).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      url: "https://aula.langopia.app/r/" + SESSION_ID,
      externalId: null,
    });
  });

  it("una clase presencial no crea ninguna sala", async () => {
    const createRoom = vi.fn();
    const attachRoom = vi.fn();
    const rooms: RoomProviderPort = { createRoom, issueJoinToken: vi.fn(), deleteRoom: vi.fn() };
    const sessionRooms: SessionRoomPort = { find: vi.fn(), attachRoom };

    const handler = new OnClassSessionScheduled(rooms, sessionRooms, fakeUow(), fakeLogger());
    await handler.handle(buildEvent(RoomProvider.InPerson));

    expect(createRoom).not.toHaveBeenCalled();
    expect(attachRoom).not.toHaveBeenCalled();
  });

  it("si el proveedor no está conectado, la sala queda pendiente sin lanzar ni guardar nada", async () => {
    const createRoom = vi
      .fn()
      .mockResolvedValue({ status: "pending", reason: "La escuela no tiene Zoom conectado." });
    const attachRoom = vi.fn();
    const rooms: RoomProviderPort = { createRoom, issueJoinToken: vi.fn(), deleteRoom: vi.fn() };
    const sessionRooms: SessionRoomPort = { find: vi.fn(), attachRoom };

    const handler = new OnClassSessionScheduled(rooms, sessionRooms, fakeUow(), fakeLogger());
    await expect(handler.handle(buildEvent(RoomProvider.Zoom))).resolves.toBeUndefined();

    expect(attachRoom).not.toHaveBeenCalled();
  });
});
