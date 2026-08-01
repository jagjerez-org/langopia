import { describe, expect, it } from "vitest";
import {
  Impersonation,
  ImpersonationAlreadyEndedError,
  ImpersonationEnded,
  ImpersonationId,
  ImpersonationStarted,
  InvalidImpersonationReasonError,
} from "./impersonation.aggregate.js";

const NOW = new Date("2026-07-27T10:00:00.000Z");

function start(overrides: Partial<Parameters<typeof Impersonation.start>[0]> = {}) {
  return Impersonation.start({
    id: ImpersonationId.of("11111111-1111-4111-8111-111111111111"),
    schoolId: "s-1",
    targetMembershipId: "m-target",
    impersonatorUserId: "u-actor",
    impersonatorMembershipId: "m-actor",
    impersonatorName: "Ana Soporte",
    impersonatorEmail: "ana@langopia.app",
    reason: "El alumno no puede programar su clase de conversación",
    involvesMinor: false,
    guardianMembershipIds: [],
    now: NOW,
    ...overrides,
  });
}

describe("Impersonation.start — motivo obligatorio", () => {
  it("rechaza un motivo por debajo de 10 caracteres", () => {
    expect(() => start({ reason: "muy corto" })).toThrow(InvalidImpersonationReasonError);
  });

  it("rechaza un motivo que solo tiene espacios de sobra", () => {
    expect(() => start({ reason: "   corto   " })).toThrow(InvalidImpersonationReasonError);
  });

  it("acepta un motivo de exactamente 10 caracteres", () => {
    expect(() => start({ reason: "1234567890" })).not.toThrow();
  });

  it("recorta los espacios del motivo antes de guardarlo", () => {
    const imp = start({ reason: "  motivo con espacios alrededor  " });
    expect(imp.reason).toBe("motivo con espacios alrededor");
  });
});

describe("Impersonation.start — caducidad", () => {
  it("caduca a los 30 minutos exactos", () => {
    const imp = start();
    expect(imp.expiresAt.getTime() - imp.startedAt.getTime()).toBe(30 * 60 * 1000);
  });

  it("no está caducada justo al empezar", () => {
    const imp = start();
    expect(imp.isExpired(NOW)).toBe(false);
  });

  it("no está caducada un segundo antes de los 30 minutos", () => {
    const imp = start();
    const justBefore = new Date(imp.expiresAt.getTime() - 1000);
    expect(imp.isExpired(justBefore)).toBe(false);
  });

  it("está caducada justo en el instante de expiración", () => {
    const imp = start();
    expect(imp.isExpired(imp.expiresAt)).toBe(true);
  });

  it("está caducada bien pasados los 30 minutos", () => {
    const imp = start();
    const muchLater = new Date(imp.expiresAt.getTime() + 60 * 60 * 1000);
    expect(imp.isExpired(muchLater)).toBe(true);
  });
});

describe("Impersonation.start — evento de dominio", () => {
  it("emite ImpersonationStarted con los datos de quién parecía y quién era", () => {
    const imp = start({ involvesMinor: true, guardianMembershipIds: ["m-guardian-1"] });
    const events = imp.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ImpersonationStarted);
    expect((events[0] as ImpersonationStarted).payload()).toMatchObject({
      targetMembershipId: "m-target",
      impersonatorUserId: "u-actor",
      impersonatorMembershipId: "m-actor",
      involvesMinor: true,
      guardianMembershipIds: ["m-guardian-1"],
    });
  });

  it("admite un impersonador sin membresía propia (soporte de la plataforma)", () => {
    const imp = start({ impersonatorMembershipId: null });
    expect(imp.impersonatorMembershipId).toBeNull();
  });
});

describe("Impersonation.end", () => {
  it("no se puede terminar dos veces", () => {
    const imp = start();
    imp.end(new Date(NOW.getTime() + 5 * 60_000));
    expect(() => imp.end(new Date(NOW.getTime() + 6 * 60_000))).toThrow(
      ImpersonationAlreadyEndedError,
    );
  });

  it("terminar a mano antes de caducar registra la duración real y el motivo 'manual'", () => {
    const imp = start();
    imp.pullDomainEvents();
    imp.end(new Date(NOW.getTime() + 5 * 60_000));
    const events = imp.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ImpersonationEnded);
    expect((events[0] as ImpersonationEnded).payload()).toMatchObject({
      durationSeconds: 5 * 60,
      endedReason: "manual",
    });
    expect(imp.endedAt).toEqual(new Date(NOW.getTime() + 5 * 60_000));
  });

  it("terminar después de caducar tope la duración a los 30 minutos y el motivo es 'expired'", () => {
    const imp = start();
    imp.pullDomainEvents();
    imp.end(new Date(NOW.getTime() + 90 * 60_000));
    const events = imp.pullDomainEvents();
    expect((events[0] as ImpersonationEnded).payload()).toMatchObject({
      durationSeconds: 30 * 60,
      endedReason: "expired",
    });
    expect(imp.endedAt).toEqual(imp.expiresAt);
  });

  it("hasEnded refleja si ya se cerró", () => {
    const imp = start();
    expect(imp.hasEnded).toBe(false);
    imp.end(NOW);
    expect(imp.hasEnded).toBe(true);
  });
});

describe("Impersonation.reconstruct", () => {
  it("no emite eventos: la reconstrucción no es un alta nueva", () => {
    const imp = Impersonation.reconstruct({
      id: ImpersonationId.of("11111111-1111-4111-8111-111111111111"),
      schoolId: "s-1",
      targetMembershipId: "m-target",
      impersonatorUserId: "u-actor",
      impersonatorMembershipId: "m-actor",
      impersonatorName: "Ana Soporte",
      impersonatorEmail: "ana@langopia.app",
      reason: "Motivo ya validado antes",
      involvesMinor: false,
      startedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 30 * 60_000),
      endedAt: null,
    });
    expect(imp.pullDomainEvents()).toHaveLength(0);
  });
});
