import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgendaEntry } from "@langopia/contracts";
import { api, ApiError, getSchoolSlug, setSchoolSlug } from "./api-client.ts";

/**
 * Fabrica una `Response` mínima. El cliente solo lee `ok`, `status`,
 * `statusText` y `json()` — nunca cabeceras de la respuesta ni el cuerpo
 * crudo —, así que no hace falta una `Response` de verdad.
 */
function fakeResponse(init: {
  status: number;
  ok: boolean;
  statusText?: string;
  body?: unknown;
  jsonError?: unknown;
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? "",
    json: init.jsonError
      ? () => Promise.reject(init.jsonError)
      : () => Promise.resolve(init.body),
  } as Response;
}

describe("api-client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.documentElement.lang = "es-ES";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setSchoolSlug(undefined);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    setSchoolSlug(undefined);
    localStorage.clear();
  });

  it("una respuesta 200 devuelve los datos ya tipados", async () => {
    const agenda: AgendaEntry[] = [
      {
        sessionId: "11111111-1111-1111-1111-111111111111",
        groupId: "22222222-2222-2222-2222-222222222222",
        groupName: "B1 tardes",
        courseCode: "ES-B1",
        teacherId: "33333333-3333-3333-3333-333333333333",
        teacherName: "Carla Ruiz",
        start: "2026-07-27T09:00:00.000Z",
        end: "2026-07-27T10:00:00.000Z",
        status: "scheduled",
        roomProvider: "zoom",
        roomUrl: "https://zoom.example/1",
        topic: null,
        enrolledStudents: 6,
      },
    ];
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: agenda }));

    const result = await api.get<AgendaEntry[]>("/scheduling/agenda?from=2026-07-27&to=2026-08-03");

    expect(result).toEqual(agenda);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/scheduling/agenda?from=2026-07-27&to=2026-08-03",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("un 4xx en formato Problem Details lanza ApiError con code, title, params y traceId", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 409,
        body: {
          type: "https://langopia.app/errors/teacher_overlap",
          title: "El profesor ya tiene otra clase a esa hora.",
          status: 409,
          code: "teacher_overlap",
          instance: "/api/v1/scheduling/sessions",
          traceId: "trace-409",
          params: { teacherId: "33333333-3333-3333-3333-333333333333" },
        },
      }),
    );

    const failure = api.post("/scheduling/sessions", { groupId: "g1" });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    try {
      await failure;
      throw new Error("no debería llegar aquí");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.code).toBe("teacher_overlap");
      expect(apiError.problem.title).toBe("El profesor ya tiene otra clase a esa hora.");
      expect(apiError.problem.params).toEqual({
        teacherId: "33333333-3333-3333-3333-333333333333",
      });
      expect(apiError.traceId).toBe("trace-409");
    }
  });

  it("un 403 con code 'missing_tenant' redirige al inicio de sesión", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 403,
        body: {
          title: "No perteneces a ninguna escuela.",
          status: 403,
          code: "missing_tenant",
          traceId: "trace-403",
        },
      }),
    );
    // `Location.assign` es una propiedad propia no configurable en jsdom (como
    // en un navegador real): no se puede espiar sin más, hay que sustituir el
    // objeto `location` entero. Se restaura en el `afterEach`.
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
    });

    try {
      await expect(api.get("/scheduling/agenda")).rejects.toMatchObject({ code: "missing_tenant" });
      expect(assignSpy).toHaveBeenCalledWith("/entrar");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("un fallo de red lanza ApiError con code 'network_error' y mensaje traducible", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const failure = api.get("/scheduling/agenda");

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    try {
      await failure;
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.code).toBe("network_error");
      expect(apiError.problem.title.length).toBeGreaterThan(0);
      expect(apiError.problem.title).not.toBe("network_error");
    }
    expect(consoleErrorSpy).toHaveBeenCalledWith("fallo de red", expect.anything());
  });

  it("un cuerpo de error ilegible NO se descarta: se registra y se lanza con el status", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ ok: false, status: 500, jsonError: new SyntaxError("Unexpected end of JSON input") }),
    );

    const failure = api.get("/scheduling/agenda");

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    try {
      await failure;
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.problem.status).toBe(500);
      expect(apiError.code).toBe("unknown_error");
    }
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "respuesta sin JSON válido",
      expect.objectContaining({ status: 500 }),
    );
  });

  it("la cabecera Accept-Language se envía con el locale activo", async () => {
    document.documentElement.lang = "de-DE";
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: [] }));

    await api.get("/scheduling/agenda");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Accept-Language"]).toBe("de-DE");
  });

  it("el traceId de la respuesta llega al ApiError, para poder pedirlo en soporte", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 409,
        body: {
          title: "Ya existe un registro con ese valor.",
          status: 409,
          code: "unique_violation",
          traceId: "1b8f9e3a-support-me",
        },
      }),
    );

    try {
      await api.patch("/catalog/courses/1", { name: "x" });
      throw new Error("no debería llegar aquí");
    } catch (error) {
      expect((error as ApiError).traceId).toBe("1b8f9e3a-support-me");
    }
  });

  it("sin escuela elegida, la petición no manda x-school-slug (Tarea 3)", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: [] }));

    await api.get("/scheduling/agenda");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-school-slug"]).toBeUndefined();
  });

  it("con una escuela elegida, todas las peticiones siguientes mandan x-school-slug (Tarea 3, Paso 5)", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: [] }));

    setSchoolSlug("atlantico");
    expect(getSchoolSlug()).toBe("atlantico");
    await api.get("/scheduling/agenda");
    await api.post("/scheduling/sessions", {});

    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect((init.headers as Record<string, string>)["x-school-slug"]).toBe("atlantico");
    }
  });

  it("la escuela elegida sobrevive a una recarga: se guarda y se recupera de localStorage", async () => {
    setSchoolSlug("paulista");
    // Simula una recarga: el módulo se re-evalúa y su estado en memoria se
    // pierde, pero `localStorage` no. No se puede reimportar el módulo real
    // sin recargar `vitest`, así que se comprueba lo que sí es observable
    // desde fuera: el valor quedó escrito donde `setSchoolSlug` lo lee al
    // arrancar.
    expect(localStorage.getItem("langopia:school-slug")).toBe("paulista");

    setSchoolSlug(undefined);
    expect(localStorage.getItem("langopia:school-slug")).toBeNull();
  });

  it("un error de Better Auth sin 'title' (solo 'message') no se enseña como el statusText genérico", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
      }),
    );

    try {
      await api.post("/auth/sign-in/email", { email: "x@example.com", password: "bad" });
      throw new Error("no debería llegar aquí");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.problem.title).toBe("Invalid email or password");
      expect(apiError.problem.title).not.toBe("Unauthorized");
    }
  });
});
