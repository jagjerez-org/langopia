import { describe, expect, it } from "vitest";
import { parseTrustedOrigins } from "./better-auth.config.js";

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
