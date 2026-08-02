import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "./normalize-database-url.js";

describe("normalizeDatabaseUrl", () => {
  it("devuelve URL válida sin tocar", () => {
    const url = "postgresql://user:pass@host/db?sslmode=require";
    expect(normalizeDatabaseUrl(url)).toBe(url);
  });

  it("codifica la contraseña cuando contiene `#` reservado", () => {
    const url =
      "postgresql://langopia_app:Lang0p1a!ProdApp_2025_Xk9#mP@ep-orange-base-ase5yskn-pooler.c-4.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
    expect(normalizeDatabaseUrl(url)).toBe(
      "postgresql://langopia_app:Lang0p1a!ProdApp_2025_Xk9%23mP@ep-orange-base-ase5yskn-pooler.c-4.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
    );
  });

  it("no doble-codifica una contraseña que ya viene escapada", () => {
    const url =
      "postgresql://langopia_app:Lang0p1a%21ProdApp_2025_Xk9%23mP@ep-orange-base-ase5yskn-pooler.c-4.eu-central-1.aws.neon.tech/neondb";
    expect(normalizeDatabaseUrl(url)).toBe(url);
  });

  it("codifica caracteres reservados en el usuario", () => {
    const url = "postgresql://user@dominio.com:p#ass@host/db";
    expect(normalizeDatabaseUrl(url)).toBe(
      "postgresql://user%40dominio.com:p%23ass@host/db",
    );
  });

  it("preserva parámetros de consulta y ruta", () => {
    const url =
      "postgresql://user:p#ss@host:5432/neondb?channel_binding=require&sslmode=require";
    expect(normalizeDatabaseUrl(url)).toBe(
      "postgresql://user:p%23ss@host:5432/neondb?channel_binding=require&sslmode=require",
    );
  });
});
