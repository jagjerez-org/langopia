import { describe, expect, it } from "vitest";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { NotEnrolledInSessionError } from "../../../domain/errors/classroom.errors.js";
import { RoomProvider } from "../../../domain/model/room-provider.js";
import type { JoinToken, RoomProviderPort } from "../../../domain/ports/room-provider.port.js";
import type { SessionParticipationPort } from "../../../domain/ports/session-participation.port.js";
import type { SessionRoomPort } from "../../../domain/ports/session-room.port.js";
import type { TranscriptRepositoryPort } from "../../../domain/ports/transcript-repository.port.js";
import { JoinClassroomSessionCommand } from "./join-session.command.js";
import { JoinClassroomSessionHandler } from "./join-session.handler.js";

const CLASE = "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
const ESCUELA = "11111111-1111-4111-8111-111111111111";
const MIEMBRO = "22222222-2222-4222-8222-222222222222";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeTenant(roles: string[]): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => MIEMBRO,
    roles: () => roles,
    has: (role) => roles.includes(role),
  };
}

function fakeSessionRooms(): SessionRoomPort {
  return {
    find: async () => ({
      sessionId: CLASE,
      schoolId: ESCUELA,
      provider: RoomProvider.LiveKit,
      url: "wss://aula.example.com",
      externalId: null,
    }),
    attachRoom: async () => undefined,
  };
}

function fakeRoomProviders(): RoomProviderPort & { emitidos: number } {
  const state = { emitidos: 0 };
  return {
    get emitidos() {
      return state.emitidos;
    },
    issueJoinToken: async (): Promise<JoinToken> => {
      state.emitidos++;
      return { url: "wss://aula.example.com", token: "jwt-de-la-sala" } as JoinToken;
    },
  } as unknown as RoomProviderPort & { emitidos: number };
}

function fakeTranscripts(): TranscriptRepositoryPort {
  return {
    findExpired: async () => [],
    findExternalCompletedWithoutTranscript: async () => [],
    delete: async () => undefined,
    recordingStatusForSession: async () => null,
    findReadyById: async () => null,
    consentReadinessForSession: async () => ({ dataRetentionDays: 90, participants: [] }),
    save: async () => undefined,
    deleteForParticipant: async () => 0,
  };
}

function fakeParticipation(matriculado: boolean): SessionParticipationPort & { consultas: number } {
  const state = { consultas: 0 };
  return {
    get consultas() {
      return state.consultas;
    },
    isEnrolledInSessionGroup: async () => {
      state.consultas++;
      return matriculado;
    },
  } as SessionParticipationPort & { consultas: number };
}

function construir(roles: string[], matriculado: boolean) {
  const participation = fakeParticipation(matriculado);
  const roomProviders = fakeRoomProviders();
  const handler = new JoinClassroomSessionHandler(
    fakeSessionRooms(),
    participation,
    roomProviders,
    fakeTranscripts(),
    fakeUow(),
    fakeTenant(roles),
  );
  return { handler, participation, roomProviders };
}

/**
 * Saneamiento de cierre de la ola 1, menor 1: cualquier alumno podía unirse a
 * cualquier clase de su escuela. RLS aísla escuelas, no personas dentro de
 * una escuela, así que bastaba con conocer el identificador de una clase del
 * grupo de al lado. Antes de la corrección, la primera prueba devolvía el
 * token en vez de lanzar.
 */
describe("JoinClassroomSessionHandler — solo entra quien tiene clase ahí", () => {
  it("rechaza al alumno que no está matriculado en el grupo de la clase", async () => {
    const { handler, roomProviders } = construir(["student"], false);

    await expect(
      handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE })),
    ).rejects.toThrow(NotEnrolledInSessionError);

    // Y no se emite el token de todos modos: se rechaza ANTES de pedirlo.
    expect(roomProviders.emitidos).toBe(0);
  });

  it("rechaza igualmente al tutor que no lo es de nadie de ese grupo", async () => {
    const { handler } = construir(["guardian"], false);
    await expect(
      handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE })),
    ).rejects.toThrow(NotEnrolledInSessionError);
  });

  it("deja entrar al alumno matriculado", async () => {
    const { handler, roomProviders } = construir(["student"], true);
    await handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE }));
    expect(roomProviders.emitidos).toBe(1);
  });

  it("deja entrar al tutor de alguien del grupo", async () => {
    const { handler, roomProviders } = construir(["guardian"], true);
    await handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE }));
    expect(roomProviders.emitidos).toBe(1);
  });

  it.each(["owner", "admin", "teacher"])(
    "al personal de la escuela («%s») no se le pide matrícula: entrar es su trabajo",
    async (rol) => {
      const { handler, participation, roomProviders } = construir([rol], false);
      await handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE }));
      expect(roomProviders.emitidos).toBe(1);
      expect(participation.consultas).toBe(0);
    },
  );

  it("quien es profesora y además alumna entra como personal", async () => {
    const { handler, roomProviders } = construir(["teacher", "student"], false);
    await handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE }));
    expect(roomProviders.emitidos).toBe(1);
  });
});

/**
 * Tarea 11 del panel web (Paso 4): «aviso visible cuando la grabación está
 * bloqueada por falta de consentimiento, indicando el motivo». El aula no
 * calcula esto —lo decide el servidor—, así que viaja en la misma respuesta
 * que el token de entrada.
 */
describe("JoinClassroomSessionHandler — estado de grabación en la misma respuesta", () => {
  function construirConTranscripcion(transcripts: TranscriptRepositoryPort) {
    const handler = new JoinClassroomSessionHandler(
      fakeSessionRooms(),
      fakeParticipation(true),
      fakeRoomProviders(),
      transcripts,
      fakeUow(),
      fakeTenant(["student"]),
    );
    return handler;
  }

  it("sin fila de transcripción (clase futura), no hay bloqueo que avisar", async () => {
    const handler = construirConTranscripcion({
      findExpired: async () => [],
      findExternalCompletedWithoutTranscript: async () => [],
      delete: async () => undefined,
      recordingStatusForSession: async () => null,
      findReadyById: async () => null,
      consentReadinessForSession: async () => ({ dataRetentionDays: 90, participants: [] }),
      save: async () => undefined,
      deleteForParticipant: async () => 0,
    });

    const result = await handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE }));

    expect(result.recording).toEqual({ blocked: false, blockedReason: null });
  });

  it("con la transcripción bloqueada por falta de consentimiento, el motivo llega tal cual", async () => {
    const motivo = "Cuatro menores sin consentimiento de grabación.";
    const handler = construirConTranscripcion({
      findExpired: async () => [],
      findExternalCompletedWithoutTranscript: async () => [],
      delete: async () => undefined,
      recordingStatusForSession: async () => ({ blocked: true, blockedReason: motivo }),
      findReadyById: async () => null,
      consentReadinessForSession: async () => ({ dataRetentionDays: 90, participants: [] }),
      save: async () => undefined,
      deleteForParticipant: async () => 0,
    });

    const result = await handler.execute(new JoinClassroomSessionCommand({ sessionId: CLASE }));

    expect(result.recording).toEqual({ blocked: true, blockedReason: motivo });
    // El token se emite igual: unirse a la clase y grabarla no son la misma acción.
    expect(result.token).toBe("jwt-de-la-sala");
  });
});
