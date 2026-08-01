import type { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../contexts/shared/domain/ports/audit-log.port.js";
import type { UnitOfWork } from "../../../contexts/shared/domain/ports/unit-of-work.port.js";
import {
  CLS_MEMBERSHIP_ID,
  CLS_ROLES,
  CLS_SCHOOL_ID,
} from "../../../contexts/shared/infrastructure/tenant/cls-tenant-context.js";
import { GenerateUnitCommand } from "../../../contexts/learning/application/commands/generate-unit/generate-unit.command.js";
import { ListStudentsQuery } from "../../../contexts/people/application/queries/list-students/list-students.handler.js";
import { GetStudentsAtRiskQuery } from "../../../contexts/feedback/application/queries/get-students-at-risk/get-students-at-risk.handler.js";
import { GetWeeklyAgendaQuery } from "../../../contexts/scheduling/application/queries/get-weekly-agenda/get-weekly-agenda.handler.js";
import { CancelClassSessionCommand } from "../../../contexts/scheduling/application/commands/cancel-class-session/cancel-class-session.command.js";
import { McpToolsService, type VerifiedMcpAuthorization } from "./mcp-tools.service.js";

const authorization: VerifiedMcpAuthorization = {
  authorizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  schoolId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  mcpClientId: "33333333-3333-4333-8333-333333333333",
  roles: ["owner"],
  scopes: ["students:read", "analytics:read", "sessions:read", "sessions:write", "content:write"],
};

function buildService(options: { commandResult?: unknown; queryResult?: unknown } = {}) {
  const executedCommands: unknown[] = [];
  const executedQueries: unknown[] = [];
  const auditEntries: AuditLogEntry[] = [];
  const clsValues = new Map<string, unknown>();

  const cls = {
    get: (key?: string) => (key ? clsValues.get(key) : Object.fromEntries(clsValues)),
    runWith: async (values: Record<string, unknown>, work: () => Promise<unknown>) => {
      for (const [key, value] of Object.entries(values)) clsValues.set(key, value);
      return work();
    },
  } as unknown as ClsService;

  const uow = {
    execute: async (work: () => Promise<unknown>) => work(),
    read: async (work: () => Promise<unknown>) => work(),
  } as UnitOfWork;

  const commands = {
    execute: vi.fn(async (command: unknown) => {
      executedCommands.push(command);
      return options.commandResult ?? { ok: true };
    }),
  } as unknown as CommandBus;

  const queries = {
    execute: vi.fn(async (query: unknown) => {
      executedQueries.push(query);
      return options.queryResult ?? [{ ok: true }];
    }),
  } as unknown as QueryBus;

  const auditLog: AuditLogPort = {
    record: async (entry) => {
      auditEntries.push(entry);
    },
  };

  return {
    service: new McpToolsService(commands, queries, cls, uow, auditLog),
    executedCommands,
    executedQueries,
    auditEntries,
    clsValues,
  };
}

describe("McpToolsService", () => {
  it("devuelve 403 si la autorización MCP no tiene el scope requerido", async () => {
    const { service, executedQueries, auditEntries } = buildService();

    await expect(
      service.call("resumen_facturacion", {}, { ...authorization, scopes: ["students:read"] }),
    ).rejects.toMatchObject({ code: "mcp_scope_forbidden", kind: "forbidden" });

    expect(executedQueries).toEqual([]);
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorKind: "mcp",
        mcpClientId: authorization.mcpClientId,
        actorMembershipId: authorization.membershipId,
        action: "mcp.tool.denied",
        entityType: "mcp_tool",
        after: expect.objectContaining({
          authorizationId: authorization.authorizationId,
          requiredScope: "billing:read",
          tool: "resumen_facturacion",
        }),
      }),
    ]);
  });

  it("devuelve 403 si el scope existe pero el rol no puede usar la herramienta", async () => {
    const { service, executedQueries, auditEntries } = buildService();

    await expect(
      service.call("resumen_facturacion", {}, { ...authorization, roles: ["student"], scopes: ["billing:read"] }),
    ).rejects.toMatchObject({ code: "mcp_role_forbidden", kind: "forbidden" });

    expect(executedQueries).toEqual([]);
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorKind: "mcp",
        mcpClientId: authorization.mcpClientId,
        actorMembershipId: authorization.membershipId,
        action: "mcp.tool.denied",
        entityType: "mcp_tool",
        after: expect.objectContaining({
          authorizationId: authorization.authorizationId,
          requiredRoles: ["owner", "admin"],
          tool: "resumen_facturacion",
        }),
      }),
    ]);
  });

  it("fija el tenant desde el token MCP y no desde los argumentos de la herramienta", async () => {
    const { service, executedQueries, clsValues, auditEntries } = buildService();

    await service.call(
      "buscar_alumnos",
      { schoolId: "99999999-9999-4999-8999-999999999999" },
      authorization,
    );

    expect(clsValues.get(CLS_SCHOOL_ID)).toBe(authorization.schoolId);
    expect(clsValues.get(CLS_MEMBERSHIP_ID)).toBe(authorization.membershipId);
    expect(clsValues.get(CLS_ROLES)).toEqual(authorization.roles);
    expect(executedQueries).toEqual([new ListStudentsQuery()]);
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorKind: "mcp",
        mcpClientId: authorization.mcpClientId,
        actorMembershipId: authorization.membershipId,
        action: "mcp.tool.executed",
        entityType: "mcp_tool",
        after: expect.objectContaining({
          authorizationId: authorization.authorizationId,
          scope: "students:read",
          tool: "buscar_alumnos",
        }),
      }),
    ]);
  });

  it("llama las queries existentes para lectura", async () => {
    const { service, executedQueries } = buildService();

    await service.call("alumnos_en_riesgo", {}, authorization);
    await service.call(
      "agenda_semanal",
      {
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-08T00:00:00.000Z",
        teacherId: "44444444-4444-4444-8444-444444444444",
      },
      authorization,
    );

    expect(executedQueries).toEqual([
      new GetStudentsAtRiskQuery(),
      new GetWeeklyAgendaQuery({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-08T00:00:00.000Z",
        teacherId: "44444444-4444-4444-8444-444444444444",
      }),
    ]);
  });

  it("exige confirmed=true en herramientas de escritura antes de ejecutar comandos", async () => {
    const { service, executedCommands } = buildService();

    await expect(
      service.call(
        "cancelar_clase",
        {
          sessionId: "55555555-5555-4555-8555-555555555555",
          party: "school",
          reason: "Petición desde MCP",
        },
        authorization,
      ),
    ).rejects.toMatchObject({ code: "mcp_confirmation_required" });

    expect(executedCommands).toEqual([]);
  });

  it("llama comandos existentes cuando la escritura llega confirmada", async () => {
    const { service, executedCommands } = buildService();

    await service.call(
      "cancelar_clase",
      {
        sessionId: "55555555-5555-4555-8555-555555555555",
        party: "school",
        reason: "Petición desde MCP",
        confirmed: true,
      },
      authorization,
    );
    await service.call(
      "generar_unidad",
      {
        code: "ES-B1-MCP",
        language: "es",
        level: "B1",
        topic: "La ciudad",
        skills: ["reading"],
        primaryLocale: "es",
        exerciseTypes: ["reading_comprehension"],
        confirmed: true,
      },
      authorization,
    );

    expect(executedCommands).toEqual([
      new CancelClassSessionCommand({
        sessionId: "55555555-5555-4555-8555-555555555555",
        party: "school",
        reason: "Petición desde MCP",
      }),
      new GenerateUnitCommand({
        code: "ES-B1-MCP",
        language: "es",
        level: "B1",
        topic: "La ciudad",
        skills: ["reading"],
        primaryLocale: "es",
        exerciseTypes: ["reading_comprehension"],
      }),
    ]);
  });
});
