import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { ClsService } from "nestjs-cls";
import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it } from "vitest";
import {
  CLS_IMPERSONATION_ID,
  CLS_MEMBERSHIP_ID,
  CLS_SCHOOL_ID,
} from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import type { ImpersonationDirectoryPort } from "../../domain/ports/impersonation-directory.port.js";
import type { MembershipLookupPort } from "../../domain/ports/membership-lookup.port.js";
import type { Auth } from "../auth/better-auth.config.js";
import {
  groupBySchool,
  resolveTenant,
  SchoolNotOperationalError,
  SessionTenantGuard,
  subdomainFrom,
  type MembershipRow,
} from "./session-tenant.guard.js";

const enAtlantico: MembershipRow = {
  membershipId: "m-atl",
  schoolId: "s-atl",
  schoolSlug: "atlantico",
  schoolStatus: "active",
  role: "owner",
};
const enPaulista: MembershipRow = {
  membershipId: "m-pau",
  schoolId: "s-pau",
  schoolSlug: "paulista",
  schoolStatus: "active",
  role: "teacher",
};

describe("resolveTenant", () => {
  it("con una sola membresía, la elige sin preguntar", () => {
    expect(resolveTenant([enAtlantico], undefined)).toMatchObject({
      schoolId: "s-atl",
      membershipId: "m-atl",
      roles: ["owner"],
    });
  });

  it("con varias membresías, usa el subdominio pedido", () => {
    expect(resolveTenant([enAtlantico, enPaulista], "paulista")).toMatchObject({
      schoolId: "s-pau",
      roles: ["teacher"],
    });
  });

  it("rechaza un subdominio en el que la persona no tiene membresía", () => {
    expect(() => resolveTenant([enAtlantico], "paulista")).toThrow(/no perteneces/i);
  });

  it("rechaza no elegir cuando hay varias", () => {
    expect(() => resolveTenant([enAtlantico, enPaulista], undefined)).toThrow(/indica la escuela/i);
  });

  it("rechaza a quien no tiene ninguna membresía", () => {
    expect(() => resolveTenant([], undefined)).toThrow(/ninguna escuela/i);
  });
});

/* ─── I7: dos roles en la misma escuela ────────────────────────────────── */

describe("varios roles en la misma escuela", () => {
  // El índice único de `memberships` es (school_id, user_id, role): el dueño
  // que además da clase tiene DOS filas en la misma escuela.
  const dueño: MembershipRow = { ...enAtlantico, membershipId: "m-2", role: "owner" };
  const profesor: MembershipRow = { ...enAtlantico, membershipId: "m-1", role: "teacher" };

  it("no las confunde con varias escuelas", () => {
    expect(() => resolveTenant([dueño, profesor], undefined)).not.toThrow();
  });

  it("acumula los roles de la escuela elegida", () => {
    expect(resolveTenant([dueño, profesor], undefined).roles).toEqual(["owner", "teacher"]);
  });

  it("elige la misma membresía sea cual sea el orden de las filas", () => {
    const unOrden = resolveTenant([dueño, profesor], undefined).membershipId;
    const otroOrden = resolveTenant([profesor, dueño], undefined).membershipId;
    expect(unOrden).toBe(otroOrden);
    expect(unOrden).toBe("m-1");
  });

  it("al pedir varias escuelas no repite el mismo slug", () => {
    try {
      resolveTenant([dueño, profesor, enPaulista], undefined);
      expect.unreachable("debería haber pedido que se elija escuela");
    } catch (error) {
      expect((error as { details: { schools: string[] } }).details.schools).toEqual([
        "atlantico",
        "paulista",
      ]);
    }
  });

  it("agrupa por escuela y ordena por slug", () => {
    expect(groupBySchool([enPaulista, dueño, profesor]).map((m) => m.schoolSlug)).toEqual([
      "atlantico",
      "paulista",
    ]);
  });
});

/* ─── I4: estado de la escuela ─────────────────────────────────────────── */

describe("estado de la escuela", () => {
  const cancelada: MembershipRow = { ...enAtlantico, schoolStatus: "canceled" };
  const impagada: MembershipRow = { ...enPaulista, schoolStatus: "past_due" };
  const enPrueba: MembershipRow = { ...enAtlantico, schoolStatus: "trial" };

  it("no deja entrar en una escuela cancelada, ni a su dueño", () => {
    expect(() => resolveTenant([cancelada], undefined)).toThrow(/cancelada/i);
  });

  it("tampoco al pedirla explícitamente por su slug", () => {
    expect(() => resolveTenant([cancelada], "atlantico")).toThrow(/cancelada/i);
  });

  it("deja entrar con la suscripción impagada: el corte es comercial, no técnico", () => {
    expect(resolveTenant([impagada], undefined).schoolId).toBe("s-pau");
  });

  it("deja entrar en periodo de prueba", () => {
    expect(resolveTenant([enPrueba], undefined).schoolId).toBe("s-atl");
  });

  it("ignora la cancelada al elegir sola cuando queda otra usable", () => {
    expect(resolveTenant([cancelada, enPaulista], undefined).schoolId).toBe("s-pau");
  });
});

/* ─── Menor 9: el slug pedido no se refleja sin validar ────────────────── */

