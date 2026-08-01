import { Global, Module } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import pino from "pino";
import type { Options } from "pino-http";
import {
  CLS_MEMBERSHIP_ID,
  CLS_SCHOOL_ID,
  CLS_TRACE_ID,
} from "../tenant/cls-tenant-context.js";
import { redact, redactSerialized } from "./redact.js";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Logger único de la API, con Pino (`nestjs-pino`).
 *
 * Una sola configuración para toda la aplicación: JSON en producción —lo que
 * sabe leer un agregador—, `pino-pretty` en desarrollo —que es cuando lo lee
 * un humano—. Se inyecta en todas partes con `PinoLogger`/`@InjectPinoLogger`
 * en vez de `new Logger(...)`: así el `context` de cada línea es la clase que
 * registra, y no hace falta repetirlo a mano en cada llamada.
 *
 * `mixin` es lo que hace que TODO evento comparta `traceId`, `schoolId` y
 * `membershipId` sin que cada sitio que registra algo tenga que pasarlos —los
 * lee de CLS, junto al resto del contexto de tenant, en el momento de
 * escribir la línea. Es el mismo mecanismo tanto si el evento lo genera un
 * caso de uso como si lo genera `AllExceptionsFilter`, así que ambos acaban
 * compartiendo identificador sin coordinarse.
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ClsService],
      useFactory: (cls: ClsService): { pinoHttp: Options } => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? "debug",
          transport: isProduction
            ? undefined
            : {
                target: "pino-pretty",
                options: {
                  singleLine: false,
                  translateTime: "HH:MM:ss.l",
                  // `context` va ya dentro de `messageFormat`: repetirlo
                  // como campo suelto en la línea de abajo es ruido.
                  ignore: "pid,hostname,context",
                  messageFormat: "[{context}] {msg}",
                },
              },
          // Los mismos tres campos en cada línea, la haya escrito quien la
          // haya escrito: sin esto, un `catch` en `billing` y un 403 de
          // `scheduling` no comparten ni el nombre de columna con el que
          // buscarlos juntos.
          mixin: () => ({
            traceId: cls.get<string | undefined>(CLS_TRACE_ID),
            schoolId: cls.get<string | undefined>(CLS_SCHOOL_ID),
            membershipId: cls.get<string | undefined>(CLS_MEMBERSHIP_ID),
          }),
          // La única línea que no escribe una clase inyectada con
          // `@InjectPinoLogger` es la automática de fin de petición: le hace
          // falta su propio `context` para no romper la uniformidad.
          customProps: () => ({ context: "http" }),
          // `responseTime` es el nombre que usa `pino-http`; `durationMs` es
          // el que pide el brief, y el mismo que usa cualquier evento que
          // mida cuánto tardó algo.
          customAttributeKeys: { responseTime: "durationMs" },
          serializers: {
            err: pino.stdSerializers.err,
            req: redactSerialized,
            res: redactSerialized,
          },
          formatters: {
            // Nivel como texto (`info`, `warn`...) y no como número: es lo
            // que se busca en un agregador, no el código interno de Pino.
            level: (label) => ({ level: label }),
            // Redacción real, recursiva, por nombre de clave — no por ruta
            // fija: cualquier campo sensible que aparezca en CUALQUIER
            // objeto que alguien registre (el cuerpo de una petición, un
            // error con `details`...) se enmascara aquí, no solo en
            // `req.headers`.
            log: (object) => redact(object) as Record<string, unknown>,
          },
        },
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
