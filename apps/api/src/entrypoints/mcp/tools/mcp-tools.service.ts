import { Inject, Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";
import { z } from "zod";
import { DomainError } from "../../../contexts/shared/domain/errors/domain-error.js";
import { AUDIT_LOG, type AuditLogPort } from "../../../contexts/shared/domain/ports/audit-log.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../contexts/shared/domain/ports/unit-of-work.port.js";
import {
  CLS_MEMBERSHIP_ID,
  CLS_ROLES,
  CLS_SCHOOL_ID,
} from "../../../contexts/shared/infrastructure/tenant/cls-tenant-context.js";
import { GetBillingSummaryQuery } from "../../../contexts/billing/application/queries/get-billing-summary/get-billing-summary.handler.js";
import { GetStudentsAtRiskQuery } from "../../../contexts/feedback/application/queries/get-students-at-risk/get-students-at-risk.handler.js";
import { GenerateUnitCommand } from "../../../contexts/learning/application/commands/generate-unit/generate-unit.command.js";
import { ListStudentsQuery } from "../../../contexts/people/application/queries/list-students/list-students.handler.js";
import { CancelClassSessionCommand } from "../../../contexts/scheduling/application/commands/cancel-class-session/cancel-class-session.command.js";
import { ScheduleClassSessionCommand } from "../../../contexts/scheduling/application/commands/schedule-class-session/schedule-class-session.command.js";
import { GetTeacherOccupancyQuery } from "../../../contexts/scheduling/application/queries/get-teacher-occupancy/get-teacher-occupancy.handler.js";
import { GetWeeklyAgendaQuery } from "../../../contexts/scheduling/application/queries/get-weekly-agenda/get-weekly-agenda.handler.js";

type McpToolScope =
  | "students:read"
  | "sessions:read"
  | "sessions:write"
  | "content:write"
  | "analytics:read"
  | "billing:read";

export type VerifiedMcpAuthorization = {
  authorizationId: string;
  schoolId: string;
  membershipId: string;
  mcpClientId: string;
  roles: string[];
  scopes: string[];
};

type JsonSchema = Record<string, unknown>;

export type McpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

type McpContent = { type: "text"; text: string };

export type McpToolResult = {
  content: McpContent[];
  structuredContent: unknown;
};

type ToolDefinition<TArgs extends object> = McpToolDescriptor & {
  scope: McpToolScope;
  roles: readonly string[];
  schema: z.ZodType<TArgs>;
  mutating: boolean;
  execute: (args: TArgs) => Promise<unknown>;
};

type AnyToolDefinition = McpToolDescriptor & {
  scope: McpToolScope;
  roles: readonly string[];
  schema: z.ZodType<unknown>;
  mutating: boolean;
  execute: (args: unknown) => Promise<unknown>;
};

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });
const confirmed = z.object({ confirmed: z.literal(true) });

const emptySchema = z.object({});
const dateRangeSchema = z.object({ from: isoDate, to: isoDate });
const agendaSchema = dateRangeSchema.extend({
  teacherId: uuid.optional(),
  groupId: uuid.optional(),
});
const occupancySchema = dateRangeSchema;
const cancelSchema = confirmed.extend({
  sessionId: uuid,
  party: z.enum(["school", "student"]),
  reason: z.string().min(3),
});
const scheduleSchema = confirmed.extend({
  groupId: uuid,
  teacherId: uuid.nullish(),
  startsAt: isoDate,
  durationMinutes: z.number().int().min(15).max(240),
  roomProvider: z.string().min(1),
  roomUrl: z.string().min(1).nullish(),
  roomExternalId: z.string().min(1).nullish(),
  topic: z.string().min(1).nullish(),
  contentUnitId: uuid.nullish(),
  overrideAvailability: z.boolean().optional(),
});
const generateUnitSchema = confirmed.extend({
  code: z.string().min(1),
  language: z.string().min(1),
  level: z.string().min(1),
  topic: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  primaryLocale: z.string().min(1),
  exerciseTypes: z.array(z.string().min(1)).min(1),
  sourceMaterial: z.string().min(1).optional(),
});

export class McpUnknownToolError extends DomainError {
  readonly code = "mcp_unknown_tool";
  readonly kind = "not_found" as const;
  constructor(tool: string) {
    super(`La herramienta MCP «${tool}» no existe.`, { tool });
  }
}

export class McpScopeForbiddenError extends DomainError {
  readonly code = "mcp_scope_forbidden";
  readonly kind = "forbidden" as const;
  constructor(tool: string, requiredScope: string) {
    super(`La herramienta MCP «${tool}» requiere el ámbito ${requiredScope}.`, {
      tool,
      requiredScope,
    });
  }
}

