import { Logger } from "nestjs-pino";
import { createApp } from "./bootstrap.js";

/**
 * Entrada del proceso largo (desarrollo local y cualquier despliegue en
 * contenedor). Toda la configuración de la aplicación vive en
 * `bootstrap.ts`: la entrada serverless (`vercel.ts`) monta exactamente la
 * misma app sin `listen`.
 */
async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  app.get(Logger).log(`API escuchando en http://localhost:${port}/api/v1`, "Bootstrap");
}

void bootstrap();
