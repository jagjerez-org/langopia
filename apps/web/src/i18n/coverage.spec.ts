import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./locale.js";
import { DICTIONARIES } from "./dictionaries.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Todas las rutas «hoja» de un diccionario, en notación de puntos (ej. "errors.not_found"). */
function flatten(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("Paso 5b: cobertura de los cinco idiomas", () => {
  // Es lo que impide que una clave que existe en es-ES y falta en gl-ES
  // muestre castellano a quien pidió gallego: si `gl-ES.ts` se queda corto,
  // esta prueba falla en vez de dejarlo pasar en silencio.
  it("cada clave de es-ES existe en los cinco idiomas", () => {
    const reference = flatten(DICTIONARIES["es-ES"]);
    const gaps: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      const keys = new Set(flatten(DICTIONARIES[locale]));
      for (const key of reference) {
        if (!keys.has(key)) gaps.push(`${key} → ${locale}`);
      }
    }
    expect(gaps, gaps.join("\n")).toEqual([]);
  });

  it("ningún idioma tiene claves de más que es-ES no tenga", () => {
    const reference = new Set(flatten(DICTIONARIES["es-ES"]));
    const extras: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of flatten(DICTIONARIES[locale])) {
        if (!reference.has(key)) extras.push(`${key} en ${locale}`);
      }
    }
    expect(extras, extras.join("\n")).toEqual([]);
  });
});

/**
 * Fichero fuente del catálogo del backend
 * (`apps/api/src/contexts/shared/infrastructure/i18n/messages.ts`). Se lee
 * como texto, no se importa: son dos paquetes con configuraciones de módulos
 * distintas (la API compila a CommonJS con resolución `NodeNext`; el panel es
 * ESM con resolución `bundler`) y esta prueba no necesita ejecutar nada del
 * backend, solo saber qué claves declara — igual que `i18n-coverage.spec.ts`
 * del lado de la API extrae los `code` de dominio con una regex sobre el
 * código fuente en vez de instanciar cada clase.
 */
const API_MESSAGES_PATH = join(
  HERE,
  "..",
  "..",
  "..",
  "api",
  "src",
  "contexts",
  "shared",
  "infrastructure",
  "i18n",
  "messages.ts",
);

function backendErrorCodes(): Set<string> {
  const source = readFileSync(API_MESSAGES_PATH, "utf8");
  const codes = new Set<string>();
  // Cada entrada de `MESSAGES` es una propiedad de nivel superior con 2
  // espacios de indentación: `  algun_code: { ... }`. Las traducciones por
  // idioma van 2 niveles más adentro y son cadenas, no objetos, así que no
  // encajan con este patrón.
  for (const match of source.matchAll(/^ {2}(\w+): \{/gm)) codes.add(match[1]!);
  return codes;
}

/**
 * `network_error` lo genera el propio cliente HTTP del panel
 * (`apps/web/src/lib/api-client.ts`, Tarea 2) cuando `fetch` falla antes de
 * llegar a la API — un fallo de red, de DNS, de CORS... — así que nunca lo
 * manda el backend y no puede figurar en su catálogo. Es la única clave que
 * diverge a propósito entre los dos catálogos.
 */
const CLIENT_ONLY_CODES = new Set(["network_error"]);

describe("Paso 4c: las claves de error del panel no divergen del backend", () => {
  it("todo código bajo errors.* existe en el catálogo de la API (o es de solo cliente)", () => {
    const backendCodes = backendErrorCodes();
    expect(backendCodes.size).toBeGreaterThan(0); // si esto es 0, la ruta al fichero de la API se rompió

    const panelCodes = Object.keys(DICTIONARIES["es-ES"].errors);
    const unknown = panelCodes.filter((code) => !CLIENT_ONLY_CODES.has(code) && !backendCodes.has(code));
    expect(
      unknown,
      `el panel traduce estos códigos pero la API no los reconoce: ${unknown.join(", ")}`,
    ).toEqual([]);
  });
});
