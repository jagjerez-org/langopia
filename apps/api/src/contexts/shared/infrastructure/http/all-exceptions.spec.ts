import { BadRequestException, HttpStatus, type ArgumentsHost } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { DomainError, type DomainErrorKind } from "../../domain/errors/domain-error.js";
import { CLS_LOCALE, CLS_TRACE_ID } from "../tenant/cls-tenant-context.js";
import { AllExceptionsFilter } from "./all-exceptions.filter.js";

/**
 * `DomainError` con `code`/`kind` parametrizables por parámetro de
 * constructor: como el compilador no ve `readonly code = "..."` como texto
 * literal (es una propiedad de parámetro, se asigna en tiempo de ejecución),
 * `i18n-coverage.spec.ts` no la confunde con un error de dominio real que
 * necesite traducción propia. Permite probar cualquier combinación —incluida
 * un código que no existe en el catálogo— sin tocar el catálogo real.
 */
class TestDomainError extends DomainError {
  constructor(
    readonly code: string,
    readonly kind: DomainErrorKind,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, details);
  }
}

function mockHost(options: { locale?: string; url?: string } = {}) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status } as unknown as Response;
  const request = {
    originalUrl: options.url ?? "/api/v1/scheduling/sessions",
  } as unknown as Request;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function bodyFrom(json: ReturnType<typeof vi.fn>) {
  return json.mock.calls[0]![0];
}

/**
 * Un `ClsService` de mentira que sí recuerda lo que se le guarda: el filtro,
 * desde la Tarea 8c, hace `cls.set(CLS_TRACE_ID, ...)` cuando no encuentra ya
 * uno (petición que nunca pasó por `SessionTenantGuard`), y un mock que
 * ignorara `set` dejaría ese camino sin probar de verdad.
 */
function makeCls(locale: string | undefined, active = true) {
  const store = new Map<string, unknown>();
  if (locale !== undefined) store.set(CLS_LOCALE, locale);
  return {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: unknown) => store.set(key, value)),
    isActive: vi.fn(() => active),
    runWith: vi.fn(<T>(_store: unknown, callback: () => T) => callback()),
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFilter(locale: string | undefined, active = true) {
  const cls = makeCls(locale, active);
  const logger = makeLogger();
  const filter = new AllExceptionsFilter(cls as never, logger as never);
  return { filter, cls, logger };
}

