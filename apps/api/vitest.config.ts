import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      // El dominio es puro: si algo debe estar cubierto, es esto.
      include: ["src/contexts/*/domain/**"],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
