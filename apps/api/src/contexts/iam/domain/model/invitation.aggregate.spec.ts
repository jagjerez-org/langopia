import { describe, expect, it } from "vitest";
import {
  Invitation,
  InvitationAlreadyResolvedError,
  InvitationEmailMismatchError,
  InvitationExpiredError,
  InvitationId,
  MemberInvited,
} from "./invitation.aggregate.js";

const ID = "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
const SCHOOL_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NOW = new Date("2026-07-27T10:00:00Z");

function invite(now = NOW) {
  return Invitation.invite({
    id: InvitationId.of(ID),
    schoolId: SCHOOL_ID,
    email: "Nueva.Profesora@example.com",
    role: "teacher",
    token: "un-token-opaco",
    now,
  });
}

describe("Invitation.invite", () => {
  it("caduca a los 7 días y guarda el correo en minúsculas", () => {
    const invitation = invite();
    expect(invitation.expiresAt.toISOString()).toBe("2026-08-03T10:00:00.000Z");
    expect(invitation.email).toBe("nueva.profesora@example.com");
  });

  it("emite MemberInvited con los datos de la invitación", () => {
    const invitation = invite();
    const [event] = invitation.pullDomainEvents();
    expect(event).toBeInstanceOf(MemberInvited);
    expect(event!.eventName).toBe("iam.member.invited");
    expect(event!.schoolId).toBe(SCHOOL_ID);
    expect(event!.payload()).toMatchObject({
      email: "nueva.profesora@example.com",
      role: "teacher",
      token: "un-token-opaco",
    });
  });
});

describe("Invitation.accept", () => {
  it("acepta cuando el correo coincide y no ha caducado", () => {
    const invitation = invite();
    invitation.accept("nueva.profesora@example.com", NOW);
    expect(invitation.acceptedAt).toEqual(NOW);
  });

  it("acepta el correo sin importar mayúsculas", () => {
    const invitation = invite();
    invitation.accept("NUEVA.PROFESORA@EXAMPLE.COM", NOW);
    expect(invitation.acceptedAt).toEqual(NOW);
  });

  it("rechaza un correo distinto al invitado", () => {
    const invitation = invite();
    expect(() => invitation.accept("otra@example.com", NOW)).toThrow(InvitationEmailMismatchError);
  });

  it("rechaza aceptar pasados los 7 días", () => {
    const invitation = invite();
    const ocho_dias_despues = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(() => invitation.accept("nueva.profesora@example.com", ocho_dias_despues)).toThrow(
      InvitationExpiredError,
    );
  });

  it("rechaza aceptar dos veces", () => {
    const invitation = invite();
    invitation.accept("nueva.profesora@example.com", NOW);
    expect(() => invitation.accept("nueva.profesora@example.com", NOW)).toThrow(
      InvitationAlreadyResolvedError,
    );
  });
});