describe("AllExceptionsFilter", () => {
  it("un DomainError sale con su code y el status de su kind", () => {
    const { filter } = makeFilter("es-ES");
    const { host, status, json } = mockHost();

    filter.catch(new TestDomainError("not_found", "not_found", "no existe"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(bodyFrom(json)).toMatchObject({ code: "not_found", status: HttpStatus.NOT_FOUND });
  });

  it("el título llega traducido al idioma del solicitante", () => {
    const { filter } = makeFilter("en-GB");
    const { host, json } = mockHost();

    filter.catch(
      new TestDomainError("teacher_not_available", "invariant_violation", "no disponible"),
      host,
    );

    expect(bodyFrom(json).title).toMatch(/no declared availability/i);
  });

  it("el título llega interpolado, sin marcadores sueltos", () => {
    const { filter } = makeFilter("es-ES");
    const { host, json } = mockHost();

    filter.catch(
      new TestDomainError("concurrency_conflict", "conflict", "mensaje de reserva", {
        resource: "ClassSession",
        id: "abc-123",
      }),
      host,
    );

    const { title } = bodyFrom(json);
    expect(title).toContain("ClassSession");
    expect(title).toContain("abc-123");
    expect(title).not.toContain("{");
  });

  it("params viaja aparte para que el panel pueda traducir por su cuenta", () => {
    const { filter } = makeFilter("es-ES");
    const { host, json } = mockHost();

    filter.catch(
      new TestDomainError("concurrency_conflict", "conflict", "mensaje de reserva", {
        resource: "ClassSession",
        id: "abc-123",
      }),
      host,
    );

    expect(bodyFrom(json).params).toEqual({ resource: "ClassSession", id: "abc-123" });
  });

  it("un code sin traducción cae al idioma por defecto, no al code crudo", () => {
    const { filter } = makeFilter("en-GB");
    const { host, json } = mockHost();

    filter.catch(
      new TestDomainError("codigo_que_no_existe_en_el_catalogo", "conflict", "mensaje de reserva"),
      host,
    );

    const { title } = bodyFrom(json);
    expect(title).toBe("mensaje de reserva");
    expect(title).not.toBe("codigo_que_no_existe_en_el_catalogo");
  });

  it("un error de validación devuelve errors[] por campo", () => {
    const { filter } = makeFilter("es-ES");
    const { host, status, json } = mockHost();

    filter.catch(
      new BadRequestException({
        message: "validation_failed",
        errors: [{ field: "groupId", message: "groupId must be a UUID" }],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(bodyFrom(json)).toMatchObject({
      code: "validation_failed",
      errors: [{ field: "groupId", message: "groupId must be a UUID" }],
    });
  });

  it("una violación de unicidad de Postgres es 409, no 500", () => {
    const { filter } = makeFilter("es-ES");
    const { host, status, json } = mockHost();

    const pgError = Object.assign(
      new Error('duplicate key value violates unique constraint "schools_slug_key"'),
      { code: "23505", table: "schools", constraint: "schools_slug_key" },
    );

    filter.catch(pgError, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const body = bodyFrom(json);
    expect(body.code).toBe("unique_violation");
    expect(JSON.stringify(body)).not.toContain("schools_slug_key");
  });

  /**
   * Reproduce un fallo real, encontrado al verificar la Tarea 4 (`catalog`)
   * contra Postgres de verdad: una violación de unicidad lanzada por una
   * consulta del generador de Drizzle (`.insert(...)`) no llega como el
   * `PostgresError` crudo, sino envuelta en `DrizzleQueryError`, con el
   * SQLSTATE de verdad en `.cause`. Sin desenvolverlo, `postgresErrorCode`
   * no encontraba `code` en el objeto de arriba y todo caía a 500 genérico.
   * El caso de arriba (`pgError` plano) no lo detectaba porque no reproduce
   * la forma real que entrega Drizzle.
   */
  it("una violación de unicidad envuelta en DrizzleQueryError también es 409, no 500", () => {
    const { filter } = makeFilter("es-ES");
    const { host, status, json } = mockHost();

    const causaReal = Object.assign(
      new Error('duplicate key value violates unique constraint "courses_school_code_uq"'),
      { code: "23505", table: "courses", constraint: "courses_school_code_uq" },
    );
    const drizzleQueryError = Object.assign(new Error("Failed query: insert into courses..."), {
      name: "DrizzleQueryError",
      cause: causaReal,
    });

    filter.catch(drizzleQueryError, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const body = bodyFrom(json);
    expect(body.code).toBe("unique_violation");
    expect(JSON.stringify(body)).not.toContain("courses_school_code_uq");
  });

  /**
   * 23514 faltaba en el mapa, y el hueco tenía dueño: el disparador que hacía
   * inmutable `users.email` levantaba exactamente ese SQLSTATE, así que
   * cualquier pantalla de edición de perfil que tocara el correo recibía un
   * 500 opaco en vez de un 400 que se pudiera enseñar. El disparador ya no
   * existe, pero las restricciones `CHECK` sí.
   */
  it("una violación de CHECK de Postgres es 400, no 500", () => {
    const { filter } = makeFilter("es-ES");
    const { host, status, json } = mockHost();

    const pgError = Object.assign(
      new Error('new row for relation "users" violates check constraint "users_locale_check"'),
      { code: "23514", table: "users", constraint: "users_locale_check" },
    );

    filter.catch(pgError, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = bodyFrom(json);
    expect(body.code).toBe("check_violation");
    // Ni la tabla ni el nombre de la restricción salen al cliente.
    expect(JSON.stringify(body)).not.toContain("users_locale_check");
  });

  it("un error desconocido NO filtra su mensaje al cliente", () => {
    const { filter } = makeFilter("es-ES");
    const { host, status, json } = mockHost();

    filter.catch(new Error("password=hunter2 en SELECT * FROM secretos"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = bodyFrom(json);
    expect(body.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(body.traceId).toBeTruthy();
  });

  it("un error desconocido SÍ queda registrado entero con su stack", () => {
    const { filter, logger } = makeFilter("es-ES");
    const { host } = mockHost();

    const error = new Error("password=hunter2 en SELECT * FROM secretos");
    filter.catch(error, host);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [fields, message] = logger.error.mock.calls[0]!;
    expect(message).toContain("hunter2");
    expect(fields.err).toBe(error);
  });

  it("toda respuesta de error lleva traceId, y es el mismo que ve el registro", () => {
    const { filter, cls } = makeFilter("es-ES");
    const casos: unknown[] = [
      new TestDomainError("not_found", "not_found", "no existe"),
      new BadRequestException({ message: "validation_failed", errors: [] }),
      Object.assign(new Error("duplicado"), { code: "23505" }),
      new Error("boom"),
    ];

    for (const error of casos) {
      const { host, json } = mockHost();
      filter.catch(error, host);
      const traceId = bodyFrom(json).traceId;
      expect(traceId).toEqual(expect.any(String));
      expect(traceId.length).toBeGreaterThan(0);
      // Es EL MISMO que queda en CLS: el `mixin` del logger (Tarea 8c) lo
      // lee de ahí para pegarlo a la línea, así que si no coincidieran la
      // respuesta y el registro tendrían identificadores distintos.
      expect(cls.get(CLS_TRACE_ID)).toBe(traceId);
    }
  });

  /**
   * Reproduce el fallo real de Vercel: rutas excluidas del middleware de
   * `nestjs-cls` (OAuth en raíz, `/favicon.ico`, rutas no reconocidas) no
   * tienen contexto CLS activo. Sin el guarda, `cls.set(CLS_TRACE_ID, ...)`
   * lanzaba «No CLS context available» y Express devolvía un 500 pelado.
   */
  it("sin contexto CLS activo entra en runWith y sigue devolviendo problem details", () => {
    const { filter, cls } = makeFilter("es-ES", false);
    const { host, status, json } = mockHost({ url: "/favicon.ico" });

    filter.catch(new Error("boom fuera de CLS"), host);

    expect(cls.isActive).toHaveBeenCalledTimes(1);
    expect(cls.runWith).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = bodyFrom(json);
    expect(body.code).toBe("internal_error");
    expect(body.traceId).toBeTruthy();
  });
});
