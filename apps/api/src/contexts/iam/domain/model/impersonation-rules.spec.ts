import { describe, expect, it } from "vitest";
import {
  assertCanImpersonate,
  CannotImpersonateSelfError,
  ImpersonationAlreadyActiveError,
  ImpersonationChainError,
  ImpersonationNotAllowedError,
  type ImpersonationActorInput,
  type ImpersonationTargetInput,
} from "./impersonation-rules.js";

function actor(overrides: Partial<ImpersonationActorInput> = {}): ImpersonationActorInput {
  return {
    kind: "membership",
    membershipId: "m-actor",
    roles: [],
    isCurrentlyImpersonating: false,
    isCurrentlyBeingImpersonated: false,
    ...overrides,
  };
}

function target(overrides: Partial<ImpersonationTargetInput> = {}): ImpersonationTargetInput {
  return {
    membershipId: "m-target",
    role: "student",
    isCurrentlyImpersonatingSomeoneElse: false,
    ...overrides,
  };
}

describe("assertCanImpersonate — tabla de permisos", () => {
  it("soporte de la plataforma puede impersonar a cualquiera, de cualquier escuela", () => {
    expect(() =>
      assertCanImpersonate(actor({ kind: "platform_support", membershipId: null, roles: [] }), target({ role: "owner" })),
    ).not.toThrow();
  });

  it("el owner puede impersonar a admin, teacher, student y guardian de su escuela", () => {
    for (const role of ["admin", "teacher", "student", "guardian"] as const) {
      expect(() =>
        assertCanImpersonate(actor({ roles: ["owner"] }), target({ role })),
      ).not.toThrow();
    }
  });

  it("el admin puede impersonar a teacher, student y guardian de su escuela", () => {
    for (const role of ["teacher", "student", "guardian"] as const) {
      expect(() =>
        assertCanImpersonate(actor({ roles: ["admin"] }), target({ role })),
      ).not.toThrow();
    }
  });

  it("teacher, student y guardian no pueden impersonar a nadie", () => {
    for (const role of ["teacher", "student", "guardian"] as const) {
      expect(() => assertCanImpersonate(actor({ roles: [role] }), target())).toThrow(
        ImpersonationNotAllowedError,
      );
    }
  });
});

describe("assertCanImpersonate — escalada y horizontalidad", () => {
  it("nunca hacia arriba: admin no puede impersonar a owner", () => {
    expect(() =>
      assertCanImpersonate(actor({ roles: ["admin"] }), target({ role: "owner" })),
    ).toThrow(ImpersonationNotAllowedError);
  });

  it("nunca hacia arriba: teacher no puede impersonar a admin", () => {
    expect(() =>
      assertCanImpersonate(actor({ roles: ["teacher"] }), target({ role: "admin" })),
    ).toThrow(ImpersonationNotAllowedError);
  });

  it("nunca en horizontal: admin no puede impersonar a otro admin", () => {
    expect(() =>
      assertCanImpersonate(actor({ roles: ["admin"] }), target({ role: "admin" })),
    ).toThrow(ImpersonationNotAllowedError);
  });

  it("nunca en horizontal: owner no puede impersonar a otro owner", () => {
    expect(() =>
      assertCanImpersonate(actor({ roles: ["owner"] }), target({ role: "owner" })),
    ).toThrow(ImpersonationNotAllowedError);
  });

  it("quien no pertenece en absoluto a la escuela del objetivo no puede impersonar", () => {
    expect(() => assertCanImpersonate(actor({ roles: [] }), target())).toThrow(
      ImpersonationNotAllowedError,
    );
  });

  it("un rol más alto en OTRA escuela no cuenta: solo importan los roles en la escuela del objetivo", () => {
    // roles: [] representa a alguien que es owner en otra escuela, pero sin
    // membresía en la escuela de destino — es la forma en que el manejador
    // traduce «no pertenece a esa escuela».
    expect(() => assertCanImpersonate(actor({ roles: [] }), target({ role: "student" }))).toThrow(
      ImpersonationNotAllowedError,
    );
  });
});

describe("assertCanImpersonate — a uno mismo", () => {
  it("nadie se impersona a sí mismo", () => {
    expect(() =>
      assertCanImpersonate(
        actor({ roles: ["owner"], membershipId: "m-1" }),
        target({ membershipId: "m-1", role: "owner" }),
      ),
    ).toThrow(CannotImpersonateSelfError);
  });

  it("el autochequeo no aplica a soporte de plataforma sin membresía propia", () => {
    expect(() =>
      assertCanImpersonate(
        actor({ kind: "platform_support", membershipId: null }),
        target({ membershipId: "m-1", role: "owner" }),
      ),
    ).not.toThrow();
  });
});

describe("assertCanImpersonate — sin encadenar", () => {
  it("quien ya tiene una impersonación activa no puede abrir otra", () => {
    expect(() =>
      assertCanImpersonate(
        actor({ roles: ["owner"], isCurrentlyImpersonating: true }),
        target(),
      ),
    ).toThrow(ImpersonationAlreadyActiveError);
  });

  it("quien está siendo impersonado ahora mismo no puede iniciar otra impersonación", () => {
    expect(() =>
      assertCanImpersonate(
        actor({ roles: ["owner"], isCurrentlyBeingImpersonated: true }),
        target(),
      ),
    ).toThrow(ImpersonationChainError);
  });

  it("no se puede impersonar a alguien que a su vez está impersonando a un tercero", () => {
    expect(() =>
      assertCanImpersonate(
        actor({ roles: ["owner"] }),
        target({ role: "admin", isCurrentlyImpersonatingSomeoneElse: true }),
      ),
    ).toThrow(ImpersonationChainError);
  });
});
