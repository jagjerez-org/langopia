import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { TenantContext } from "../../../shared/domain/ports/tenant-context.port.js";
import {
  IMPERSONATION_RESTRICTED_KEY,
  PUBLIC_KEY,
  ROLES_KEY,
} from "../../../shared/infrastructure/http/roles.decorator.js";
import { FORBIDDEN_WHILE_IMPERSONATING } from "../../domain/model/impersonation-rules.js";
import {
  AuthenticatedGuard,
  ForbiddenRoleError,
  ImpersonationForbiddenActionError,
  MissingRoleAnnotationError,
  UnknownRestrictedActionError,
} from "./authenticated.guard.js";

/** Reflector falso: cada prueba decide qué metadata "lleva" la ruta. */
function fakeReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

function fakeTenant(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    schoolId: () => "s-1",
    membershipId: () => "m-effective",
    roles: () => ["owner"],
    has: () => true,
    impersonatorMembershipId: () => null,
    impersonationId: () => null,
    ...overrides,
  };
}

const CONTEXT = {
  getHandler: () => ({}) as unknown,
  getClass: () => ({}) as unknown,
} as unknown as ExecutionContext;

describe("AuthenticatedGuard — acciones prohibidas mientras se impersona (paso 4 del brief)", () => {
  it.each(FORBIDDEN_WHILE_IMPERSONATING)(
    "rechaza «%s» cuando la ruta la restringe y hay una impersonación activa",
    (action) => {
      const guard = new AuthenticatedGuard(
        fakeReflector({ [ROLES_KEY]: ["owner"], [IMPERSONATION_RESTRICTED_KEY]: action }),
        fakeTenant({ impersonationId: () => "imp-1", impersonatorMembershipId: () => "m-real" }),
      );
      expect(() => guard.canActivate(CONTEXT)).toThrow(ImpersonationForbiddenActionError);
      try {
        guard.canActivate(CONTEXT);
        expect.unreachable("debería haber rechazado la acción");
      } catch (error) {
        expect((error as ImpersonationForbiddenActionError).code).toBe(
          "impersonation_forbidden_action",
        );
        expect((error as ImpersonationForbiddenActionError).details).toEqual({ action });
      }
    },
  );

  /**
   * Tarea 10 (bug real, ver `authenticated.guard.ts`): soporte de la
   * plataforma puede impersonar SIN tener membresía propia en la escuela de
   * destino — es su caso de uso principal (Tarea 17, `impersonation-
   * rules.ts`: `actor.kind === "platform_support"` no compara rangos). Con
   * `impersonatorMembershipId() === null` en ese caso concreto, comprobar
   * ESE método en vez de `impersonationId()` dejaba pasar las seis
   * categorías prohibidas enteras para exactamente la persona que este
   * mecanismo más necesita frenar. Antes de la corrección, esta prueba
   * fallaba (no se lanzaba `ImpersonationForbiddenActionError`).
   */
  it.each(FORBIDDEN_WHILE_IMPERSONATING)(
    "rechaza «%s» aunque quien impersona no tenga membresía propia (soporte de plataforma)",
    (action) => {
      const guard = new AuthenticatedGuard(
        fakeReflector({ [ROLES_KEY]: ["owner"], [IMPERSONATION_RESTRICTED_KEY]: action }),
        fakeTenant({ impersonationId: () => "imp-1", impersonatorMembershipId: () => null }),
      );
      expect(() => guard.canActivate(CONTEXT)).toThrow(ImpersonationForbiddenActionError);
    },
  );

  it.each(FORBIDDEN_WHILE_IMPERSONATING)(
    "deja pasar «%s» cuando NO hay ninguna impersonación activa",
    (action) => {
      const guard = new AuthenticatedGuard(
        fakeReflector({ [ROLES_KEY]: ["owner"], [IMPERSONATION_RESTRICTED_KEY]: action }),
        fakeTenant({ impersonationId: () => null, impersonatorMembershipId: () => null }),
      );
      expect(guard.canActivate(CONTEXT)).toBe(true);
    },
  );

  it("una ruta sin restricción se deja pasar aunque se esté impersonando", () => {
    const guard = new AuthenticatedGuard(
      fakeReflector({ [ROLES_KEY]: ["owner"] }),
      fakeTenant({ impersonationId: () => "imp-1", impersonatorMembershipId: () => "m-real" }),
    );
    expect(guard.canActivate(CONTEXT)).toBe(true);
  });

  it("un rol insuficiente se rechaza ANTES de mirar la impersonación, y con su propio error", () => {
    const guard = new AuthenticatedGuard(
      fakeReflector({
        [ROLES_KEY]: ["owner", "admin"],
        [IMPERSONATION_RESTRICTED_KEY]: "payment_operation",
      }),
      fakeTenant({
        roles: () => ["teacher"],
        impersonationId: () => "imp-1",
        impersonatorMembershipId: () => "m-real",
      }),
    );
    expect(() => guard.canActivate(CONTEXT)).toThrow(ForbiddenRoleError);
  });

  it("una ruta pública se deja pasar sin comprobar tenant, rol ni impersonación", () => {
    const guard = new AuthenticatedGuard(
      fakeReflector({ [PUBLIC_KEY]: true }),
      fakeTenant({
        schoolId: () => {
          throw new Error("no debería llamarse: la ruta es pública");
        },
      }),
    );
    expect(guard.canActivate(CONTEXT)).toBe(true);
  });
});

