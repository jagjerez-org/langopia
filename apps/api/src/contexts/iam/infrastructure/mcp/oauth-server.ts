import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export const MCP_OAUTH_SCOPES = [
  "students:read",
  "sessions:read",
  "sessions:write",
  "content:write",
  "analytics:read",
  "billing:read",
] as const;

export type McpOAuthScope = (typeof MCP_OAUTH_SCOPES)[number];

export type McpAuthorizationContext = {
  schoolId: string;
  membershipId: string;
};

export type RegisteredMcpClient = {
  id: string;
  clientId: string;
  schoolId: string | null;
  name: string;
  redirectUris: string[];
  scopes: string[];
  revokedAt: Date | null;
};

export type ActiveMcpAuthorization = {
  id: string;
  schoolId: string;
  mcpClientId: string;
  membershipId: string;
  roles: string[];
  scopes: string[];
  accessTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type McpAuthorizationListItem = {
  authorizationId: string;
  clientName: string;
  clientKind: string;
  memberName: string;
  scopes: string[];
  status: "active" | "expired" | "revoked";
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

export type McpOAuthRepository = {
  createClient(input: {
    schoolId: string | null;
    name: string;
    clientId: string;
    redirectUris: string[];
    scopes: string[];
    clientKind: string;
    authorizedByMembershipId: string | null;
  }): Promise<RegisteredMcpClient>;
  findClientByClientId(clientId: string): Promise<RegisteredMcpClient | null>;
  createAuthorization(input: {
    id: string;
    schoolId: string;
    mcpClientId: string;
    membershipId: string;
    scopes: string[];
    accessTokenHash: string;
    expiresAt: Date;
  }): Promise<ActiveMcpAuthorization>;
  findActiveAuthorizationByTokenHash(
    accessTokenHash: string,
    now: Date,
  ): Promise<ActiveMcpAuthorization | null>;
  revokeAuthorization(authorizationId: string, membershipId: string): Promise<boolean>;
  listAuthorizations(schoolId: string, now: Date): Promise<McpAuthorizationListItem[]>;
  revokeSchoolAuthorization(schoolId: string, authorizationId: string): Promise<boolean>;
};

type McpOAuthServerOptions = {
  issuer: string;
  tokenSecret: string;
  now?: () => Date;
  withTenant?: <T>(context: McpAuthorizationContext, work: () => Promise<T>) => Promise<T>;
};

export type RegisterClientRequest = {
  client_name?: string;
  redirect_uris?: string[];
  scope?: string;
};

export type AuthorizeRequest = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
};

export type TokenRequest = {
  grant_type?: string;
  client_id?: string;
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
};

type AuthorizationCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  schoolId: string;
  membershipId: string;
  scopes: string[];
  codeChallenge: string;
  expiresAt: Date;
};

type AccessTokenPayload = {
  typ: "langopia.mcp.access";
  iss: string;
  aud: "langopia-mcp";
  jti: string;
  authorizationId: string;
  schoolId: string;
  membershipId: string;
  scopes: string[];
  exp: number;
};

export class McpOAuthError extends DomainError {
  readonly kind = "forbidden" as const;
  constructor(
    readonly code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, details);
  }
}

export class McpOAuthServer {
  private readonly now: () => Date;
  private readonly authorizationCodes = new Map<string, AuthorizationCode>();

