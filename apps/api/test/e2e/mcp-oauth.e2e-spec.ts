import "reflect-metadata";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import {
  BadRequestException,
  RequestMethod,
  type INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module.js";
import { mountClsContextForRootPaths } from "../../src/contexts/shared/infrastructure/http/root-cls.middleware.js";

/**
 * Las rutas OAuth del servidor MCP NO viven bajo `/api/v1`: el descubrimiento
 * de OAuth 2.1 (RFC 8414) exige `/.well-known/oauth-authorization-server` en
 * la raíz, y de ahí cuelgan `/mcp/oauth/*`. `main.ts` las excluye del prefijo
 * global… y Nest deja de aplicarles TODOS los middleware del contenedor —
 * incluido el de `nestjs-cls` que crea el contexto—, así que cualquier
 * petición a esas rutas moría con un 500 («No CLS context available») en
 * cuanto el guardia de tenant o el filtro de excepciones tocaban el CLS.
 *
 * El resto de e2e (ola 3) arranca el módulo SIN la exclusión y nunca lo vio.
 * Esta suite arranca la aplicación exactamente como `main.ts` y recorre el
 * flujo completo de un cliente MCP real —registro dinámico, consentimiento,
 * PKCE, token, llamada a herramienta y revocación— contra las rutas de raíz.
 * Es la forma local y repetible de los pasos «probar con Claude/ChatGPT» del
 * plan de la ola 3: se simulan ambos clientes con sus redirect_uri reales.
 */

type Json = Record<string, any>;

type ApiResult = { status: number; body: Json; cookie: string | null; headers: Headers };

const RUN = randomUUID().slice(0, 8);
const OWNER_EMAIL = "marta.colomer@atlantico.example";
const OWNER_PASSWORD = process.env.SEED_PASSWORD ?? "Langopia-demo-2026";

const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const CHATGPT_REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";

async function call(
  baseUrl: string,
  method: string,
  path: string,
  options: { cookie?: string; authorization?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.authorization) headers.authorization = options.authorization;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  const setCookie = response.headers.getSetCookie();
  const text = await response.text();
  const body =
    text.length > 0 && response.headers.get("content-type")?.includes("json")
      ? JSON.parse(text)
      : text.length > 0
        ? { text }
        : {};
  return { status: response.status, body, cookie: setCookie.length > 0 ? setCookie.join("; ") : null, headers: response.headers };
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** El flujo OAuth 2.1 + PKCE completo que sigue un cliente MCP real. */
async function registerAuthorizeAndExchange(params: {
  rootUrl: string;
  ownerCookie: string;
  clientName: string;
  redirectUri: string;
  scopes: string[];
}): Promise<{ accessToken: string; authorizationId: string }> {
  const registered = await call(params.rootUrl, "POST", "/mcp/oauth/register", {
    body: {
      client_name: params.clientName,
      redirect_uris: [params.redirectUri],
      scope: params.scopes.join(" "),
    },
  });
  expect(registered.status).toBe(201);
  const clientId = registered.body.client_id as string;

  const verifier = `verifier-${RUN}-${randomUUID()}`;
  const state = `state-${RUN}`;

  // Sin consentimiento explícito, el servidor enseña la pantalla de consentir.
  const consentPage = await call(
    params.rootUrl,
    "GET",
    `/mcp/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: params.redirectUri,
      response_type: "code",
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
      scope: params.scopes.join(" "),
      state,
    })}`,
    { cookie: params.ownerCookie },
  );
  expect(consentPage.status).toBe(200);
  expect(String(consentPage.body.text)).toContain("Autorizar cliente MCP");

  const authorize = await call(
    params.rootUrl,
    "GET",
    `/mcp/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: params.redirectUri,
      response_type: "code",
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
      scope: params.scopes.join(" "),
      state,
      consent: "accept",
    })}`,
    { cookie: params.ownerCookie },
  );
  expect(authorize.status).toBe(302);
  const location = authorize.headers.get("location");
  if (!location) throw new Error("OAuth MCP no devolvió redirect con código.");
  expect(new URL(location).searchParams.get("state")).toBe(state);
  const code = new URL(location).searchParams.get("code");
  if (!code) throw new Error("OAuth MCP no devolvió code.");

  const token = await call(params.rootUrl, "POST", "/mcp/oauth/token", {
    body: {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: params.redirectUri,
      code_verifier: verifier,
    },
  });
  expect(token.status).toBe(201);
  expect(token.body.token_type).toBe("Bearer");
  const accessToken = token.body.access_token as string;
  const payload = JSON.parse(
    Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8"),
  ) as { authorizationId: string; membershipId: string; schoolId: string };
  // El token transporta la membresía que autorizó: es lo que fija la escuela.
  expect(payload.membershipId).toBeTruthy();
  expect(payload.schoolId).toBeTruthy();
  return { accessToken, authorizationId: payload.authorizationId };
}

async function mcpCall(
  apiUrl: string,
  accessToken: string,
  name: string,
  args: Json = {},
): Promise<{ status: number; body: Json }> {
  const response = await call(apiUrl, "POST", "/mcp", {
    authorization: `Bearer ${accessToken}`,
    body: { jsonrpc: "2.0", id: name, method: "tools/call", params: { name, arguments: args } },
  });
  return { status: response.status, body: response.body };
}

describe("MCP OAuth 2.1 — rutas de raíz como en main.ts", () => {
  let app: INestApplication;
  let rootUrl: string;
  let apiUrl: string;
  let ownerCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    // Misma configuración que `main.ts`: las rutas OAuth MCP van en la raíz.
    app.setGlobalPrefix("api/v1", {
      exclude: [
        { path: ".well-known/oauth-authorization-server", method: RequestMethod.GET },
        { path: "mcp/oauth/{*path}", method: RequestMethod.ALL },
      ],
    });
    // Y el mismo puente de contexto CLS que `main.ts` les da a esas rutas.
    mountClsContextForRootPaths(app);
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    rootUrl = `http://127.0.0.1:${address.port}`;
    apiUrl = `${rootUrl}/api/v1`;

    const signIn = await call(apiUrl, "POST", "/auth/sign-in/email", {
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
    });
    if (!signIn.cookie) {
      throw new Error(`No se recibió cookie para ${OWNER_EMAIL}. ¿Está sembrada la BD?`);
    }
    ownerCookie = signIn.cookie;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("publica los metadatos del servidor de autorización en la raíz", async () => {
    const metadata = await call(rootUrl, "GET", "/.well-known/oauth-authorization-server");
    expect(metadata.status).toBe(200);
    expect(metadata.body.registration_endpoint).toContain("/mcp/oauth/register");
    expect(metadata.body.code_challenge_methods_supported).toContain("S256");
    // Los endpoints se anuncian en la RAÍZ: un cliente MCP real los deriva del
    // issuer y moriría contra un `/api/v1/...` que no existe fuera del panel.
    expect(metadata.body.registration_endpoint).toMatch(/^https?:\/\/[^/]+\/mcp\/oauth\/register$/);
    expect(metadata.body.authorization_endpoint).toMatch(/^https?:\/\/[^/]+\/mcp\/oauth\/authorize$/);
    expect(metadata.body.token_endpoint).toMatch(/^https?:\/\/[^/]+\/mcp\/oauth\/token$/);
  });

  it("un cliente como Claude se registra, consiente con PKCE y usa herramientas de su ámbito", async () => {
    const claude = await registerAuthorizeAndExchange({
      rootUrl,
      ownerCookie,
      clientName: `Claude e2e ${RUN}`,
      redirectUri: CLAUDE_REDIRECT,
      scopes: ["students:read", "analytics:read"],
    });

    // La pregunta del plan: «¿qué alumnos llevan semanas sin valorar?».
    const atRisk = await mcpCall(apiUrl, claude.accessToken, "alumnos_en_riesgo");
    expect(atRisk.status).toBe(200);
    expect(atRisk.body.result.structuredContent).toBeInstanceOf(Array);

    // Fuera de su ámbito: 403 con el código de dominio.
    const billing = await mcpCall(apiUrl, claude.accessToken, "resumen_facturacion");
    expect(billing.status).toBe(403);
    expect(billing.body.code).toBe("mcp_scope_forbidden");

    // La revocación desde el panel surte efecto de inmediato.
    const revoke = await call(
      rootUrl,
      "POST",
      `/mcp/oauth/authorizations/${claude.authorizationId}/revoke`,
      { cookie: ownerCookie },
    );
    expect(revoke.status).toBe(201);
    const afterRevoke = await mcpCall(apiUrl, claude.accessToken, "buscar_alumnos");
    expect(afterRevoke.status).toBe(403);
    expect(afterRevoke.body.code).toBe("mcp_token_revoked");
  });

  it("un cliente como ChatGPT recorre el mismo flujo y queda limitado a sus ámbitos", async () => {
    const chatgpt = await registerAuthorizeAndExchange({
      rootUrl,
      ownerCookie,
      clientName: `ChatGPT e2e ${RUN}`,
      redirectUri: CHATGPT_REDIRECT,
      scopes: ["students:read"],
    });

    const students = await mcpCall(apiUrl, chatgpt.accessToken, "buscar_alumnos");
    expect(students.status).toBe(200);

    const agenda = await mcpCall(apiUrl, chatgpt.accessToken, "agenda_semanal", {
      from: "2026-07-27T00:00:00.000Z",
      to: "2026-08-02T23:59:59.000Z",
    });
    expect(agenda.status).toBe(403);
    expect(agenda.body.code).toBe("mcp_scope_forbidden");
  });
});