export class McpRoleForbiddenError extends DomainError {
  readonly code = "mcp_role_forbidden";
  readonly kind = "forbidden" as const;
  constructor(tool: string, requiredRoles: readonly string[]) {
    super(`La herramienta MCP «${tool}» requiere uno de estos roles: ${requiredRoles.join(", ")}.`, {
      tool,
      requiredRoles: [...requiredRoles],
    });
  }
}

export class McpInvalidArgumentsError extends DomainError {
  readonly code = "mcp_invalid_arguments";
  readonly kind = "invalid_input" as const;
  constructor(tool: string, reason: string) {
    super(`Los argumentos de «${tool}» no son válidos: ${reason}.`, { tool, reason });
  }
}

export class McpConfirmationRequiredError extends DomainError {
  readonly code = "mcp_confirmation_required";
  readonly kind = "forbidden" as const;
  constructor(tool: string) {
    super(`La herramienta MCP «${tool}» requiere confirmed=true antes de ejecutar.`, {
      tool,
    });
  }
}

@Injectable()
export class McpToolsService {
  private readonly tools: Map<string, AnyToolDefinition>;

  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly cls: ClsService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
  ) {
    this.tools = new Map(this.buildTools().map((tool) => [tool.name, tool]));
  }

  list(): McpToolDescriptor[] {
    return [...this.tools.values()].map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  async call(
    toolName: string,
    args: unknown,
    authorization: VerifiedMcpAuthorization,
  ): Promise<McpToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) throw new McpUnknownToolError(toolName);

    return this.cls.runWith(
      {
        ...this.cls.get(),
        [CLS_SCHOOL_ID]: authorization.schoolId,
        [CLS_MEMBERSHIP_ID]: authorization.membershipId,
        [CLS_ROLES]: authorization.roles,
      },
      () =>
        this.uow.execute(async () => {
          if (!authorization.scopes.includes(tool.scope)) {
            await this.audit(tool, authorization, "denied", { requiredScope: tool.scope });
            throw new McpScopeForbiddenError(tool.name, tool.scope);
          }
          if (!tool.roles.some((role) => authorization.roles.includes(role))) {
            await this.audit(tool, authorization, "denied", { requiredRoles: tool.roles });
            throw new McpRoleForbiddenError(tool.name, tool.roles);
          }

          const parsed = tool.schema.safeParse(args ?? {});
          if (!parsed.success) {
            const missingConfirmation = tool.mutating && (args as { confirmed?: unknown } | null)?.confirmed !== true;
            await this.audit(tool, authorization, "denied", {
              reason: missingConfirmation ? "confirmation_required" : "invalid_arguments",
            });
            if (missingConfirmation) throw new McpConfirmationRequiredError(tool.name);
            throw new McpInvalidArgumentsError(tool.name, parsed.error.issues.map((i) => i.message).join("; "));
          }

          const result = await tool.execute(parsed.data);
          await this.audit(tool, authorization, "executed");
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          };
        }),
    ) as Promise<McpToolResult>;
  }

  private async audit(
    tool: AnyToolDefinition,
    authorization: VerifiedMcpAuthorization,
    outcome: "executed" | "denied",
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.auditLog.record({
      schoolId: authorization.schoolId,
      actorKind: "mcp",
      actorMembershipId: authorization.membershipId,
      mcpClientId: authorization.mcpClientId,
      action: outcome === "executed" ? "mcp.tool.executed" : "mcp.tool.denied",
      entityType: "mcp_tool",
      after: {
        tool: tool.name,
        scope: tool.scope,
        authorizationId: authorization.authorizationId,
        ...details,
      },
    });
  }

  private buildTools(): AnyToolDefinition[] {
    return [
      tool({
        name: "buscar_alumnos",
        description: "Lista los alumnos visibles de la escuela activa del token MCP.",
        scope: "students:read",
        roles: ["owner", "admin", "teacher"],
        mutating: false,
        schema: emptySchema,
        inputSchema: objectSchema({}),
        execute: () => this.queries.execute(new ListStudentsQuery()),
      }),
      tool({
        name: "alumnos_en_riesgo",
        description: "Devuelve alumnos con riesgo de baja y motivos accionables.",
        scope: "analytics:read",
        roles: ["owner", "admin"],
        mutating: false,
        schema: emptySchema,
        inputSchema: objectSchema({}),
        execute: () => this.queries.execute(new GetStudentsAtRiskQuery()),
      }),
      tool({
        name: "agenda_semanal",
        description: "Consulta la agenda entre dos fechas ISO de la escuela activa.",
        scope: "sessions:read",
        roles: ["owner", "admin", "teacher"],
        mutating: false,
        schema: agendaSchema,
        inputSchema: objectSchema({
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
          teacherId: { type: "string", format: "uuid" },
          groupId: { type: "string", format: "uuid" },
        }, ["from", "to"]),
        execute: (args) => this.queries.execute(new GetWeeklyAgendaQuery(args)),
      }),
      tool({
        name: "ocupacion_profesorado",
        description: "Calcula ocupación docente entre dos fechas ISO.",
        scope: "analytics:read",
        roles: ["owner", "admin"],
        mutating: false,
        schema: occupancySchema,
        inputSchema: objectSchema({
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
        }, ["from", "to"]),
        execute: (args) => this.queries.execute(new GetTeacherOccupancyQuery(args)),
      }),
      tool({
        name: "cancelar_clase",
        description:
          "Cancela una clase. Requiere confirmación explícita: solo ejecuta si confirmed=true.",
        scope: "sessions:write",
        roles: ["owner", "admin"],
        mutating: true,
        schema: cancelSchema,
        inputSchema: objectSchema({
          sessionId: { type: "string", format: "uuid" },
          party: { type: "string", enum: ["school", "student"] },
          reason: { type: "string", minLength: 3 },
          confirmed: { type: "boolean", const: true },
        }, ["sessionId", "party", "reason", "confirmed"]),
        execute: (args) =>
          this.commands.execute(
            new CancelClassSessionCommand({
              sessionId: args.sessionId,
              party: args.party,
              reason: args.reason,
            }),
          ),
      }),
      tool({
        name: "programar_clase",
        description:
          "Programa una clase. Requiere confirmación explícita: solo ejecuta si confirmed=true.",
        scope: "sessions:write",
        roles: ["owner", "admin"],
        mutating: true,
        schema: scheduleSchema,
        inputSchema: objectSchema({
          groupId: { type: "string", format: "uuid" },
          teacherId: { type: ["string", "null"], format: "uuid" },
          startsAt: { type: "string", format: "date-time" },
          durationMinutes: { type: "integer", minimum: 15, maximum: 240 },
          roomProvider: { type: "string" },
          roomUrl: { type: ["string", "null"] },
          roomExternalId: { type: ["string", "null"] },
          topic: { type: ["string", "null"] },
          contentUnitId: { type: ["string", "null"], format: "uuid" },
          overrideAvailability: { type: "boolean" },
          confirmed: { type: "boolean", const: true },
        }, ["groupId", "startsAt", "durationMinutes", "roomProvider", "confirmed"]),
        execute: (args) =>
          this.commands.execute(
            new ScheduleClassSessionCommand({
              groupId: args.groupId,
              teacherId: args.teacherId ?? null,
              startsAt: args.startsAt,
              durationMinutes: args.durationMinutes,
              roomProvider: args.roomProvider,
              roomUrl: args.roomUrl ?? null,
              roomExternalId: args.roomExternalId ?? null,
              topic: args.topic ?? null,
              contentUnitId: args.contentUnitId ?? null,
              overrideAvailability: args.overrideAvailability ?? false,
            }),
          ),
      }),
      tool({
        name: "generar_unidad",
        description:
          "Genera una unidad de contenido con IA. Requiere confirmación explícita: solo ejecuta si confirmed=true.",
        scope: "content:write",
        roles: ["owner", "admin", "teacher"],
        mutating: true,
        schema: generateUnitSchema,
        inputSchema: objectSchema({
          code: { type: "string", minLength: 1 },
          language: { type: "string", minLength: 1 },
          level: { type: "string", minLength: 1 },
          topic: { type: "string", minLength: 1 },
          skills: { type: "array", items: { type: "string" }, minItems: 1 },
          primaryLocale: { type: "string", minLength: 1 },
          exerciseTypes: { type: "array", items: { type: "string" }, minItems: 1 },
          sourceMaterial: { type: "string" },
          confirmed: { type: "boolean", const: true },
        }, [
          "code",
          "language",
          "level",
          "topic",
          "skills",
          "primaryLocale",
          "exerciseTypes",
          "confirmed",
        ]),
        execute: (args) =>
          this.commands.execute(
            new GenerateUnitCommand({
              code: args.code,
              language: args.language,
              level: args.level,
              topic: args.topic,
              skills: args.skills,
              primaryLocale: args.primaryLocale,
              exerciseTypes: args.exerciseTypes,
              sourceMaterial: args.sourceMaterial,
            }),
          ),
      }),
      tool({
        name: "resumen_facturacion",
        description: "Devuelve el resumen de facturación del mes de la escuela activa.",
        scope: "billing:read",
        roles: ["owner", "admin"],
        mutating: false,
        schema: emptySchema,
        inputSchema: objectSchema({}),
        execute: () => this.queries.execute(new GetBillingSummaryQuery()),
      }),
    ];
  }
}

function tool<TArgs extends object>(definition: ToolDefinition<TArgs>): AnyToolDefinition {
  return definition as unknown as AnyToolDefinition;
}

function objectSchema(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}
