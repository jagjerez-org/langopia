import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = import.meta.dirname;

const ATOMS_DIR = join(SRC_DIR, "atoms");
const MOLECULES_DIR = join(SRC_DIR, "molecules");
const ORGANISMS_DIR = join(SRC_DIR, "organisms");

const FORBIDDEN_PACKAGES = [
  "@langopia/contracts",
  "@langopia/db",
  "@langopia/api",
  "lucide-react",
  "react-router-dom",
];

const FORBIDDEN_PATTERNS = [
  /\bfetch\(/,
  /\bglobalThis\.fetch\(/,
];

function tsFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      output.push(...tsFiles(path));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      output.push(path);
    }
  }
  return output;
}

function allSourceFiles(): string[] {
  const dirs = [SRC_DIR];
  const output: string[] = [];
  for (const dir of dirs) {
    output.push(...tsFiles(dir));
  }
  return output;
}

function importSpecifiers(content: string): string[] {
  const fromQuotes = [...content.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
  const fromApostrophes = [...content.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
  return [...fromQuotes, ...fromApostrophes];
}

function isInside(file: string, dir: string): boolean {
  const relative = file.slice(dir.length);
  return relative.startsWith(sep) || relative === "";
}

describe("Arquitectura de @langopia/ui", () => {
  it("los átomos no importan de moléculas ni organismos", () => {
    const violations: string[] = [];

    for (const file of tsFiles(ATOMS_DIR)) {
      for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
        const resolved = spec.startsWith(".")
          ? resolve(dirname(file), spec)
          : null;

        if (resolved && (isInside(resolved, MOLECULES_DIR) || isInside(resolved, ORGANISMS_DIR))) {
          violations.push(`${file} → ${spec}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("las moléculas no importan de organismos", () => {
    const violations: string[] = [];

    for (const file of tsFiles(MOLECULES_DIR)) {
      for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
        const resolved = spec.startsWith(".")
          ? resolve(dirname(file), spec)
          : null;

        if (resolved && isInside(resolved, ORGANISMS_DIR)) {
          violations.push(`${file} → ${spec}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no se importan paquetes prohibidos ni se hacen peticiones de red", () => {
    const violations: string[] = [];

    for (const file of allSourceFiles()) {
      const content = readFileSync(file, "utf8");

      for (const forbidden of FORBIDDEN_PACKAGES) {
        if (content.includes(`from "${forbidden}"`) || content.includes(`from '${forbidden}'`)) {
          violations.push(`${file} importa ${forbidden}`);
        }
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${file} contiene una llamada a fetch`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