/**
 * Saneamiento de cierre de la ola 1.
 *
 * El guardia SALTABA la comprobación de rol cuando el manejador no llevaba
 * `@Roles`, que es la regla vinculante del proyecto («toda ruta necesita
 * anotación de roles: el fallo por defecto es denegar») escrita del revés:
 * un endpoint nuevo sin anotar nacía abierto a cualquier miembro de la
 * escuela, `student` y `guardian` incluidos. Antes de la corrección, las dos
 * primeras pruebas de este bloque devolvían `true` en vez de lanzar.
 */
describe("AuthenticatedGuard — el fallo por defecto es denegar", () => {
  it("deniega una ruta que no declara ni @Roles ni @Public", () => {
    const guard = new AuthenticatedGuard(fakeReflector({}), fakeTenant());
    expect(() => guard.canActivate(CONTEXT)).toThrow(MissingRoleAnnotationError);
  });

  it("deniega también una ruta con @Roles() vacío", () => {
    // `@Roles()` sin argumentos es tan «sin declarar» como no ponerlo: deja
    // una lista vacía, con la que ningún rol puede coincidir nunca.
    const guard = new AuthenticatedGuard(fakeReflector({ [ROLES_KEY]: [] }), fakeTenant());
    expect(() => guard.canActivate(CONTEXT)).toThrow(MissingRoleAnnotationError);
  });

  it("la denegación por falta de anotación no promete que otro rol sirva", () => {
    const guard = new AuthenticatedGuard(fakeReflector({}), fakeTenant());
    try {
      guard.canActivate(CONTEXT);
      expect.unreachable("debería haber denegado la ruta sin anotar");
    } catch (error) {
      expect((error as MissingRoleAnnotationError).code).toBe("route_not_annotated");
      expect((error as MissingRoleAnnotationError).details).toEqual({});
    }
  });

  it("una ruta anotada con el rol que se tiene sigue pasando", () => {
    const guard = new AuthenticatedGuard(
      fakeReflector({ [ROLES_KEY]: ["owner", "admin"] }),
      fakeTenant({ roles: () => ["admin"] }),
    );
    expect(guard.canActivate(CONTEXT)).toBe(true);
  });

  it("el tenant se sigue exigiendo antes que la anotación", () => {
    // El orden importa: sin sesión, el error correcto es `missing_tenant`, no
    // «esta ruta no declara nada» — que hablaría de un fallo del servidor
    // cuando lo que falta es la sesión de quien llama.
    const guard = new AuthenticatedGuard(
      fakeReflector({}),
      fakeTenant({
        schoolId: () => {
          throw new Error("missing_tenant");
        },
      }),
    );
    expect(() => guard.canActivate(CONTEXT)).toThrow("missing_tenant");
  });
});

/**
 * Saneamiento de cierre de la ola 1, menor 3.
 *
 * `RestrictedWhileImpersonating(action: string)` aceptaba cualquier cadena
 * aunque su comentario prometiera un conjunto cerrado. Los cuatro
 * controladores que la usan escriben la cadena a mano, así que una errata
 * (`"paymnet_operation"`) anotaba la ruta con un valor que el guardia no
 * reconoce: la restricción se desactivaba en silencio, y el 403 que debía
 * cortar una operación de pago durante una impersonación no llegaba nunca.
 * El tipo del decorador ya lo impide al compilar; esto es la otra mitad,
 * para lo que llegue por un `as`. Antes de la corrección, la primera prueba
 * devolvía `true`.
 */
describe("AuthenticatedGuard — la acción restringida es de un conjunto cerrado", () => {
  it("deniega una ruta anotada con una acción que no existe", () => {
    const guard = new AuthenticatedGuard(
      fakeReflector({
        [ROLES_KEY]: ["owner"],
        [IMPERSONATION_RESTRICTED_KEY]: "paymnet_operation",
      }),
      fakeTenant({ impersonationId: () => "imp-1" }),
    );
    expect(() => guard.canActivate(CONTEXT)).toThrow(UnknownRestrictedActionError);
  });

  it("la deniega también sin impersonación activa: la ruta está mal anotada", () => {
    // Si solo se comprobara al impersonar, la errata seguiría viva y solo se
    // vería el día que alguien impersonase — que es justo el día en que la
    // restricción tenía que funcionar.
    const guard = new AuthenticatedGuard(
      fakeReflector({
        [ROLES_KEY]: ["owner"],
        [IMPERSONATION_RESTRICTED_KEY]: "borrar_toda_la_escuela",
      }),
      fakeTenant({ impersonationId: () => null }),
    );
    expect(() => guard.canActivate(CONTEXT)).toThrow(UnknownRestrictedActionError);
  });

  it("los seis valores de la lista se aceptan tal cual", () => {
    for (const action of FORBIDDEN_WHILE_IMPERSONATING) {
      const guard = new AuthenticatedGuard(
        fakeReflector({ [ROLES_KEY]: ["owner"], [IMPERSONATION_RESTRICTED_KEY]: action }),
        fakeTenant({ impersonationId: () => null }),
      );
      expect(guard.canActivate(CONTEXT)).toBe(true);
    }
  });
});
