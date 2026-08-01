import { describe, expect, it } from "vitest";
import type { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { TenantContext } from "../../../shared/domain/ports/tenant-context.port.js";
import type { ActiveImpersonationView } from "../../application/queries/get-active-impersonation/get-active-impersonation.handler.js";
import type { Auth } from "../auth/better-auth.config.js";
import { ImpersonationController } from "./impersonation.controller.js";

/**
 * Regresión del fallo conocido: `GET /iam/impersonation` respondía 200 con
 * el cuerpo VACÍO cuando no había impersonación activa, porque la consulta
 * devuelve `null` y Nest serializa `null` como «sin cuerpo». El cliente del
 * panel llamaba a `response.json()`, fallaba y registraba «respuesta sin
 * JSON válido» en cada sondeo del aviso permanente (paso 10 del brief).
 *
 * El contrato queda así: la ruta responde SIEMPRE un objeto JSON,
 * `{ active: … | null }` — nunca un `null` pelado.
 */
describe("ImpersonationController.current — siempre un cuerpo JSON válido", () => {
  function construir(resultadoConsulta: ActiveImpersonationView | null) {
    const queries = { execute: async () => resultadoConsulta } as unknown as QueryBus;
    const controller = new ImpersonationController(
      { execute: async () => ({}) } as unknown as CommandBus,
      queries,
      {} as TenantContext,
      {} as Auth,
    );
    return controller;
  }

  it("sin impersonación activa responde { active: null }, no un cuerpo vacío", async () => {
    const controller = construir(null);
    await expect(controller.current()).resolves.toEqual({ active: null });
  });

  it("con impersonación activa responde { active: … } con la vista completa", async () => {
    const view: ActiveImpersonationView = {
      impersonationId: "imp-1",
      targetMembershipId: "m-1",
      targetName: "Ana Alumna",
      impersonatorName: "Sara Soporte",
      impersonatorEmail: "sara@langopia.app",
      reason: "ticket 4711: no le carga el calendario",
      involvesMinor: false,
      startedAt: "2026-07-27T10:00:00.000Z",
      expiresAt: "2026-07-27T10:30:00.000Z",
    };
    const controller = construir(view);
    await expect(controller.current()).resolves.toEqual({ active: view });
  });
});
