import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./bootstrap.js";

/**
 * Entrada serverless (Vercel). La función no puede hacer `listen`: recibe
 * cada petición ya abierta, así que se inicializa Nest UNA vez por instancia
 * caliente (`app.init()`, sin puerto) y se reutiliza el manejador Express en
 * las invocaciones siguientes — el `require` del módulo sobrevive entre
 * llamadas mientras la instancia siga viva, así que la promesa cacheada es
 * suficiente.
 *
 * Los `@Cron(...)` de `@nestjs/schedule` no se disparan aquí (la instancia
 * está congelada entre invocaciones): en Vercel los trabajos programados
 * llegan como peticiones HTTP a las rutas `cron/*` (Vercel Cron), protegidas
 * por `CronSecretGuard`. En un proceso largo (`main.ts`) siguen disparándose
 * solos, como siempre.
 */
type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Promise<ExpressHandler> | undefined;

function getHandler(): Promise<ExpressHandler> {
  cached ??= createApp().then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as ExpressHandler;
  });
  return cached;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  (await getHandler())(req, res);
}
