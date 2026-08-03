import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTrustedOrigins, resolveTrustedOrigins } from "./better-auth.config.js";

/**
 * La lista viaja en una variable de entorno, así que llega como texto suelto:
 * espacios de más al copiarla de un panel de despliegue, una coma final, o la
 * variable declarada pero vacía. Ninguna de esas formas puede acabar en un
 * origen `""` dentro de la lista de confianza —Better Auth compara cadenas, y
 * una vacía no encaja con nada, pero deja la lista pareciendo configurada.
 */
describe("parseTrustedOrigins", () => {
  it("parte la lista por comas y quita los espacios", () => {
    expect(parseTrustedOrigins("http://localhost:5173, https://panel.langopia.app")).toEqual([
      "http://localhost:5173",
      "https://panel.langopia.app",
    ]);
  });

  it("descarta entradas vacías en vez de confiar en una cadena vacía", () => {
    expect(parseTrustedOrigins("https://panel.langopia.app,, ,")).toEqual([
      "https://panel.langopia.app",
    ]);
  });

  it("sin variable, usa el servidor de desarrollo del panel", () => {
    expect(parseTrustedOrigins(undefined)).toEqual(["http://localhost:5173"]);
  });

  it("una variable declarada pero vacía no deja la lista sin orígenes", () => {
    expect(parseTrustedOrigins("   ")).toEqual(["http://localhost:5173"]);
  });
});

describe("resolveTrustedOrigins", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("en producción confía en los dominios propios de Langopia y sus subdominios", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "");

    expect(resolveTrustedOrigins()).toEqual(
      expect.arrayContaining([
        "https://langopia.com",
        ".langopia.com",
        "https://www.langopia.com",
        "https://langopia.app",
        ".langopia.app",
      ]),
    );
  });

  it("en producción mezcla los orígenes declarados en la variable de entorno", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://partner.langopia.app");

    expect(resolveTrustedOrigins()).toEqual(
      expect.arrayContaining([
        "https://langopia.com",
        ".langopia.com",
        "https://www.langopia.com",
        "https://langopia.app",
        ".langopia.app",
        "https://partner.langopia.app",
      ]),
    );
  });

  it("en producción confía en el origen exacto del panel cuando se declara", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://panel.langopia.app,https://www.langopia.com");

    expect(resolveTrustedOrigins()).toEqual(
      expect.arrayContaining([
        "https://langopia.com",
        ".langopia.com",
        "https://www.langopia.com",
        "https://langopia.app",
        ".langopia.app",
        "https://panel.langopia.app",
      ]),
    );
  });

  it("en preview devuelve solo los orígenes declarados en la variable", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://preview.langopia.com");

    expect(resolveTrustedOrigins()).toEqual(["https://preview.langopia.com"]);
  });

  it("en desarrollo conserva el fallback localhost si no hay variable", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "");

    expect(resolveTrustedOrigins()).toEqual(["http://localhost:5173"]);
  });
});
