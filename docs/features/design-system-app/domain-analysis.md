# Análisis de dominio — Design System Langopia + rename `web` → `app` + dominio `app.langopia.com`

> Basado en `brief.md` (aprobado) y tres exploraciones del repo (frontend/paquetes, referencias al rename, auth/CORS/dominios).

## Comportamiento actual

### Design system

- **Ya existe un mini design system local** en `apps/web/src/ui/`: `Button`, `Input`, `Select`, `Table`, `Card`, `Tag`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton` e `icons.tsx` propio (SVG inline).
- Tokens en `apps/web/src/ui/tokens.css` (363 líneas): prefijo `--ink-*`, acento azul-violeta OKLCH 262°, gradiente púrpura→azul de marca, tipografía Geist (`@fontsource/geist-sans/mono`), grid de 4 px, radios y sombras estilo shadcn.
- **Tema oscuro ya soportado en tokens** (`@media (prefers-color-scheme: dark)` y `:root[data-theme="dark"]`), pero no existe toggle manual.
- Tailwind v4 en modo CSS-first: bisagra `@theme inline` que expone utilidades (`bg-canvas`, `text-muted`…). Sin PostCSS config; plugin `@tailwindcss/vite`.
- Estilos por componente con **CSS Modules** + atributos `data-variant`/`data-size`. Los componentes **no aceptan `className`** (`Omit<..., "className">`).
- **No hay Radix ni Headless UI**; todo a mano. `lucide-react` instalado pero apenas usado (3 ficheros).
- Formularios con `react-hook-form` + `zod`.
- i18n: 5 idiomas con `I18nProvider` + `useT()` (ICU vía `intl-messageformat`); los componentes de `ui/` ya reciben textos por props (sin literales acoplados).
- **No existen tests de los componentes de `ui/`** (los ~35 specs son de pantallas de features).
- No existe Storybook en ningún workspace.

### Consumo de API y auth

- La SPA llama a `` `/api/v1${path}` `` (URL relativa, mismo origen) con `credentials: "include"` (`apps/web/src/lib/api-client.ts:94`). No usa el cliente JS de better-auth.
- En dev, Vite proxifica `/api` → `API_PROXY_TARGET ?? http://localhost:3000` (`apps/web/vite.config.ts:17`).
- En producción, `apps/web/vercel.json:6` reescribe `/api/:path*` → `https://api.langopia.com/api/:path*` — **la API ya se sirve a través del dominio del panel**, exactamente lo que pide el brief ("que la API sea llamada por ella también").
- `apps/sites` usa el mismo patrón (middleware pasa `/api/*` a `API_URL`). Es la convención del proyecto.
- Better Auth (`apps/api/src/contexts/iam/infrastructure/auth/better-auth.config.ts`): `trustedOrigins` desde `BETTER_AUTH_TRUSTED_ORIGINS` (default `http://localhost:5173`); cookies sin configuración explícita (defaults: `SameSite=Lax`, `Secure` en https, host-only, sin `Domain`).
- CORS en Nest (`apps/api/src/bootstrap.ts:67-70`): misma lista `BETTER_AUTH_TRUSTED_ORIGINS` + `credentials: true`. Una sola fuente de orígenes.
- Tenant por subdominio: `app` ya está en `RESERVED_SUBDOMAINS` de `session-tenant.guard.ts`, así que `app.langopia.com` nunca se confundirá con una escuela; la resolución de tenant cae a la cabecera `x-school-slug` que el cliente ya envía.
- El workflow `preview-deploy.yml` ya demuestra el patrón cross-subdominio funcionando (`pr-N.web.langopia.com` → `pr-N.api.langopia.com`, inyectando `BETTER_AUTH_TRUSTED_ORIGINS`).

### Rename — mapa de impacto (acoplamientos duros)

