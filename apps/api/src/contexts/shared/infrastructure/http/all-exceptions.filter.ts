import {
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import type { Request, Response } from "express";
import { DomainError, type DomainErrorKind } from "../../domain/errors/domain-error.js";
import { CLS_LOCALE, CLS_TRACE_ID } from "../tenant/cls-tenant-context.js";
import { resolveLocale, type Locale } from "../i18n/locale.resolver.js";
import { translateError } from "../i18n/messages.js";
import { buildProblemDetails, type FieldError, type ProblemDetails } from "./problem-details.js";

/**
 * Traduce un `DomainErrorKind` a un status HTTP.
 *
 * Este es el único punto del sistema que sabe que existen los códigos HTTP.
 * El dominio lanza `SessionAlreadyClosedError`; que eso sea un 409 y no un
 * 400 es una decisión de esta capa, y cambiarla no toca ni una regla de
 * negocio. Ningún `kind` produce un 5xx a propósito: un error de dominio,
 * por definición, es algo que la aplicación ya entendía que podía pasar.
 */
const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  invalid_input: HttpStatus.BAD_REQUEST,
  invariant_violation: HttpStatus.CONFLICT,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
};

/**
 * Errores de Postgres con un código SQLSTATE conocido.
 *
 * Se modelan como `DomainError` locales —igual que hacen los guardias de
 * `iam`, que definen los suyos justo donde los lanzan— para reutilizar sin
 * duplicar ni el mapa `kind → status` ni `translateError`. Sus mensajes son
 * genéricos a propósito: lo único que el cliente necesita saber es «ya
 * existe» o «esa referencia no es válida», nunca qué tabla o restricción
 * de Postgres lo dice. Eso solo va al registro, con el error original.
 */
export class UniqueViolationError extends DomainError {
  readonly code = "unique_violation";
  readonly kind = "conflict" as const;
  constructor() {
    super("Ya existe un registro con ese valor.");
  }
}

export class ForeignKeyViolationError extends DomainError {
  readonly code = "foreign_key_violation";
  readonly kind = "conflict" as const;
  constructor() {
    super("La operación hace referencia a algo que no existe o que todavía está en uso.");
  }
}

export class InvalidTextRepresentationError extends DomainError {
  readonly code = "invalid_text_representation";
  readonly kind = "invalid_input" as const;
  constructor() {
    super("Uno de los valores enviados no tiene el formato esperado.");
  }
}

/**
 * `check_violation` (23514): una restricción `CHECK` o un disparador que
 * levanta ese SQLSTATE.
 *
 * Faltaba, y se notó: el disparador que hacía inmutable `users.email` lanzaba
 * exactamente este código, así que cualquier intento de editar un correo salía
 * como 500 opaco —«ha ocurrido un error inesperado»— en vez de decir que el
 * dato no vale. Ese disparador ya no existe, pero la restricción `CHECK` es
 * una herramienta que se va a seguir usando y el 500 no debe volver por la
 * puerta de atrás.
 *
 * Es `invalid_input` (400) y no `conflict`: no hay dos versiones de nada
 * chocando, hay un valor que la base de datos no admite.
 */
export class CheckViolationError extends DomainError {
  readonly code = "check_violation";
  readonly kind = "invalid_input" as const;
  constructor() {
    super("Uno de los valores enviados no cumple una restricción de los datos.");
  }
}

/** SQLSTATE → constructor del `DomainError` que lo representa. */
const POSTGRES_ERRORS: Record<string, () => DomainError> = {
  "23505": () => new UniqueViolationError(),
  "23503": () => new ForeignKeyViolationError(),
  "23514": () => new CheckViolationError(),
  "22P02": () => new InvalidTextRepresentationError(),
};

