import { describe, expect, it } from "vitest";
import { canAccessPersonalData, type PersonAccessContext } from "./personal-data-access.js";

const ADULTO: PersonAccessContext = {
  membershipId: "alumno-adulto",
  isMinor: false,
  guardianMembershipIds: [],
};

const MENOR: PersonAccessContext = {
  membershipId: "alumno-menor",
  isMinor: true,
  guardianMembershipIds: ["tutor-1", "tutor-2"],
};

describe("canAccessPersonalData (Tarea 15)", () => {
  it("un adulto puede acceder a sus propios datos", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "alumno-adulto",
        requesterRoles: ["student"],
        target: ADULTO,
      }),
    ).toBe(true);
  });

  it("un adulto NO puede acceder a los datos de otro alumno adulto", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "otro-alumno",
        requesterRoles: ["student"],
        target: ADULTO,
      }),
    ).toBe(false);
  });

  it("un menor NO puede ejercer el derecho sobre sí mismo: debe hacerlo su tutor", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "alumno-menor",
        requesterRoles: ["student"],
        target: MENOR,
      }),
    ).toBe(false);
  });

  it("el tutor legal de un menor puede acceder a sus datos", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "tutor-1",
        requesterRoles: ["guardian"],
        target: MENOR,
      }),
    ).toBe(true);
  });

  it("un tutor de OTRO menor no puede acceder a estos datos", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "tutor-de-otro-alumno",
        requesterRoles: ["guardian"],
        target: MENOR,
      }),
    ).toBe(false);
  });

  it("la dirección (owner) puede acceder a los datos de cualquiera", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "direccion",
        requesterRoles: ["owner"],
        target: MENOR,
      }),
    ).toBe(true);
  });

  it("admin puede acceder igual que owner", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "admin-x",
        requesterRoles: ["admin"],
        target: ADULTO,
      }),
    ).toBe(true);
  });

  it("un profesor no tiene acceso especial a los datos de un alumno", () => {
    expect(
      canAccessPersonalData({
        requesterMembershipId: "profesor-x",
        requesterRoles: ["teacher"],
        target: ADULTO,
      }),
    ).toBe(false);
  });
});
