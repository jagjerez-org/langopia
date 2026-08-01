import { Body, Controller, Headers, HttpCode, Inject, Post } from "@nestjs/common";
import { DomainError } from "../../contexts/shared/domain/errors/domain-error.js";
import { Public } from "../../contexts/shared/infrastructure/http/roles.decorator.js";
import {
  MCP_ACCESS_TOKEN_VERIFIER,
  type McpAccessTokenVerifier,
} from "./mcp-auth.port.js";
import { McpToolsService } from "./tools/mcp-tools.service.js";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

class McpAuthorizationRequiredError extends DomainError {
  readonly code = "mcp_authorization_required";
  readonly kind = "forbidden" as const;
  constructor() {
    super("La llamada MCP requiere un token Bearer válido.");
  }
}

class McpInvalidRequestError extends DomainError {
  readonly code = "mcp_invalid_request";
  readonly kind = "invalid_input" as const;
  constructor(message: string) {
    super(message);
  }
}

@Public()
@Controller("mcp")
export class McpController {
  constructor(
    @Inject(MCP_ACCESS_TOKEN_VERIFIER) private readonly oauth: McpAccessTokenVerifier,
    private readonly tools: McpToolsService,
  ) {}

  @Post()
  @HttpCode(200)
  async rpc(@Headers("authorization") authorizationHeader: string | undefined, @Body() body: unknown) {
    const request = parseJsonRpc(body);

    if (request.method === "tools/list") {
      return jsonRpcResult(request.id, { tools: this.tools.list() });
    }

    if (request.method === "tools/call") {
      const authorization = await this.oauth.verifyAccessToken(bearerToken(authorizationHeader));
      const params = parseToolCallParams(request.params);
      const result = await this.tools.call(params.name, params.arguments ?? {}, authorization);
      return jsonRpcResult(request.id, result);
    }

    throw new McpInvalidRequestError(`Método MCP no soportado: ${request.method ?? "(sin método)"}.`);
  }
}

function parseJsonRpc(body: unknown): JsonRpcRequest {
  if (typeof body !== "object" || body === null) {
    throw new McpInvalidRequestError("La petición MCP debe ser un objeto JSON-RPC.");
  }
  const request = body as JsonRpcRequest;
  if (request.jsonrpc !== undefined && request.jsonrpc !== "2.0") {
    throw new McpInvalidRequestError("La petición MCP debe usar JSON-RPC 2.0.");
  }
  if (typeof request.method !== "string" || request.method.length === 0) {
    throw new McpInvalidRequestError("La petición MCP no indica método.");
  }
  return request;
}

function parseToolCallParams(params: unknown): { name: string; arguments?: unknown } {
  if (typeof params !== "object" || params === null) {
    throw new McpInvalidRequestError("tools/call necesita params.");
  }
  const call = params as { name?: unknown; arguments?: unknown };
  if (typeof call.name !== "string" || call.name.length === 0) {
    throw new McpInvalidRequestError("tools/call necesita params.name.");
  }
  return { name: call.name, arguments: call.arguments };
}

function bearerToken(header: string | undefined): string {
  const [scheme, token, extra] = (header ?? "").split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) throw new McpAuthorizationRequiredError();
  return token;
}

function jsonRpcResult(id: JsonRpcId | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