1. `package.json` raíz: scripts `web:dev`, `web:build`, `dev` (L16–19) → `app:dev`, `app:build`.
2. `apps/web/package.json:2`: `name: "@langopia/web"` → `@langopia/app`.
3. `.github/workflows/ci.yml`: L56, L74, L97 (`--workspace @langopia/web`), L103 (`apps/web/test-results`), L147–150 (bucle `for app in api web sites` → `vercel link --project langopia-$app`: enlazará a `langopia-app` automáticamente tras el rename).
4. `.github/workflows/preview-deploy.yml`: L128, L136, L146, L150 (`apps/web`, `@langopia/web`, `langopia-web`, alias `pr-N.web.langopia.com`).
5. `apps/web/vercel.json:4`: `buildCommand` con `--workspace @langopia/web`.
6. `.gitignore:12–16`: rutas de Playwright `apps/web/...`.
7. `scripts/worktree/`: clave lógica `web` en `ports.ts`, `env.ts`, `cmd/dev.ts` (filtro invoca `npm run web:dev` — hay que cambiar ambos lados a la vez), `cmd/add.ts`, `cmd/list.ts`, `__tests__/ports.test.ts`.
8. `package-lock.json`: se regenera con `npm install` (no editar a mano).
9. **Vercel (fuera del repo)**: crear proyecto `langopia-app`, asignar dominio `app.langopia.com`, migrar variables de entorno. `langopia-web` queda obsoleto.
10. Docs operativa: `ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/TRASPASO.md`, `AGENTS.md` (raíz del checkout principal). Docs históricos (`docs/superpowers/**`) se dejan como están.

Sin cambios necesarios en: puerto 5173, `.ports.json` (vacío), `apps/sites`, `packages/db`, `packages/contracts`, `cron-jobs.yml`, `backup.yml`, `preview-cleanup.yml`, tsconfigs.

## Comportamiento deseado

1. **`packages/ui`** (`@langopia/ui`): design system con Storybook 8+, Tailwind v4, atomic design (átomos → moléculas → organismos), paleta propia (evolución de los tokens `--ink-*` actuales), tema claro/oscuro con toggle, ~50 componentes del catálogo del brief con historias y tests (Vitest + Testing Library, mismas convenciones que hoy: jsdom, `globals: false`, cleanup explícito).
2. **`apps/app`**: el workspace renombrado, compilando y pasando CI con el nuevo nombre; scripts `app:dev`/`app:build`.
3. **`app.langopia.com`**: la app desplegada con ese dominio, manteniendo el proxy `/api/*` → `api.langopia.com` (patrón actual) y auth funcionando (trusted origins actualizados en Vercel).

## Reglas de dominio

- **DR-1 — Un solo origen de verdad visual**: todo componente reutilizable vive en `packages/ui`; las apps componen, no redefinen. Convención de adopción obligatoria para pantallas nuevas.
- **DR-2 — Atomic design estricto**: un átomo no importa moléculas; una molécula no importa organismos; los organismos solo se usan en historias/apps, nunca dentro de otros organismos del paquete salvo composición documentada (p. ej. shell que contiene side nav).
- **DR-3 — Componentes sin textos acoplados**: todo contenido textual llega por props (i18n vive en las apps). Cero literales de UI en el paquete salvo fixtures de historias.
- **DR-4 — Tema dual obligatorio**: ningún componente se da por terminado sin renderizar correctamente en claro y oscuro (historia o variante por componente).
- **DR-5 — Sin dependencia de la API**: el paquete no importa `@langopia/contracts` para nada de runtime ni llama a la red; los organismos consumen fixtures/mocks tipados definidos en el propio paquete.
- **DR-6 — Convenciones del repo**: TypeScript estricto, objetos `as const` sobre enums, imports con extensión `.js`, comentarios en español, accesibilidad (foco visible, aria, contraste AA), props sin `className` libre salvo decisión arquitectónica explícita.
- **DR-7 — Un solo punto de configuración de orígenes**: `BETTER_AUTH_TRUSTED_ORIGINS` sigue siendo la única fuente para CORS + Better Auth; `app.langopia.com` se añade ahí (en Vercel), no se crea una variable nueva.
- **DR-8 — Proxy same-origin para la API**: la app nunca llama a `api.langopia.com` directamente desde el navegador; siempre `/api/*` a través del rewrite de Vercel (evita `SameSite=None`, cookies con `Domain` y CORS con credenciales).

