import type { VerifiedMcpAuthorization } from "./tools/mcp-tools.service.js";

export interface McpAccessTokenVerifier {
  verifyAccessToken(accessToken: string): Promise<VerifiedMcpAuthorization>;
}

export const MCP_ACCESS_TOKEN_VERIFIER = Symbol("McpAccessTokenVerifier");
