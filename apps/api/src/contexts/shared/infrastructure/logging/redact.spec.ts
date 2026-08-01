import { describe, expect, it } from "vitest";
import { redact, redactSerialized, SENSITIVE_KEYS } from "./redact.js";

describe("redact", () => {
  it("enmascara las claves sensibles sobre un objeto anidado", () => {
    const input = {
      msg: "clase programada",
      traceId: "01K2Q",
      student: {
        name: "Marta",
        email: "marta.colomer@atlantico.example",
        phone: "+34 600 000 000",
        dateOfBirth: "2014-03-02",
        guardian: {
          email: "guardian@example.com",
          consent: { token: "abc123" },
        },
      },
      billing: {
        stripeCustomerId: "cus_123",
        stripePaymentMethod: "pm_456",
      },
      request: {
        headers: {
          cookie: "session=abc",
          authorization: "Bearer xyz",
          "content-type": "application/json",
        },
        body: { password: "hunter2" },
      },
      history: [{ email: "a@example.com" }, { email: "b@example.com" }],
    };

    const output = redact(input);

    expect(output).toEqual({
      msg: "clase programada",
      traceId: "01K2Q",
      student: {
        name: "Marta",
        email: "[REDACTADO]",
        phone: "[REDACTADO]",
        dateOfBirth: "[REDACTADO]",
        guardian: {
          email: "[REDACTADO]",
          consent: { token: "[REDACTADO]" },
        },
      },
      billing: {
        stripeCustomerId: "[REDACTADO]",
        stripePaymentMethod: "[REDACTADO]",
      },
      request: {
        headers: {
          cookie: "[REDACTADO]",
          authorization: "[REDACTADO]",
          "content-type": "application/json",
        },
        body: { password: "[REDACTADO]" },
      },
      history: [{ email: "[REDACTADO]" }, { email: "[REDACTADO]" }],
    });
  });

  it("no toca claves que no están en la lista", () => {
    const input = { schoolId: "atlantico", membershipId: "m1", durationMs: 34, code: "ok" };
    expect(redact(input)).toEqual(input);
  });

  it("distingue mayúsculas y minúsculas: Email, PASSWORD... también cuentan", () => {
    const input = { Email: "a@example.com", PASSWORD: "x", Token: "y" };
    expect(redact(input)).toEqual({
      Email: "[REDACTADO]",
      PASSWORD: "[REDACTADO]",
      Token: "[REDACTADO]",
    });
  });

  it("no muta el objeto original", () => {
    const input = { email: "a@example.com" };
    redact(input);
    expect(input.email).toBe("a@example.com");
  });

  it("deja pasar valores primitivos, null y arrays vacíos", () => {
    expect(redact("hola")).toBe("hola");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact([])).toEqual([]);
  });

  /**
   * Reproduce en miniatura lo que tumbó la API real al verificar en vivo: el
   * `res` que Pino pasa a `formatters.log` en la línea automática de fin de
   * petición es el `ServerResponse` de Node sin serializar todavía —con
   * referencias circulares de verdad (`res.socket._httpMessage === res`)—,
   * no un objeto de negocio. Recorrerlo entero como si fuera un objeto plano
   * causaba `RangeError: Maximum call stack size exceeded` y se llevaba por
   * delante el proceso entero.
   */
  it("no revienta con una referencia circular", () => {
    const nodo: Record<string, unknown> = { email: "a@example.com" };
    nodo.self = nodo;

    expect(() => redact(nodo)).not.toThrow();
    const salida = redact(nodo) as Record<string, unknown>;
    expect(salida.email).toBe("[REDACTADO]");
    expect(salida.self).toBe("[REF-CIRCULAR]");
  });

  it("deja tal cual una instancia de clase: no es un objeto plano", () => {
    class Token {
      constructor(readonly password: string) {}
    }
    const instancia = new Token("hunter2");

    // Se devuelve la MISMA referencia, sin tocar: no es una bolsa de
    // propiedades arbitraria como el cuerpo de una petición, sino un tipo
    // con su propio significado (aquí, deliberadamente, uno con un campo que
    // SERÍA sensible si fuera un objeto plano — la prueba de que la regla es
    // «solo objetos planos», no «solo lo que no es sensible»).
    expect(redact(instancia)).toBe(instancia);
  });

  it("deja pasar Error y Date sin tocarlos", () => {
    const error = new Error("password=hunter2");
    const fecha = new Date("2026-07-27");
    expect(redact(error)).toBe(error);
    expect(redact(fecha)).toBe(fecha);
  });

  it("no crece sin límite con un objeto anidado en exceso", () => {
    let profundo: Record<string, unknown> = { email: "hoja@example.com" };
    for (let i = 0; i < 100; i++) profundo = { nested: profundo };

    expect(() => redact(profundo)).not.toThrow();
  });
});