/**
 * `drizzle-orm` envuelve el error real del controlador en `DrizzleQueryError`
 * cuando la consulta viene de su generador (`.insert()`, `.select()`...): el
 * SQLSTATE que buscamos queda en `.cause`, no en el propio objeto. Sin
 * desenvolverlo, toda violación de una restricción lanzada por una consulta
 * de Drizzle —a diferencia de un `db.execute(sql\`...\`)` con el cliente
 * `postgres` crudo, que sí trae `.code` directo— salía como 500 genérico en
 * vez del 409/400 que le corresponde. Se recorre `.cause` recursivamente
 * porque el encadenado de errores nativo de `Error.cause` no tiene un límite
 * fijo de niveles.
 */
function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = "code" in error ? (error as { code: unknown }).code : undefined;
  if (typeof code === "string" && code in POSTGRES_ERRORS) return code;
  return "cause" in error ? postgresErrorCode((error as { cause: unknown }).cause) : undefined;
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** `errors[]` por campo, cuando el `ValidationPipe` de `main.ts` los da estructurados. */
function fieldErrorsFrom(response: unknown): FieldError[] {
  if (
    typeof response === "object" &&
    response !== null &&
    "errors" in response &&
    Array.isArray((response as { errors: unknown }).errors)
  ) {
    return (response as { errors: FieldError[] }).errors;
  }
  return [];
}

/** Nivel de registro, con los nombres de método que usa `PinoLogger`. */
type Level = "info" | "warn" | "error";

/** 5xx siempre es `error`; el resto, `warn`, salvo un 404 —lectura sin más— que es informativo. */
function levelFor(status: number): Level {
  if (status >= 500) return "error";
  if (status === HttpStatus.NOT_FOUND) return "info";
  return "warn";
}