## Transiciones de estado

- **Tema claro/oscuro**: `claro → oscuro → claro`, con persistencia (localStorage) y respeto a `prefers-color-scheme` como valor inicial. Hoy solo existe el soporte de tokens; el toggle es nuevo.
- **Calendario (molécula)**: vistas `día ↔ semana ↔ mes ↔ año`; días `habilitado | deshabilitado | seleccionado | hoy | fuera-de-mes`; eventos `programado | recordatorio | tarea`. Es la pieza con más estado del catálogo.
- **Componentes de formulario**: `vacío → dirty → válido/inválido → enviando → éxito/error` (login form, lead form, CRUD form).
- **Rename (operativo)**: `apps/web + langopia-web` → `apps/app + langopia-app`; estado intermedio inválido (CI enlazando a un proyecto Vercel inexistente) si el rename llega a `main` antes de crear `langopia-app` en Vercel.

## Casos borde

- **Build del paquete**: los paquetes existentes compilan a CJS para NestJS; `@langopia/ui` es consumido por Vite/React (ESM, `moduleResolution: bundler`). Su tsconfig debe seguir el molde de `apps/web` (TS ~6.0.2, `verbatimModuleSyntax`, jsx `react-jsx`), no el de `contracts`/`db` (TS ^5.8.3, CJS). Coexisten dos versiones de TypeScript en el monorepo.
- **CSS del paquete**: Tailwind v4 escanea el contenido de los archivos que usa la app; las clases usadas dentro de `packages/ui` deben entrar en el build de la app consumidora (`@source` en el CSS de la app o CSS propio del paquete importado una vez).
- **Fuentes Geist**: `tokens.css` las importa por CSS; decidir si el paquete las trae consigo o las importa cada app.
- **Duplicación de tokens durante la migración**: `apps/web/src/ui/tokens.css` y el theme del paquete coexistirán temporalmente; riesgo de divergencia hasta que la app adopte el paquete.
- **Storybook en CI**: build de Storybook aumenta tiempo de pipeline; el brief no exige publicarlo — decisión pendiente (Chromatic/Vercel/nada).
- **Cookies RGPD (molécula)**: debe integrarse con el consentimiento real del producto más adelante; en esta fase es presentacional.
- **Organismos-página** (student page, payments page…): representan pantallas que ya existen a medias en `apps/web/src/features/`; el organismo del DS es la versión de diseño con fixtures, no la pantalla conectada.
- **`wt:dev` worktree CLI**: renombrar el script raíz sin tocar `cmd/dev.ts` rompe el arranque por worktree (acoplamiento real encontrado).
- **Alias preview `pr-N.web.langopia.com`**: tras el rename debería pasar a `pr-N.app.langopia.com`; actualizar también el comentario de la PR del workflow (fila `| Web |`).

## Preguntas abiertas — RESUELTAS (aprobadas por el usuario)