  constructor(
    private readonly repository: McpOAuthRepository,
    private readonly options: McpOAuthServerOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  metadata() {
    const issuer = this.options.issuer.replace(/\/$/, "");
    return {
      issuer,
      registration_endpoint: `${issuer}/mcp/oauth/register`,
      authorization_endpoint: `${issuer}/mcp/oauth/authorize`,
      token_endpoint: `${issuer}/mcp/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [...MCP_OAUTH_SCOPES],
    };
  }

  async registerClient(request: RegisterClientRequest) {
    const redirectUris = validRedirectUris(request.redirect_uris);
    const scopes = requestedScopes(request.scope, MCP_OAUTH_SCOPES);
    const clientId = `mcp_${randomBytes(24).toString("base64url")}`;
    const name = textOrDefault(request.client_name, "Cliente MCP");
    const client = await this.repository.createClient({
      schoolId: null,
      name,
      clientId,
      redirectUris,
      scopes,
      clientKind: inferClientKind(name, redirectUris),
      authorizedByMembershipId: null,
    });

    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(this.now().getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: client.scopes.join(" "),
    };
  }

  async authorize(context: McpAuthorizationContext, request: AuthorizeRequest) {
    if (request.response_type !== "code") {
      throw new McpOAuthError("mcp_invalid_response_type", "El flujo MCP solo admite response_type=code.");
    }
    if (request.code_challenge_method !== "S256") {
      throw new McpOAuthError("mcp_pkce_required", "PKCE con S256 es obligatorio.");
    }
    if (!request.code_challenge) {
      throw new McpOAuthError("mcp_pkce_required", "Falta code_challenge para PKCE.");
    }
    const client = await this.withTenant(context, () => this.activeClient(request.client_id));
    const redirectUri = this.allowedRedirectUri(client, request.redirect_uri);
    const scopes = requestedScopes(request.scope, client.scopes);
    const code = randomBytes(32).toString("base64url");
    this.authorizationCodes.set(code, {
      code,
      clientId: client.clientId,
      redirectUri,
      schoolId: context.schoolId,
      membershipId: context.membershipId,
      scopes,
      codeChallenge: request.code_challenge,
      expiresAt: new Date(this.now().getTime() + 5 * 60 * 1000),
    });

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (request.state) url.searchParams.set("state", request.state);
    return { redirectTo: url.toString() };
  }

  async exchangeToken(request: TokenRequest) {
    if (request.grant_type !== "authorization_code") {
      throw new McpOAuthError("mcp_invalid_grant_type", "El flujo MCP solo emite tokens con authorization_code.");
    }
    const code = this.authorizationCodes.get(required(request.code, "code"));
    if (!code) throw new McpOAuthError("mcp_invalid_code", "El código de autorización no existe.");
    this.authorizationCodes.delete(code.code);

    if (code.expiresAt <= this.now()) {
      throw new McpOAuthError("mcp_expired_code", "El código de autorización ha caducado.");
    }
    if (code.clientId !== request.client_id || code.redirectUri !== request.redirect_uri) {
      throw new McpOAuthError("mcp_invalid_code", "El código de autorización no corresponde al cliente.");
    }
    if (pkceChallenge(required(request.code_verifier, "code_verifier")) !== code.codeChallenge) {
      throw new McpOAuthError("mcp_invalid_pkce", "El verificador PKCE no coincide.");
    }

    const expiresAt = new Date(this.now().getTime() + 60 * 60 * 1000);
    const authorizationId = randomUUID();
    const tokenPayload = {
      schoolId: code.schoolId,
      membershipId: code.membershipId,
      scopes: code.scopes,
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    const accessToken = this.signToken({
      ...tokenPayload,
      typ: "langopia.mcp.access",
      iss: this.options.issuer.replace(/\/$/, ""),
      aud: "langopia-mcp",
      jti: randomBytes(16).toString("base64url"),
      authorizationId,
    });
    const authorization = await this.withTenant(
      { schoolId: code.schoolId, membershipId: code.membershipId },
      async () => {
        const client = await this.activeClient(code.clientId);
        return this.repository.createAuthorization({
          id: authorizationId,
          schoolId: code.schoolId,
          mcpClientId: client.id,
          membershipId: code.membershipId,
          scopes: code.scopes,
          accessTokenHash: hashToken(accessToken),
          expiresAt,
        });
      },
    );

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: authorization.scopes.join(" "),
    };
  }

  async verifyAccessToken(accessToken: string) {
    const payload = this.verifySignedToken(accessToken);
    const authorization = await this.withTenant(
      { schoolId: payload.schoolId, membershipId: payload.membershipId },
      () => this.repository.findActiveAuthorizationByTokenHash(hashToken(accessToken), this.now()),
    );
    if (!authorization) {
      throw new McpOAuthError("mcp_token_revoked", "El token MCP no está activo o fue revocado.");
    }
    if (
      authorization.id !== payload.authorizationId ||
      authorization.schoolId !== payload.schoolId ||
      authorization.membershipId !== payload.membershipId ||
      authorization.scopes.join(" ") !== payload.scopes.join(" ")
    ) {
      throw new McpOAuthError("mcp_invalid_token", "El token MCP no coincide con su autorización.");
    }
    return {
      authorizationId: authorization.id,
      schoolId: payload.schoolId,
      mcpClientId: authorization.mcpClientId,
      membershipId: payload.membershipId,
      roles: authorization.roles,
      scopes: payload.scopes,
    };
  }

  async revokeAuthorization(context: McpAuthorizationContext, authorizationId: string) {
    const revoked = await this.withTenant(context, () =>
      this.repository.revokeAuthorization(authorizationId, context.membershipId),
    );
    if (!revoked) {
      throw new McpOAuthError("mcp_authorization_not_found", "La autorización MCP no existe.", {
        authorizationId,
      });
    }
    return { revoked: true, schoolId: context.schoolId };
  }

  async listAuthorizations(context: McpAuthorizationContext) {
    const rows = await this.withTenant(context, () =>
      this.repository.listAuthorizations(context.schoolId, this.now()),
    );
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    }));
  }

  async revokeSchoolAuthorization(context: McpAuthorizationContext, authorizationId: string) {
    const revoked = await this.withTenant(context, () =>
      this.repository.revokeSchoolAuthorization(context.schoolId, authorizationId),
    );
    if (!revoked) {
      throw new McpOAuthError("mcp_authorization_not_found", "La autorización MCP no existe.", {
        authorizationId,
      });
    }
    return { revoked: true };
  }

  private async activeClient(clientId: string | undefined): Promise<RegisteredMcpClient> {
    const client = await this.repository.findClientByClientId(required(clientId, "client_id"));
    if (!client || client.revokedAt !== null) {
      throw new McpOAuthError("mcp_client_not_found", "El cliente MCP no existe o está revocado.");
    }
    return client;
  }

  private async withTenant<T>(context: McpAuthorizationContext, work: () => Promise<T>): Promise<T> {
    return this.options.withTenant ? this.options.withTenant(context, work) : work();
  }

  private allowedRedirectUri(client: RegisteredMcpClient, redirectUri: string | undefined): string {
    const requested = required(redirectUri, "redirect_uri");
    if (!client.redirectUris.includes(requested)) {
      throw new McpOAuthError("mcp_invalid_redirect_uri", "La redirect_uri no pertenece al cliente.");
    }
    return requested;
  }

  private signToken(payload: AccessTokenPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", this.options.tokenSecret)
      .update(encoded)
      .digest("base64url");
    return `mcp.${encoded}.${signature}`;
  }

  private verifySignedToken(accessToken: string): AccessTokenPayload {
    const parts = accessToken.split(".");
    const encoded = parts[1];
    const signature = parts[2];
    if (parts[0] !== "mcp" || !encoded || !signature) {
      throw new McpOAuthError("mcp_invalid_token", "El token MCP no tiene un formato válido.");
    }
    const expected = createHmac("sha256", this.options.tokenSecret)
      .update(encoded)
      .digest("base64url");
    if (!safeEqual(signature, expected)) {
      throw new McpOAuthError("mcp_invalid_token", "La firma del token MCP no es válida.");
    }
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<AccessTokenPayload>;
    if (
      payload.typ !== "langopia.mcp.access" ||
      payload.iss !== this.options.issuer.replace(/\/$/, "") ||
      payload.aud !== "langopia-mcp" ||
      typeof payload.authorizationId !== "string" ||
      typeof payload.schoolId !== "string" ||
      typeof payload.membershipId !== "string" ||
      !Array.isArray(payload.scopes) ||
      typeof payload.exp !== "number"
    ) {
      throw new McpOAuthError("mcp_invalid_token", "El token MCP no transporta un contexto válido.");
    }
    if (payload.exp <= Math.floor(this.now().getTime() / 1000)) {
      throw new McpOAuthError("mcp_token_expired", "El token MCP ha caducado.");
    }
    return payload as AccessTokenPayload;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function requestedScopes(raw: string | undefined, allowed: readonly string[]): string[] {
  const requested = (raw ?? "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const scopes = requested.length > 0 ? requested : [...allowed];
  const invalid = scopes.filter((scope) => !allowed.includes(scope));
  if (invalid.length > 0) {
    throw new McpOAuthError("mcp_invalid_scope", "El cliente MCP pide ámbitos no permitidos.", {
      invalid: invalid.join(", "),
    });
  }
  return [...new Set(scopes)];
}

function validRedirectUris(input: string[] | undefined): string[] {
  if (!input || input.length === 0) {
    throw new McpOAuthError("mcp_redirect_uri_required", "El registro MCP necesita al menos una redirect_uri.");
  }
  for (const uri of input) {
    const parsed = new URL(uri);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new McpOAuthError("mcp_invalid_redirect_uri", "La redirect_uri MCP debe usar HTTPS.");
    }
  }
  return [...new Set(input)];
}

function textOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function required(value: string | undefined, field: string): string {
  if (!value || value.length === 0) {
    throw new McpOAuthError("mcp_required_field", `Falta ${field}.`, { field });
  }
  return value;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function inferClientKind(name: string, redirectUris: readonly string[]): string {
  const haystack = `${name} ${redirectUris.join(" ")}`.toLowerCase();
  if (haystack.includes("claude")) return "claude";
  if (haystack.includes("chatgpt") || haystack.includes("openai")) return "chatgpt";
  return "custom";
}
