import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

/**
 * Configuración APARTE de `vitest.config.ts` (Tarea 10 de la ola 1 y
 * Tarea 13 de la ola 2).
 *
 * La prueba de extremo a extremo arranca el `AppModule` completo dentro del
 * proceso de Vitest y habla con Postgres de verdad (nada de dobles de
 * infraestructura): no es una prueba unitaria más, y mezclarla con
 * `src/**\/*.spec.ts` metería su tiempo de arranque (migraciones ya
 * aplicadas, pero aun así una conexión real y cientos de peticiones HTTP) en cada
 * `vitest --watch` de quien esté tocando un agregado sin relación ninguna.
 * `npm run test` (la batería de siempre) no cambia ni de número de ficheros
 * ni de tiempo; esta se invoca aparte con `npm run test:e2e`.
 */
export default defineConfig({
  // Nest resuelve la inyección por CONSTRUCTOR leyendo metadatos de tipo
  // (`emitDecoratorMetadata`) que `esbuild` —el transformador por defecto de
  // Vitest— no produce: cualquier parámetro sin `@Inject(...)` explícito
  // (la mayoría, en un proyecto con cientos de proveedores) llega `undefined`
  // y el arranque del `AppModule` completo revienta con «Nest can't resolve
  // dependencies». `unplugin-swc` transpila con SWC, que sí lo emite — sin
  // tocar `vitest.config.ts` (las 461 pruebas unitarias construyen sus
  // manejadores a mano, con `new Handler(...)`, y nunca pasan por el
  // contenedor de Nest, así que nunca lo necesitaron).
  plugins: [swc.vite()],
  test: {
    globals: false,
    environment: "node",
    include: ["test/e2e/**/*.e2e-spec.ts"],
    // Peticiones HTTP reales contra Postgres en los recorridos de ola 1 y
    // ola 2: más margen que el timeout por defecto de Vitest.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
