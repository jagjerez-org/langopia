import type { INestApplication } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { NextFunction, Request, Response } from "express";

/**
 * Las rutas del servidor OAuth de MCP tienen que vivir en la RAÍZ del
 * servicio —el descubrimiento de OAuth 2.1 (RFC 8414) busca
 * `/.well-known/oauth-authorization-server` sin prefijo, y los clientes MCP
 * (Claude, ChatGPT) derivan de ahí `/mcp/oauth/*`—, así que `main.ts` las
 * excluye del prefijo global `api/v1`.
 *
 * El precio de esa exclusión: Nest deja de aplicar a esas rutas TODOS los
 * middleware registrados a través del contenedor (`MiddlewareConsumer`), y
 * entre ellos está el de `nestjs-cls` que crea el contexto de la petición.
 * Sin ese contexto, el guardia de tenant (`cls.set(CLS_TRACE_ID, …)`) y el
 * filtro global de excepciones morían con «No CLS context available» y la
 * respuesta era un 500 pelado de Express: el flujo OAuth de MCP era
 * imposible fuera de las pruebas, que nunca arrancan con la exclusión.
 *
 * Este puente devuelve el contexto CLS justo a esas rutas, montándolo
 * directamente sobre el adaptador HTTP —antes de que Nest registre los
 * suyos— en vez de a través del contenedor que las ignora.
 */

/** Rutas de raíz que necesitan contexto CLS: las del OAuth de MCP. */
export const ROOT_PATHS_NEEDING_CLS = ["/.well-known/oauth-authorization-server", "/mcp/oauth"];

export function mountClsContextForRootPaths(app: INestApplication): void {
  const cls = app.get(ClsService, { strict: false });
  const adapter = app.getHttpAdapter();
  for (const path of ROOT_PATHS_NEEDING_CLS) {
    adapter.use(path, (_req: Request, _res: Response, next: NextFunction) => {
      cls.run(() => next());
    });
  }
}