1. **Estrategia de estilos en `packages/ui`** → **DECIDIDO: Tailwind utilities + theme compartido.** Se abandona el patrón CSS Modules; el paquete usa clases Tailwind sobre el theme CSS-first v4.
2. **¿Migrar los componentes actuales de `apps/web/src/ui/` a `packages/ui`?** → **DECIDIDO: sí, como primer paso** (Button, Input, Select, Card, Tag, Dialog, Toast… convertidos a átomos/moléculas del nuevo sistema), y luego el resto del catálogo.
3. **¿Storybook se publica o solo local?** → **DECIDIDO: build en CI como validación, sin publicación** en esta fase.
4. **¿Proyecto Vercel nuevo `langopia-app` o renombrar `langopia-web`?** → **DECIDIDO: proyecto nuevo `langopia-app`** (el bucle de CI lo enlaza por nombre de directorio), dominio y env vars migrados manualmente; `langopia-web` se archiva.
5. **¿`langopia.com` como base domain de tenants?** → **DECIDIDO: no tocar `DEFAULT_BASE_DOMAINS`.** `langopia.com` se reserva para la **landing pública del producto** (trabajo futuro, fuera de esta feature). Los subdominios de producto en `langopia.com` son: `app.` (panel), `api.` (API), `pr-N.*.` (previews). Las escuelas siguen en `*.langopia.app`.

## Mapa de impacto

| Área | Qué cambia | Ficheros clave |
|---|---|---|
| Nuevo paquete | `packages/ui` completo: package.json, tsconfig, vite/vitest config, Storybook, theme Tailwind, ~50 componentes + historias + tests | `packages/ui/**` |
| Scripts raíz | `web:dev`/`web:build` → `app:dev`/`app:build` | `package.json` |
| Workspace renombrado | `git mv apps/web apps/app`, `name` en su package.json, comentarios autorreferenciales | `apps/app/**` |
| CI | Workspaces y rutas del panel; bucle de `vercel link` | `.github/workflows/ci.yml` |
| Preview deploy | Rutas, nombre de proyecto, alias `pr-N.app.langopia.com` | `.github/workflows/preview-deploy.yml` |
| Worktree CLI | Clave `web` → `app` en puertos/env/dev/list + tests | `scripts/worktree/**` |
| Vercel (manual) | Crear `langopia-app`, dominio `app.langopia.com`, migrar env vars; API: `BETTER_AUTH_TRUSTED_ORIGINS=https://app.langopia.com`, `BETTER_AUTH_URL=https://api.langopia.com/api/v1/auth` | Dashboard Vercel |
| Docs operativa | Referencias `apps/web`/`langopia-web` | `ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/TRASPASO.md`, `AGENTS.md` |
| Lockfile | Regenerar | `package-lock.json` |
| `.gitignore` | Rutas Playwright | `.gitignore` |

## Riesgos y supuestos

**Riesgos**

- R-1: Alcance muy grande (~50 componentes + rename + dominio). Mitigación: slicing en la fase correspondiente (base → átomos → moléculas → organismos → rename → dominio).
- R-2: Divergencia visual durante la migración (tokens duplicados en app y paquete). Mitigación: el theme del paquete nace de `tokens.css` actual y la app lo adopta cuanto antes.
- R-3: Rename llega a `main` antes de crear `langopia-app` en Vercel → deploy roto. Mitigación: tarea manual previa + orden de slices (rename al final o coordinado).
- R-4: Clases Tailwind del paquete no detectadas por el build de la app → estilos ausentes en producción. Mitigación: `@source` explícito y verificación con build.
- R-5: Dos versiones de TypeScript (5.8 en paquetes CJS, 6.0 en web) → fricción de tipos. Mitigación: `packages/ui` usa TS 6 como web.
- R-6: Storybook pesado en CI. Mitigación: solo `build` como validación, sin publicación.

**Supuestos**

- S-1: Se mantiene el proxy same-origin `/api/*` → `api.langopia.com` (confirmado por el patrón actual en producción, dev, previews y sites). No hacen falta cookies cross-domain.
- S-2: La paleta evoluciona de los tokens `--ink-*` existentes (no se diseña una identidad nueva desde cero).
- S-3: Los organismos-página se construyen con fixtures; su conexión real a la API es trabajo posterior de cada contexto.
- S-4: La migración de las 18 features de `apps/web` al nuevo DS es incremental y posterior a esta feature.
- S-5: Los docs históricos (`docs/superpowers/**`) no se actualizan por el rename.
