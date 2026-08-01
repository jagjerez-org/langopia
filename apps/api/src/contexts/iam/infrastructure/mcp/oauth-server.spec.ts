import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  type McpAuthorizationListItem,
  McpOAuthServer,
  type McpAuthorizationContext,
  type McpOAuthRepository,
} from "./oauth-server.js";

class MemoryMcpOAuthRepository implements McpOAuthRepository {
  clients = new Map<string, Awaited<ReturnType<McpOAuthRepository["createClient"]>>>();
  authorizations = new Map<string, Awaited<ReturnType<McpOAuthRepository["createAuthorization"]>>>();

  async createClient(input: Parameters<McpOAuthRepository["createClient"]>[0]) {
    const client = {
      id: `client-${this.clients.size + 1}`,
      clientId: input.clientId,
      schoolId: input.schoolId,
      name: input.name,
      redirectUris: input.redirectUris,
      scopes: input.scopes,
      revokedAt: null,
    };
    this.clients.set(client.clientId, client);
    return client;
  }

  async findClientByClientId(clientId: string) {
    return this.clients.get(clientId) ?? null;
  }

  async createAuthorization(input: Parameters<McpOAuthRepository["createAuthorization"]>[0]) {
    const authorization = {
      id: input.id,
      schoolId: input.schoolId,
      mcpClientId: input.mcpClientId,
      membershipId: input.membershipId,
      roles: ["owner"],
      scopes: input.scopes,
      accessTokenHash: input.accessTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.authorizations.set(authorization.id, authorization);
    return authorization;
  }

  async findActiveAuthorizationByTokenHash(accessTokenHash: string, now: Date) {
    return (
      [...this.authorizations.values()].find(
        (authorization) =>
          authorization.accessTokenHash === accessTokenHash &&
          authorization.revokedAt === null &&
          authorization.expiresAt > now,
      ) ?? null
    );
  }

  async revokeAuthorization(authorizationId: string, membershipId: string) {
    const authorization = this.authorizations.get(authorizationId);
    if (!authorization || authorization.membershipId !== membershipId) return false;
    authorization.revokedAt = new Date();
    return true;
  }

  async listAuthorizations(schoolId: string, now: Date) {
    return [...this.authorizations.values()]
      .filter((authorization) => authorization.schoolId === schoolId)
      .map((authorization) => ({
        authorizationId: authorization.id,
        clientName: "Claude Desktop",
        clientKind: "claude",
        memberName: "Marta Colomer",
        scopes: authorization.scopes,
        status: authorization.revokedAt ? "revoked" : authorization.expiresAt <= now ? "expired" : "active",
        createdAt: new Date("2026-07-28T09:00:00Z"),
        expiresAt: authorization.expiresAt,
        lastUsedAt: null,
      }) satisfies McpAuthorizationListItem);
  }

  async revokeSchoolAuthorization(schoolId: string, authorizationId: string) {
    const authorization = this.authorizations.get(authorizationId);
    if (!authorization || authorization.schoolId !== schoolId || authorization.revokedAt) return false;
    authorization.revokedAt = new Date();
    return true;
  }
}

const context: McpAuthorizationContext = {
  schoolId: "11111111-1111-1111-1111-111111111111",
  membershipId: "22222222-2222-2222-2222-222222222222",
};

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

describe("McpOAuthServer", () => {
  it("publica metadata OAuth 2.1 con PKCE S256 y scopes MCP", () => {
    const server = new McpOAuthServer(new MemoryMcpOAuthRepository(), {
      issuer: "https://api.langopia.test",
      tokenSecret: "test-secret",
      now: () => new Date("2026-07-28T10:00:00Z"),
    });

    expect(server.metadata()).toMatchObject({
      issuer: "https://api.langopia.test",
      registration_endpoint: "https://api.langopia.test/mcp/oauth/register",
      authorization_endpoint: "https://api.langopia.test/mcp/oauth/authorize",
      token_endpoint: "https://api.langopia.test/mcp/oauth/token",
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [
        "students:read",
        "sessions:read",
        "sessions:write",
        "content:write",
        "analytics:read",
        "billing:read",
      ],
    });
  });

  it("registra cliente dinámico limitado a los scopes solicitados válidos", async () => {
    const repository = new MemoryMcpOAuthRepository();
    const server = new McpOAuthServer(repository, {
      issuer: "https://api.langopia.test",
      tokenSecret: "test-secret",
      now: () => new Date("2026-07-28T10:00:00Z"),
    });

    const registered = await server.registerClient({
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      scope: "students:read sessions:write",
    });

    expect(registered.client_id).toMatch(/^mcp_/);
    expect(registered.scope).toBe("students:read sessions:write");
    expect(repository.clients.get(registered.client_id)?.schoolId).toBeNull();
  });

  it("intercambia un código con PKCE por un token verificable ligado a membership y scopes", async () => {
    const repository = new MemoryMcpOAuthRepository();
    const server = new McpOAuthServer(repository, {
      issuer: "https://api.langopia.test",
      tokenSecret: "test-secret",
      now: () => new Date("2026-07-28T10:00:00Z"),
    });
    const registered = await server.registerClient({
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
      scope: "students:read analytics:read",
    });

    const redirect = await server.authorize(context, {
      client_id: registered.client_id,
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: pkceChallenge("verifier-correcto"),
      scope: "students:read analytics:read",
      state: "estado",
    });

    const code = new URL(redirect.redirectTo).searchParams.get("code");
    const token = await server.exchangeToken({
      grant_type: "authorization_code",
      client_id: registered.client_id,
      code: code ?? "",
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      code_verifier: "verifier-correcto",
    });

    const verified = await server.verifyAccessToken(token.access_token);
    expect(verified).toMatchObject({
      schoolId: context.schoolId,
      membershipId: context.membershipId,
      roles: ["owner"],
      scopes: ["students:read", "analytics:read"],
    });
  });

  it("lista y revoca autorizaciones de panel dentro del tenant activo", async () => {
    const tenantCalls: McpAuthorizationContext[] = [];
    const repository = new MemoryMcpOAuthRepository();
    const server = new McpOAuthServer(repository, {
      issuer: "https://api.langopia.test",
      tokenSecret: "test-secret",
      now: () => new Date("2026-07-28T10:00:00Z"),
      withTenant: async (current, work) => {
        tenantCalls.push(current);
        return work();
      },
    });
    const created = await repository.createAuthorization({
      id: "authorization-1",
      schoolId: context.schoolId,
      mcpClientId: "client-1",
      membershipId: context.membershipId,
      scopes: ["students:read"],
      accessTokenHash: "hash",
      expiresAt: new Date("2026-07-28T11:00:00Z"),
    });

    await server.listAuthorizations(context);
    await server.revokeSchoolAuthorization(context, created.id);

    expect(tenantCalls).toEqual([context, context]);
  });

  it("rechaza el token en cuanto la autorización se revoca", async () => {
    const repository = new MemoryMcpOAuthRepository();
    const server = new McpOAuthServer(repository, {
      issuer: "https://api.langopia.test",
      tokenSecret: "test-secret",
      now: () => new Date("2026-07-28T10:00:00Z"),
    });
    const registered = await server.registerClient({
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      scope: "students:read",
    });
    const redirect = await server.authorize(context, {
      client_id: registered.client_id,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: pkceChallenge("verifier-correcto"),
      scope: "students:read",
    });
    const code = new URL(redirect.redirectTo).searchParams.get("code");
    const token = await server.exchangeToken({
      grant_type: "authorization_code",
      client_id: registered.client_id,
      code: code ?? "",
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: "verifier-correcto",
    });
    const authorizationId = (await server.verifyAccessToken(token.access_token)).authorizationId;

    await server.revokeAuthorization(context, authorizationId);

    await expect(server.verifyAccessToken(token.access_token)).rejects.toMatchObject({
      code: "mcp_token_revoked",
    });
  });

  it("lista y revoca autorizaciones de la escuela para el panel", async () => {
    const repository = new MemoryMcpOAuthRepository();
    const server = new McpOAuthServer(repository, {
      issuer: "https://api.langopia.test",
      tokenSecret: "test-secret",
      now: () => new Date("2026-07-28T10:00:00Z"),
    });
    const registered = await server.registerClient({
      client_name: "Claude Desktop",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      scope: "students:read analytics:read",
    });
    const redirect = await server.authorize(context, {
      client_id: registered.client_id,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: pkceChallenge("verifier-correcto"),
      scope: "students:read analytics:read",
    });
    const code = new URL(redirect.redirectTo).searchParams.get("code");
    const token = await server.exchangeToken({
      grant_type: "authorization_code",
      client_id: registered.client_id,
      code: code ?? "",
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: "verifier-correcto",
    });
    const authorizationId = (await server.verifyAccessToken(token.access_token)).authorizationId;

    expect(await server.listAuthorizations(context)).toEqual([
      expect.objectContaining({
        authorizationId,
        clientName: "Claude Desktop",
        scopes: ["students:read", "analytics:read"],
        status: "active",
      }),
    ]);

    await server.revokeSchoolAuthorization(context, authorizationId);

    await expect(server.verifyAccessToken(token.access_token)).rejects.toMatchObject({
      code: "mcp_token_revoked",
    });
  });
});
