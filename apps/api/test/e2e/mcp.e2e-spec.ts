import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { BadRequestException, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminDb, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";
import { MCP_ACCESS_TOKEN_VERIFIER } from "../../src/entrypoints/mcp/mcp-auth.port.js";
import type { VerifiedMcpAuthorization } from "../../src/entrypoints/mcp/tools/mcp-tools.service.js";

type Json = Record<string, any>;

async function call(
  baseUrl: string,
  body: unknown,
  authorization = "Bearer mcp-e2e",
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

async function tenant(db: Db, slug: string): Promise<{ schoolId: string; membershipId: string }> {
  const rows = await db.execute<{ school_id: string; membership_id: string }>(sql`
    SELECT s.id AS school_id, m.id AS membership_id
    FROM schools s
    JOIN memberships m ON m.school_id = s.id
    WHERE s.slug = ${slug}
      AND m.role IN ('owner', 'admin')
    ORDER BY m.role
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new Error(`No hay tenant seed para ${slug}. Ejecuta npm run db:seed.`);
  return { schoolId: row.school_id, membershipId: row.membership_id };
}

describe("MCP — endpoint real con tenant y RLS", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;
  let currentAuthorization: VerifiedMcpAuthorization;

  beforeAll(async () => {
    const admin = createAdminDb();
    adminDb = admin.db;
    closeAdminDb = () => admin.client.end({ timeout: 5 });
    const atlantico = await tenant(adminDb, "atlantico");

    currentAuthorization = {
      authorizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      schoolId: atlantico.schoolId,
      membershipId: atlantico.membershipId,
      mcpClientId: "33333333-3333-4333-8333-333333333333",
      roles: ["owner"],
      scopes: ["students:read"],
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MCP_ACCESS_TOKEN_VERIFIER)
      .useValue({ verifyAccessToken: async () => currentAuthorization })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            message: "validation_failed",
            errors: errors.flatMap((error) =>
              Object.values(error.constraints ?? {}).map((message) => ({
                field: error.property,
                message,
              })),
            ),
          }),
      }),
    );
    app.setGlobalPrefix("api/v1");
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    await app?.close();
    await closeAdminDb?.();
  });

  it("devuelve 403 si la herramienta no tiene el scope autorizado", async () => {
    const response = await call(baseUrl, {
      jsonrpc: "2.0",
      id: "billing",
      method: "tools/call",
      params: { name: "resumen_facturacion", arguments: {} },
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("mcp_scope_forbidden");
  });

  it("un token de Atlántico no ve alumnado de Paulista aunque el input intente pedir otra escuela", async () => {
    const response = await call(baseUrl, {
      jsonrpc: "2.0",
      id: "students",
      method: "tools/call",
      params: {
        name: "buscar_alumnos",
        arguments: { schoolId: "paulista" },
      },
    });

    expect(response.status).toBe(200);
    const students = response.body.result.structuredContent as Array<{ name: string }>;
    const names = students.map((student) => student.name);
    expect(names).toContain("Lucía Ferrán");
    expect(names).not.toContain("Ana Beatriz Lima");
  });
});
