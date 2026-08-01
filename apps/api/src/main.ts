import "reflect-metadata";
import { BadRequestException, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { parseTrustedOrigins } from "./contexts/iam/infrastructure/auth/better-auth.config.js";
import { mountClsContextForRootPaths } from "./contexts/shared/infrastructure/http/root-cls.middleware.js";

/**
 * Registro único de la API (Tarea 8c): sustituye al `JsonLogger` a mano de la
 * Tarea 11. `app.useLogger(...)` reemplaza el logger interno de Nest por
 * `nestjs-pino`, así que hasta los mensajes de arranque del framework —que
 * nadie inyecta— salen con el mismo formato que el resto: JSON en producción,
 * `pino-pretty` en desarrollo. El `x-request-id` de la respuesta y el
 * `traceId` de cada línea los fija `SessionTenantGuard`, que es el primer
 * punto por el que pasa cualquier petición.
 */
async function bootstrap(): Promise<void> {
  // `rawBody: true` (Tarea 8): deja el cuerpo crudo en `request.rawBody`
  // ADEMÁS de parsearlo como siempre — no en su lugar—, para que el
  // controlador de webhooks del proveedor de pago pueda verificar la firma
  // sobre los mismos bytes que llegaron, antes de que nada los reinterprete.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Un campo que la API no conoce es un error del cliente, no algo que
      // se ignore en silencio: así un typo en `overrideAvailability` se
      // detecta al integrar y no en producción.
      forbidNonWhitelisted: true,
      // El contrato único de errores (Tarea 8b) necesita `errors[]` por
      // campo. Sin este `exceptionFactory`, el `ValidationPipe` por defecto
      // solo da un array de frases sueltas («groupId must be a UUID»), sin
      // decir a qué campo pertenece cada una; `AllExceptionsFilter` espera
      // justo esta forma para construirlo.
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

  // El panel (`apps/web`) es una SPA servida desde otro origen (otro puerto en
  // desarrollo, otro dominio en producción): el navegador exige CORS además de
  // que Better Auth valide `Origin`. Misma lista de orígenes de confianza que
  // usa Better Auth (`BETTER_AUTH_TRUSTED_ORIGINS`), para no mantener dos
  // listas que puedan divergir. `credentials: true` es imprescindible para que
  // la cookie de sesión viaje en peticiones entre orígenes distintos.
  app.enableCors({
    origin: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    credentials: true,
  });

  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: ".well-known/oauth-authorization-server", method: RequestMethod.GET },
      { path: "mcp/oauth/{*path}", method: RequestMethod.ALL },
    ],
  });
  // Las rutas excluidas del prefijo no reciben los middleware del contenedor
  // —incluido el de nestjs-cls— y sin contexto CLS el guardia de tenant y el
  // filtro de errores mueren con un 500. Hay que devolvérselo a mano.
  mountClsContextForRootPaths(app);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  app.get(Logger).log(`API escuchando en http://localhost:${port}/api/v1`, "Bootstrap");
}

void bootstrap();
