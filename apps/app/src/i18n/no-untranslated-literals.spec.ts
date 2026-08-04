import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `apps/app/src` — este fichero vive en `apps/app/src/i18n/`. */
const SRC_DIR = join(HERE, "..");

/**
 * Componente previo al sistema de i18n de esta tarea (Tarea 17, escrito
 * antes de que existiera `apps/app`) que sigue montado con sus literales en
 * duro. Migrar solo su texto a `useT()` y dejar sus fechas con
 * `toLocaleString()` (zona del navegador, no de la escuela) sería peor que
 * no tocarlo: quien lo retoque tendrá ya la zona horaria de la escuela para
 * arreglar las dos cosas juntas. Es la única excepción de este andamiaje —
 * cualquier componente nuevo pasa por aquí sin excepción.
 * `ImpersonationHistoryScreen` salió de la lista al montarse en ruta
 * (Tarea 17, paso 12): desde entonces está migrado y examinado como los
 * demás.
 */
const LEGACY_EXEMPT = new Set([
  "features/impersonation/ImpersonationBanner.tsx",
]);

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".spec.tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Al menos una letra (de cualquier alfabeto) — descarta separadores, signos sueltos, etc. */
const HAS_LETTERS = /\p{L}/u;

/**
 * Texto suelto en JSX: hijos de texto directos (`<span>Hola</span>`) y
 * expresiones que son un literal de cadena a secas (`<span>{"Hola"}</span>`,
 * la forma más habitual de colar un literal esquivando el lint de JSX).
 * No mira atributos (`aria-label`, `title`...): el Paso 5 del brief habla de
 * «texto suelto en JSX», que en este código base son los hijos, no los
 * atributos.
 */
function findLooseText(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim();
      if (HAS_LETTERS.test(text)) found.push(text);
    } else if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) {
      const text = node.expression.text.trim();
      if (HAS_LETTERS.test(text)) found.push(text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

describe("Paso 5: ningún literal suelto en JSX", () => {
  const files = collectTsxFiles(SRC_DIR)
    .map((full) => ({ full, rel: relative(SRC_DIR, full) }))
    .filter(({ rel }) => !LEGACY_EXEMPT.has(rel));

  it("hay al menos un fichero .tsx que examinar (si esto falla, el escaneo está mal apuntado)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(({ full, rel }) => [rel, full] as const))(
    "%s no tiene texto sin pasar por el diccionario de traducciones",
    (_rel, full) => {
      const found = findLooseText(full);
      expect(found, `texto suelto: ${found.map((t) => `«${t}»`).join(", ")}`).toEqual([]);
    },
  );
});