/* ─── Simetría petición ↔ respuesta ────────────────────────────────────── */

/**
 * El fallo que motivó esta batería: `cookie` (petición) estaba en la lista y
 * `set-cookie` (respuesta) no. Cada inicio de sesión escribía en el registro
 * `better-auth.session_token=…; Max-Age=604800`, es decir la cookie de sesión
 * entera, reutilizable durante siete días por cualquiera que leyera los logs.
 * La asimetría es justo lo que lo hacía pasar inadvertido: mirando la lista
 * parecía que las cookies estaban cubiertas.
 *
 * Las parejas se declaran aquí para que añadir un lado sin el otro vuelva a
 * fallar en las pruebas y no en producción.
 */
const PAREJAS: ReadonlyArray<readonly [peticion: string, respuesta: string]> = [
  ["cookie", "set-cookie"],
  ["authorization", "proxy-authorization"],
];

describe("simetría entre lo que se redacta en la petición y en la respuesta", () => {
  for (const [peticion, respuesta] of PAREJAS) {
    it(`redacta «${peticion}» y también «${respuesta}»`, () => {
      expect(SENSITIVE_KEYS.has(peticion)).toBe(true);
      expect(SENSITIVE_KEYS.has(respuesta)).toBe(true);
    });
  }

  it("enmascara la cookie de sesión que devuelve un inicio de sesión", () => {
    const salida = redact({
      res: {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": [
            "better-auth.session_token=xK9s.abc123; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
          ],
        },
      },
    }) as { res: { headers: Record<string, unknown> } };

    expect(salida.res.headers["set-cookie"]).toBe("[REDACTADO]");
    expect(JSON.stringify(salida)).not.toContain("session_token");
    expect(salida.res.headers["content-type"]).toBe("application/json");
  });
});

/* ─── El otro camino: los serializadores de `req`/`res` ────────────────── */

/**
 * `formatters.log` no es el único sitio por el que Pino recibe datos. La línea
 * automática de fin de petición trae `req`/`res` como «chindings»
 * pre-serializadas por `pino-std-serializers`, que usa su propio prototipo
 * interno — y `redact` ignora a propósito todo lo que no sea un objeto plano
 * (ver su documentación). Sin `redactSerialized` en medio, esa línea salía sin
 * redactar aunque `redact` funcionara perfectamente en todo lo demás.
 *
 * Estas pruebas reproducen esa forma exacta: `Object.create(proto)` con
 * `headers` colgando, no un literal.
 */
describe("redactSerialized", () => {
  const conPrototipoAjeno = (props: Record<string, unknown>): unknown =>
    Object.assign(Object.create({ marca: "pino-std-serializers" }), props);

  it("enmascara set-cookie en la respuesta ya serializada", () => {
    const res = conPrototipoAjeno({
      statusCode: 200,
      headers: {
        "set-cookie": ["better-auth.session_token=xK9s.abc123; Max-Age=604800; HttpOnly"],
      },
    });

    const salida = redactSerialized(res) as { statusCode: number; headers: Record<string, unknown> };

    expect(salida.statusCode).toBe(200);
    expect(salida.headers["set-cookie"]).toBe("[REDACTADO]");
    expect(JSON.stringify(salida)).not.toContain("session_token");
  });

  it("enmascara cookie y authorization en la petición ya serializada", () => {
    const req = conPrototipoAjeno({
      method: "POST",
      url: "/api/v1/auth/sign-in/email",
      headers: {
        cookie: "better-auth.session_token=xK9s.abc123",
        authorization: "Bearer secreto",
        "user-agent": "curl/8.0",
      },
    });

    const salida = redactSerialized(req) as { headers: Record<string, unknown> };

    expect(salida.headers.cookie).toBe("[REDACTADO]");
    expect(salida.headers.authorization).toBe("[REDACTADO]");
    expect(salida.headers["user-agent"]).toBe("curl/8.0");
  });
});
