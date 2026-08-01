import { describe, expect, it, vi } from "vitest";
import { McpController } from "./mcp.controller.js";
import type { VerifiedMcpAuthorization } from "./tools/mcp-tools.service.js";

const authorization: VerifiedMcpAuthorization = {
  authorizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  schoolId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  mcpClientId: "33333333-3333-4333-8333-333333333333",
  roles: ["owner"],
  scopes: ["students:read"],
};

describe("McpController", () => {
  it("expone tools/list con los descriptores MCP", async () => {
    const controller = new McpController({} as never, {
      list: () => [{ name: "buscar_alumnos", description: "Lista", inputSchema: { type: "object" } }],
    } as never);

    await expect(
      controller.rpc(undefined, { jsonrpc: "2.0", id: 1, method: "tools/list" }),
    ).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [{ name: "buscar_alumnos", description: "Lista", inputSchema: { type: "object" } }],
      },
    });
  });

  it("verifica el Bearer con McpOAuthServer antes de tools/call", async () => {
    const verifyAccessToken = vi.fn(async () => authorization);
    const call = vi.fn(async () => ({ content: [], structuredContent: { ok: true } }));
    const controller = new McpController({ verifyAccessToken } as never, { call } as never);

    const result = await controller.rpc("Bearer token-mcp", {
      jsonrpc: "2.0",
      id: "call-1",
      method: "tools/call",
      params: { name: "buscar_alumnos", arguments: { ignored: true } },
    });

    expect(verifyAccessToken).toHaveBeenCalledWith("token-mcp");
    expect(call).toHaveBeenCalledWith("buscar_alumnos", { ignored: true }, authorization);
    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "call-1",
      result: { content: [], structuredContent: { ok: true } },
    });
  });

  it("rechaza tools/call sin token Bearer", async () => {
    const controller = new McpController({ verifyAccessToken: vi.fn() } as never, {
      call: vi.fn(),
    } as never);

    await expect(
      controller.rpc(undefined, {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: { name: "buscar_alumnos" },
      }),
    ).rejects.toMatchObject({ code: "mcp_authorization_required", kind: "forbidden" });
  });
});