/**
 * Único punto de la API que produce una respuesta de error.
 *
 * `@Catch()` sin argumentos: nada se le escapa. Cuatro familias, y las
 * cuatro salen con el mismo formato (RFC 9457) y quedan registradas —nunca
 * una respuesta sin rastro en el log, nunca un detalle interno filtrado al
 * cliente.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly cls: ClsService,
    @InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger,
  ) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    // El tenant no siempre llega a fijar `CLS_LOCALE` —una petición pública,
    // sin sesión, o a `/api/v1/auth`, nunca pasa por ahí—. El idioma sale
    // siempre del contexto de la petición, nunca de una constante: si no hay
    // nada en CLS, se negocia igual que haría el guardia, solo que con la
    // cabecera de ESTA petición y sin persona ni escuela que aportar.
    const locale =
      this.cls.get<Locale | undefined>(CLS_LOCALE) ??
      resolveLocale({ user: null, school: null, header: headerValue(request, "accept-language") });
    const instance = request.originalUrl ?? request.url;
    // Tarea 8c: `SessionTenantGuard` ya fijó este id en CLS para CUALQUIER
    // petición que pase por él —es lo primero que hace—, así que la línea
    // que se registra aquí abajo y la que registró el caso de uso comparten
    // el mismo `traceId` sin coordinarse. El `randomUUID()` de reserva solo
    // cubre el caso residual de una petición que no llegó a pasar por
    // ningún guardia (una ruta que Nest no reconoce, por ejemplo); se fija
    // en CLS también, para que el `mixin` del logger lo recoja en la línea
    // que se escribe más abajo.
    const traceId = this.cls.get<string | undefined>(CLS_TRACE_ID) ?? randomUUID();
    this.cls.set(CLS_TRACE_ID, traceId);

    const postgresCode = postgresErrorCode(error);

    let body: ProblemDetails;
    let level: Level;
    let logMessage: string;
    let logError: unknown;

    if (error instanceof DomainError) {
      const status = STATUS_BY_KIND[error.kind] ?? HttpStatus.BAD_REQUEST;
      body = buildProblemDetails({
        code: error.code,
        title: this.translate(error.code, locale, error.details, error.message),
        status,
        instance,
        traceId,
        params: error.details,
        details: error.details,
      });
      level = levelFor(status);
      logMessage = `${error.code}: ${error.message}`;
      logError = undefined;
    } else if (postgresCode) {
      const mapped = POSTGRES_ERRORS[postgresCode]!();
      const status = STATUS_BY_KIND[mapped.kind] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      body = buildProblemDetails({
        code: mapped.code,
        title: this.translate(mapped.code, locale, {}, mapped.message),
        status,
        instance,
        traceId,
      });
      // Tabla de la Tarea 8b: un error de Postgres se registra siempre como
      // `error`, aunque el status que ve el cliente sea 4xx. Que la
      // aplicación deje pasar hasta el driver algo que debería haber
      // rechazado antes es, en sí mismo, digno de atención.
      level = "error";
      logMessage = `postgres ${postgresCode}: ${(error as Error).message}`;
      logError = error;
    } else if (error instanceof HttpException) {
      const status = error.getStatus();
      const errors = fieldErrorsFrom(error.getResponse());
      body = buildProblemDetails({
        code: "validation_failed",
        title: this.translate("validation_failed", locale, {}, error.message),
        status,
        instance,
        traceId,
        errors,
      });
      level = levelFor(status);
      logMessage = `validation_failed: ${error.message}`;
      logError = undefined;
    } else {
      body = buildProblemDetails({
        code: "internal_error",
        title: this.translate(
          "internal_error",
          locale,
          {},
          "Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.",
        ),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        instance,
        traceId,
      });
      // Cuarta familia: al cliente, un mensaje genérico y el `traceId`; al
      // registro, la excepción entera —el objeto `Error`, no solo su
      // `.stack`—, para que el serializador de Pino la despliegue con
      // mensaje, pila y tipo. Nunca al revés.
      level = "error";
      logMessage = error instanceof Error ? error.message : String(error);
      logError = error instanceof Error ? error : new Error(String(error));
    }

    // `traceId`, `schoolId` y `membershipId` los añade el `mixin` del logger
    // (Tarea 8c) a esta y a cualquier otra línea: no hace falta repetirlos
    // aquí. Solo se adjunta lo propio de esta línea, el error real cuando lo
    // hay.
    const fields: Record<string, unknown> = logError !== undefined ? { err: logError } : {};
    this.logger[level](fields, logMessage);
    response.status(body.status).json(body);
  }

  /**
   * Red de seguridad, ya no un parche a un desajuste conocido.
   *
   * `translateError` lanza si el patrón ICU pide un parámetro que `details` no
   * trae, y devuelve algo que no es una cadena si un parámetro no es un valor
   * simple (un array, por ejemplo: `IntlMessageFormat` no lanza, devuelve un
   * array mezclando texto y el valor sin convertir, y el `as string` de
   * `translateError` lo deja pasar). Las dos cosas pasaban de verdad
   * —`teacher_overlap` y `insufficient_role`— y el efecto era el mismo:
   * caída silenciosa al mensaje en español del `super()`, es decir los cinco
   * idiomas devolviendo castellano con el catálogo aparentemente completo.
   *
   * Las dos están arregladas y `i18n-coverage.spec.ts` instancia ahora cada
   * error de dominio y lo traduce con SUS `details`, así que un desajuste
   * nuevo falla en las pruebas. Esto se queda porque el filtro no puede
   * reventar mientras construye una respuesta de error: caer al mensaje del
   * propio error es justo el diseño que documenta `messages.ts` para un
   * código sin traducción.
   */
  private translate(
    code: string,
    locale: Locale,
    params: Record<string, unknown>,
    fallback: string,
  ): string {
    try {
      const result = translateError(code, locale, params);
      // `IntlMessageFormat` no lanza cuando el parámetro no es un escalar:
      // devuelve un array mezclando texto y el valor sin convertir, y el
      // `as string` de `translateError` lo deja pasar como si fuera una
      // cadena. Se trata igual que un fallo de traducción: cae al mensaje del
      // propio error, y queda registrado para que no sea una caída muda.
      if (result !== null && typeof result !== "string") {
        throw new Error("la plantilla no produjo una cadena: algún parámetro no es un valor simple");
      }
      return result ?? fallback;
    } catch (error) {
      this.logger.warn(
        `no se pudo traducir "${code}" a "${locale}": ${(error as Error).message}`,
      );
      return fallback;
    }
  }
}