describe("validación del slug pedido", () => {
  const veneno = '<script>alert(1)</script>\n[WARN] falso "log"';

  it("rechaza un slug con caracteres que no son de un slug", () => {
    expect(() => resolveTenant([enAtlantico], veneno)).toThrow(/formato válido/i);
  });

  it("no devuelve el valor recibido en los detalles del error", () => {
    try {
      resolveTenant([enAtlantico], veneno);
      expect.unreachable("debería haber rechazado el slug");
    } catch (error) {
      const detalles = JSON.stringify((error as { details: unknown }).details);
      expect(detalles).not.toContain("script");
      expect((error as Error).message).not.toContain("script");
    }
  });

  it("rechaza un slug desmesurado sin buscarlo", () => {
    expect(() => resolveTenant([enAtlantico], "a".repeat(300))).toThrow(/formato válido/i);
  });

  it("sigue aceptando un slug legítimo con guiones", () => {
    const conGuion: MembershipRow = { ...enAtlantico, schoolSlug: "atlantico-sur" };
    expect(resolveTenant([conGuion], "atlantico-sur").schoolSlug).toBe("atlantico-sur");
  });
});

/* ─── I5: el subdominio solo se lee en los dominios conocidos ──────────── */

describe("subdomainFrom", () => {
  const bases = ["langopia.app", "localhost"];

  it("reconoce la escuela en un dominio propio", () => {
    expect(subdomainFrom("atlantico.langopia.app", bases)).toBe("atlantico");
  });

  it("reconoce la escuela en desarrollo, con puerto", () => {
    expect(subdomainFrom("atlantico.localhost:3000", bases)).toBe("atlantico");
  });

  it("no inventa escuela en el dominio de un PaaS", () => {
    expect(subdomainFrom("langopia-api-production.up.railway.app", bases)).toBeUndefined();
  });

  it("no inventa escuela a partir de una IP", () => {
    expect(subdomainFrom("10.0.1.5", bases)).toBeUndefined();
  });

  it("no inventa escuela en un dominio prestado cualquiera", () => {
    expect(subdomainFrom("api.midominio.com", bases)).toBeUndefined();
  });

  it("ignora el dominio base pelado", () => {
    expect(subdomainFrom("langopia.app", bases)).toBeUndefined();
    expect(subdomainFrom("localhost:3000", bases)).toBeUndefined();
  });

  it("ignora las etiquetas reservadas", () => {
    expect(subdomainFrom("www.langopia.app", bases)).toBeUndefined();
    expect(subdomainFrom("api.langopia.app", bases)).toBeUndefined();
  });

  it("no acepta más de un nivel por delante", () => {
    expect(subdomainFrom("a.atlantico.langopia.app", bases)).toBeUndefined();
  });

  it("no confunde un dominio que solo TERMINA parecido", () => {
    expect(subdomainFrom("atlantico.nolangopia.app", bases)).toBeUndefined();
  });

  it("sin host no hay subdominio", () => {
    expect(subdomainFrom(undefined, bases)).toBeUndefined();
  });
});

/* ─── Saneamiento de cierre de la ola 1: impersonar no salta el estado ──── */

/**
 * La impersonación resuelve su tenant por otro camino que `resolveTenant`
 * —`activeAsImpersonator`, porque quien impersona puede no tener membresía
 * en ninguna escuela—, y ese camino no miraba el estado de la escuela de
 * destino. Resultado: se entraba en una escuela `canceled`, en la que su
 * propio dueño ya no puede entrar, saltándose
 * `SCHOOL_STATUSES_THAT_ALLOW_ACCESS`. Antes de la corrección, la primera
 * prueba de este bloque devolvía `true` y dejaba el tenant fijado.
 */
describe("SessionTenantGuard — la impersonación respeta el estado de la escuela", () => {
  const impersonacion = (schoolStatus: string) => ({
    impersonationId: "imp-1",
    schoolId: "s-atl",
    targetMembershipId: "m-atl",
    targetRole: "owner",
    targetSchoolLocale: "es-ES",
    targetSchoolSlug: "atlantico",
    targetSchoolStatus: schoolStatus,
    impersonatorMembershipId: null,
    reason: "ticket 4711: no le carga el calendario",
    involvesMinor: false,
    expiresAt: new Date("2099-01-01T00:00:00Z"),
  });

  function construir(schoolStatus: string) {
    const store = new Map<string, unknown>();
    const cls = {
      set: (key: string, value: unknown) => store.set(key, value),
      get: (key: string) => store.get(key),
    } as unknown as ClsService;

    const guard = new SessionTenantGuard(
      cls,
      { getAllAndOverride: () => undefined } as unknown as Reflector,
      { get: () => undefined } as unknown as ConfigService,
      { activeFor: async () => [] } as unknown as MembershipLookupPort,
      {
        isPlatformSupport: async () => true,
        schoolIdForMembership: async () => "s-atl",
        activeAsImpersonator: async () => impersonacion(schoolStatus),
        isBeingImpersonated: async () => false,
      } as unknown as ImpersonationDirectoryPort,
      {
        api: {
          getSession: async () => ({ user: { id: "auth-soporte", emailVerified: true } }),
        },
      } as unknown as Auth,
      { debug: () => undefined, warn: () => undefined } as unknown as PinoLogger,
    );

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ path: "/api/v1/dashboard/summary", headers: {}, get: () => undefined }),
        getResponse: () => ({ setHeader: () => undefined }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { guard, context, store };
  }

  it("no deja impersonar dentro de una escuela cancelada", async () => {
    const { guard, context, store } = construir("canceled");
    await expect(guard.canActivate(context)).rejects.toThrow(SchoolNotOperationalError);
    // Y no se queda medio fijado: se comprueba antes de tocar el CLS.
    expect(store.get(CLS_SCHOOL_ID)).toBeUndefined();
  });

  it("sí deja impersonar en una escuela con la suscripción impagada", async () => {
    const { guard, context, store } = construir("past_due");
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(store.get(CLS_SCHOOL_ID)).toBe("s-atl");
    expect(store.get(CLS_MEMBERSHIP_ID)).toBe("m-atl");
  });

  it("sí deja impersonar en una escuela activa", async () => {
    const { guard, context, store } = construir("active");
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(store.get(CLS_IMPERSONATION_ID)).toBe("imp-1");
  });
});
