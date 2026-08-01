import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// `import.meta.dirname` no vale aquí: este workspace compila a CommonJS
// (`tsconfig.json` usa `module: "Node16"` sin `"type": "module"` en el
// `package.json` de la app), y `tsc` rechaza `import.meta` en ese modo.
// `__dirname` es el global equivalente para CommonJS.
const SRC_DIR = __dirname;
const CONTEXTS_DIR = join(SRC_DIR, "contexts");

function tsFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) output.push(...tsFiles(path));
    else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) output.push(path);
  }
  return output;
}

function contexts(): string[] {
  return readdirSync(CONTEXTS_DIR).filter((d) =>
    statSync(join(CONTEXTS_DIR, d)).isDirectory(),
  );
}

/** Toda cadena que sigue a un `from "` en el fichero, tal cual está escrita. */
function importSpecifiers(content: string): string[] {
  return [...content.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
}

/**
 * Resuelve un import a una ruta real del proyecto, para poder decidir a qué
 * contexto pertenece sin importar el ESTILO con el que se escribió.
 *
 * En este repo el 100% de los imports entre ficheros propios son relativos
 * (`../../../scheduling/domain/events/...`), nunca con el alias `@contexts/*`
 * ni con el literal `contexts/` de en medio: dos contextos son hermanos
 * dentro de `contexts/`, así que subir con `..` basta y nunca hace falta
 * volver a escribir la palabra `contexts`. Buscar solo el literal `contexts/`
 * en la cadena —como hacía la versión anterior— es ciego a ese caso, que es
 * justo el único que existe hoy. Por eso aquí se resuelve la ruta de verdad
 * en lugar de leer el texto del import.
 *
 * Devuelve `null` para paquetes externos (`node:fs`, `@nestjs/common`,
 * `vitest`...), que no apuntan a ningún fichero de este proyecto.
 */
function resolveImportPath(fromFile: string, spec: string): string | null {
  if (spec.startsWith(".")) return resolve(dirname(fromFile), spec);
  if (spec.startsWith("@contexts/")) return join(SRC_DIR, "contexts", spec.slice("@contexts/".length));
  if (spec.startsWith("@shared/")) return join(SRC_DIR, "contexts", "shared", spec.slice("@shared/".length));
  return null;
}

describe("Fronteras de la arquitectura", () => {
  const FORBIDDEN_IN_DOMAIN = [
    "@nestjs/",
    "drizzle-orm",
    "express",
    "@langopia/db",
    "postgres",
    // El vocabulario de un proveedor de IA (tarea 3, ola 2) no se filtra al
    // dominio: el puerto (`ContentGeneratorPort`) es agnóstico del
    // proveedor, y solo el adaptador de infraestructura importa su SDK.
    "@anthropic-ai/sdk",
  ];

  it("ningún dominio importa infraestructura", () => {
    const violations: string[] = [];

    for (const context of contexts()) {
      const domain = join(CONTEXTS_DIR, context, "domain");
      let files: string[];
      try {
        files = tsFiles(domain);
      } catch (error) {
        // Solo se tolera «todavía no existe». Cualquier otro fallo de lectura
        // haría que la guardia pasara sin comprobar nada, que es peor que no
        // tenerla.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        continue;
      }
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        for (const forbidden of FORBIDDEN_IN_DOMAIN) {
          if (content.includes(`from "${forbidden}`)) {
            violations.push(`${file} importa ${forbidden}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("un contexto solo importa los eventos de otro", () => {
    const violations: string[] = [];
    const all = contexts().filter((c) => c !== "shared");

    for (const context of all) {
      for (const file of tsFiles(join(CONTEXTS_DIR, context))) {
        const content = readFileSync(file, "utf8");
        for (const spec of importSpecifiers(content)) {
          const resolved = resolveImportPath(file, spec);
          if (!resolved) continue; // paquete externo, no cruza ningún contexto

          const relativeToContexts = relative(CONTEXTS_DIR, resolved);
          const segments = relativeToContexts.split(sep);
          const otherContext = segments[0];
          // Fuera de `contexts/` (p. ej. algo de `shared`, o de otro
          // paquete), o el mismo contexto, o `shared`: no es un cruce.
          if (!otherContext || otherContext === context || otherContext === "shared") continue;
          if (!all.includes(otherContext)) continue;

          // Entre contextos, lo único público son los eventos. Los comandos y
          // las consultas los importan los adaptadores de entrada, que no son
          // contextos y viven fuera de este directorio.
          const isEvent = segments[1] === "domain" && segments[2] === "events";
          if (!isEvent) {
            violations.push(`${file} → ${spec}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("un adaptador de entrada solo importa comandos, consultas y eventos", () => {
    const violations: string[] = [];
    const ENTRYPOINTS_DIR = join(__dirname, "entrypoints");

    let files: string[];
    try {
      files = tsFiles(ENTRYPOINTS_DIR);
    } catch (error) {
      // Todavía no hay adaptadores de entrada fuera de los contextos.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return;
    }

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const pattern =
        /from "[^"]*contexts\/(?!shared)[^/]+\/(?!application\/(commands|queries)|domain\/events)[^"]*"/g;
      const found = content.match(pattern);
      if (found) {
        violations.push(`${file} → ${found.join(", ")}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("solo los repositorios escriben SQL", () => {
    const violations: string[] = [];

    for (const context of contexts()) {
      for (const file of tsFiles(join(CONTEXTS_DIR, context))) {
        if (file.includes(join("infrastructure", "persistence"))) continue;
        const content = readFileSync(file, "utf8");
        if (/from "drizzle-orm"/.test(content) || /\bsql`/.test(content)) {
          violations.push(`${file} escribe SQL fuera de infrastructure/persistence/`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("ningún módulo de contexto importa el módulo de otro contexto", () => {
    const violations: string[] = [];
    for (const context of contexts()) {
      const modulePath = join(CONTEXTS_DIR, context, `${context}.module.ts`);
      let content: string;
      try {
        content = readFileSync(modulePath, "utf8");
      } catch (error) {
        // Un contexto puede no tener módulo todavía; un fallo de permisos, no.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        continue;
      }
      const imports = content.match(/imports:\s*\[([^\]]*)\]/s)?.[1] ?? "";
      if (/\w+Module/.test(imports.replace(/CqrsModule|ConfigModule|ClsModule/g, ""))) {
        violations.push(`${modulePath} importa otro módulo de contexto`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("ningún catch se traga el error", () => {
    const violations: string[] = [];
    for (const context of contexts()) {
      for (const file of tsFiles(join(CONTEXTS_DIR, context))) {
        const content = readFileSync(file, "utf8");
        // catch vacío, o con solo un comentario dentro
        if (/catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*\s*)*\}/.test(content)) {
          violations.push(`${file}: catch vacío`);
        }
        if (/\.catch\(\s*\(\s*\)\s*=>\s*(null|undefined|\{\s*\})\s*\)/.test(content)) {
          violations.push(`${file}: .catch que descarta el error`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
