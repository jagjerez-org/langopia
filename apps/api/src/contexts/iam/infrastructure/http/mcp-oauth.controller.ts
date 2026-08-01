import { Body, Controller, Get, Inject, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { Public, Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { MEMBERSHIP_ROLES } from "../../domain/model/invitation.aggregate.js";
import {
  McpOAuthServer,
  type AuthorizeRequest,
  type RegisterClientRequest,
  type TokenRequest,
} from "../mcp/oauth-server.js";

@Controller()
export class McpOAuthController {
  constructor(
    private readonly oauth: McpOAuthServer,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  @Public()
  @Get(".well-known/oauth-authorization-server")
  metadata() {
    return this.oauth.metadata();
  }

  @Public()
  @Post("mcp/oauth/register")
  register(@Body() body: RegisterClientRequest) {
    return this.oauth.registerClient(body);
  }

  @Roles(...MEMBERSHIP_ROLES)
  @Get("mcp/oauth/authorize")
  async authorize(
    @Query() query: AuthorizeRequest & { consent?: string },
    @Res() response: Response,
  ) {
    if (query.consent !== "accept") {
      response.type("html").send(consentHtml(query));
      return;
    }
    const result = await this.oauth.authorize(this.context(), query);
    response.redirect(result.redirectTo);
  }

  @Public()
  @Post("mcp/oauth/token")
  token(@Body() body: TokenRequest) {
    return this.oauth.exchangeToken(body);
  }

  @Roles("owner", "admin")
  @Get("mcp/oauth/authorizations")
  listAuthorizations() {
    return this.oauth.listAuthorizations(this.context());
  }

  @Roles("owner", "admin")
  @Post("mcp/oauth/authorizations/:authorizationId/revoke")
  revoke(@Param("authorizationId") authorizationId: string) {
    return this.oauth.revokeSchoolAuthorization(this.context(), authorizationId);
  }

  private context() {
    return {
      schoolId: this.tenant.schoolId(),
      membershipId: this.tenant.membershipId() ?? "",
    };
  }
}

function consentHtml(query: AuthorizeRequest): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }
  params.set("consent", "accept");
  const scope = escapeHtml(query.scope ?? "");
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Autorizar MCP</title></head>
<body>
  <main>
    <h1>Autorizar cliente MCP</h1>
    <p>Ámbitos solicitados: ${scope || "todos los permitidos del cliente"}</p>
    <form method="get" action="/mcp/oauth/authorize">
      ${[...params.entries()]
        .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`)
        .join("\n      ")}
      <button type="submit">Autorizar</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
