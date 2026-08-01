import "reflect-metadata";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PUBLIC_KEY,
  ROLES_KEY,
} from "./contexts/shared/infrastructure/http/roles.decorator.js";

/**
 * La regla vinculante de la ola, automatizada: **toda ruta necesita anotación
 * de roles y el fallo por defecto es denegar**.
 *
 * `AuthenticatedGuard` ya deniega en tiempo de ejecución una ruta que no
 * declare nada, pero eso solo se descubre cuando alguien la llama. Esta
 * prueba lo descubre al escribirla: recorre TODOS los controladores del
 * código, mira la metadata real que dejaron los decoradores (no el texto del
 * fichero) y falla si algún manejador queda sin `@Roles(...)` ni `@Public()`,
 * ni en el método ni en su clase.
 *
 * Se lee la metadata y no el fuente a propósito: `@Roles` en la clase vale
 * para todos sus métodos, un decorador puede llegar a través de una clase
 * base, y un `grep` no sabe ninguna de las dos cosas.
 */

const CONTEXTS_DIR = join(__dirname, "contexts");

function controllerFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) output.push(...controllerFiles(path));
    else if (entry.endsWith(".controller.ts")) output.push(path);
  }
  return output;
}

type Controlador = { file: string; nombre: string; clase: new (...args: never[]) => unknown };

async function controladores(): Promise<Controlador[]> {
  const found: Controlador[] = [];
  for (const file of controllerFiles(CONTEXTS_DIR)) {
    const modulo: Record<string, unknown> = await import(file);
    for (const [nombre, exportado] of Object.entries(modulo)) {
      if (typeof exportado !== "function") continue;
      // Un controlador es lo que lleva la metadata que puso `@Controller()`.
      // El mismo fichero exporta también errores de dominio, que no la llevan.
      if (Reflect.getMetadata(PATH_METADATA, exportado) === undefined) continue;
      found.push({ file, nombre, clase: exportado as Controlador["clase"] });
    }
  }
  return found;
}

/** Métodos del prototipo que son una ruta HTTP (los marcó `@Get`, `@Post`...). */
function rutasDe(clase: Controlador["clase"]): string[] {
  const proto = clase.prototype as object;
  return Object.getOwnPropertyNames(proto).filter((nombre) => {
    if (nombre === "constructor") return false;
    const descriptor = Object.getOwnPropertyDescriptor(proto, nombre);
    if (!descriptor || typeof descriptor.value !== "function") return false;
    return Reflect.getMetadata(METHOD_METADATA, descriptor.value) !== undefined;
  });
}

function declara(clave: string, clase: Controlador["clase"], metodo: string): unknown {
  const handler = (clase.prototype as Record<string, unknown>)[metodo] as object;
  const enElMetodo = Reflect.getMetadata(clave, handler);
  if (enElMetodo !== undefined) return enElMetodo;
  return Reflect.getMetadata(clave, clase);
}

describe("toda ruta declara quién puede usarla", () => {
  let encontrados: Controlador[] = [];

  // Importar los controladores transpila medio `contexts/` (cada uno arrastra
  // sus comandos, consultas y DTOs), y eso pasa de los 5 s por defecto de
  // Vitest. Se hace UNA vez para las dos pruebas, con su propio margen.
  beforeAll(async () => {
    encontrados = await controladores();
  }, 120_000);

  it("hay controladores que revisar", () => {
    // Sin esto, un cambio que rompiera el descubrimiento dejaría la prueba
    // en verde sin haber comprobado ni una ruta.
    expect(encontrados.length).toBeGreaterThan(10);
  });

  it("ningún manejador queda sin @Roles ni @Public", () => {
    const huerfanas: string[] = [];

    for (const { file, nombre, clase } of encontrados) {
      for (const metodo of rutasDe(clase)) {
        const esPublica = declara(PUBLIC_KEY, clase, metodo) === true;
        const roles = declara(ROLES_KEY, clase, metodo);
        const tieneRoles = Array.isArray(roles) && roles.length > 0;
        if (!esPublica && !tieneRoles) {
          huerfanas.push(`${nombre}.${metodo} (${file})`);
        }
      }
    }

    expect(
      huerfanas,
      `Rutas sin anotación de roles ni marca de pública:\n  ${huerfanas.join("\n  ")}\n` +
        "El fallo por defecto es denegar: anótalas con @Roles(...) o, si de verdad " +
        "deben servirse sin sesión, con @Public().",
    ).toEqual([]);
  });
});
