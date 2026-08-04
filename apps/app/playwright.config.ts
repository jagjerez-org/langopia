import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para la Tarea 13 (Recorrido completo, ola 1).
 *
 * Levanta los DOS procesos reales que hacen falta para que el recorrido sea
 * de verdad de extremo a extremo — nada de mocks de infraestructura, igual
 * que la Tarea 10 del backend (`apps/api/test/e2e/wave-1.e2e-spec.ts`):
 *
 *   1. La API compilada (`node dist/main.js`), contra el Postgres real que ya
 *      tiene el esquema, las políticas de RLS y el seed aplicados (los pasos
 *      previos del flujo de CI, o `npm run db:reset` en local).
 *   2. El panel servido con Vite (`vite dev`), con el proxy de `/api`
 *      apuntando al puerto de la API de arriba — el mismo mecanismo que ya
 *      usa cualquier persona en desarrollo (`npm run app:dev`), para que la
 *      cookie de sesión viaje como si fuera del mismo origen.
 *
 * Puertos por defecto: 3000 (API) y 5173 (panel) — los mismos que documenta
 * `CONTEXTO.md`/Tarea 1, y el único origen que Better Auth confía SIN
 * declarar `BETTER_AUTH_TRUSTED_ORIGINS` (`parseTrustedOrigins(undefined)`
 * devuelve `["http://localhost:5173"]` — ver
 * `apps/api/src/contexts/iam/infrastructure/auth/trusted-origins.spec.ts`).
 * Con eso, ni CI ni un `.env` local necesitan una variable nueva. Si algún
 * día chocaran con otro proceso, `WAVE1_API_PORT`/`WAVE1_WEB_PORT` los mueven
 * sin tocar este fichero.
 *
 * `DATABASE_URL` para `createAdminDb()`: el propio recorrido
 * (`wave-1.spec.ts`) habla con Postgres directamente —marcar el correo de la
 * dueña como verificado sin bandeja de entrada real, dejar el comerciante de
 * Stripe activo, dar de alta la credencial del alumno, limpiar al terminar—,
 * y `@langopia/db` (`createAdminDb`) SOLO lee `process.env.DATABASE_URL`,
 * nunca `.env` por su cuenta (a diferencia de la API compilada de arriba,
 * que sí lo carga sola vía `ConfigModule.forRoot({ envFilePath: [...] })` en
 * `app.module.ts`). Sin esto, ejecutar `npx playwright test` en local sin
 * haber exportado la variable a mano revienta en el primer
 * `test.beforeAll` con «Falta DATABASE_URL». `process.loadEnvFile` (Node ≥
 * 20.6, disponible aquí) nunca sobrescribe una variable YA definida —mismo
 * comportamiento por defecto que `dotenv`—, así que en CI (donde
 * `DATABASE_URL` ya llega inyectada por el propio workflow,
 * `.github/workflows/ci.yml`, bloque `env:` del job, y no existe ningún
 * `.env` en el checkout) el `existsSync` de abajo evita el `ENOENT` y esta
 * carga no hace ni falta ni daño.
 */
const ROOT_ENV_PATH = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(ROOT_ENV_PATH)) {
  process.loadEnvFile(ROOT_ENV_PATH);
}

const API_PORT = Number(process.env.WAVE1_API_PORT ?? 3000);
const WEB_PORT = Number(process.env.WAVE1_WEB_PORT ?? 5173);
const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;

const API_DIR = fileURLToPath(new URL("../api", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  // Un único recorrido, largo a propósito (registro, puesta en marcha, alta
  // de profesorado y alumnado, importación, calendario, facturación, portal):
  // más margen que el timeout por defecto de Playwright (30 s). En local dura
  // unos 5 min; el runner de CI (2 vCPU) superó los 10 min, así que 20.
  timeout: 20 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["line"]] : [["list"]],
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // El recorrido principal corre en es-ES (el idioma por defecto de una
    // escuela recién registrada, `schools.default_locale`): sin fijarlo, el
    // navegador arrancaría con el locale del sistema que ejecute la prueba
    // —distinto en cada máquina de CI— y `main.tsx` (`navigator.language`,
    // sin `I18nProvider` todavía montado) pintaría un idioma impredecible.
    // Las dos comprobaciones de idioma del propio recorrido (gl-ES, en-GB)
    // abren su PROPIO contexto con `browser.newContext({ locale })`, que
    // sobrescribe este valor por defecto solo para ellas.
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // `dist/main.js` lo produce `npm run api:build` (`nest build`). En CI
      // se ejecuta justo antes de este paso; en local, quien verifique a
      // mano ya lo habrá corrido (o lo corre `reuseExistingServer` si ya
      // tenía la API viva en este puerto).
      command: "node dist/main.js",
      cwd: API_DIR,
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { PORT: String(API_PORT) },
    },
    {
      // Mismo `vite dev` que `npm run app:dev`, apuntado al puerto de la API
      // de arriba vía `API_PROXY_TARGET` (Tarea 8, `vite.config.ts`).
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
