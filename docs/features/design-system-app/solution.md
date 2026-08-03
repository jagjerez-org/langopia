# Solución — Design System Langopia + rename `web` → `app` + dominio `app.langopia.com`

> Comité técnico. Entradas: `brief.md`, `domain-analysis.md` (ambos aprobados).
> Decisiones detalladas en `adr-001` … `adr-006`.

## Decisiones

### D-1. Nuevo paquete `@langopia/ui` en `packages/ui` (ADR-001)

- `name: "@langopia/ui"`, `private: true`, workspaces ya cubren `packages/*`.
- **Sin paso de build**: el paquete exporta fuente TypeScript directamente (`"exports": { ".": "./src/index.ts", "./theme.css": "./src/theme.css" }`). Los consumidores son apps Vite/React (ESM, `moduleResolution: bundler`), que transpilan la fuente ellas mismas. No se sigue el molde CJS/`dist` de `contracts`/`db` porque su consumidor es NestJS; el de `ui` no.
- Toolchain alineada con `apps/web`: TypeScript ~6.0.2, React 19, Vitest 4 + jsdom + Testing Library, `globals: false`, setup con cleanup explícito.
- Storybook con `@storybook/react-vite` (misma major de Vite que las apps).

### D-2. Theme compartido CSS-first de Tailwind v4 (ADR-002)

- `packages/ui/src/theme.css` nace de **mover** `apps/web/src/ui/tokens.css` tal cual (tokens `--ink-*`, bisagra `@theme inline`, doble modo oscuro, fuentes Geist). No se renombran tokens en esta fase: cero churn.
- Las apps consumen el theme con `@import "@langopia/ui/theme.css";` en su CSS de entrada y declaran `@source` apuntando al paquete para que Tailwind detecte las clases usadas dentro de `packages/ui`.
- Las fuentes Geist viajan dentro del theme del paquete (una sola importación, como hoy).

### D-3. Atomic design + Tailwind utilities, sin CSS Modules (ADR-003)

```
packages/ui/src/
├── theme.css
├── index.ts                  # barrel por niveles
├── lib/cx.ts                 # helper mínimo de clases condicionales
├── atoms/        # Button, Input, Textarea, RadioButton, Toggle, Chip,
│               # Selector, MultiSelector, *WithSearch, CalendarDay,
│               # ItemList (ítem), FormAction, TreeDots, Icons,
│               # ItemSideNavBar, UserAvatar, ToggleListOption
├── molecules/    # LoginForm, LeadForm, SideNavBar, TopNavBar, BottomPage,
│               # Calendar, List, ItemListRow, CrudForm, ActionBar,
│               # Breadcrumb, KpiChart, ThemeToggle, Card, CookiesRgpd,
│               # UserComponent, Section
├── organisms/    # Shell, LandingPage, SiteBuilder, ExerciseBuilder,
│               # CheckoutPage, CheckoutSuccess, RolesPermissionsPage,
│               # KpiPage, StudentPage, ProfessorsPage, PaymentsPage,
│               # PlanningPage, ElearningPage, MediaLibraryPage
└── fixtures/     # datos de demostración tipados para historias
```

- Regla de dependencia: átomos ← moléculas ← organismos. **Prohibido al revés y entre niveles hacia abajo.** Se verifica con un test de arquitectura (`architecture.spec.ts`, mismo patrón que la API) que analiza imports.
- Estilos: clases Tailwind + variantas con selectores `data-[variant=…]:` (soportado nativamente por v4), manteniendo la convención actual de **no exponer `className`** en las props salvo casos documentados (p. ej. layout).
- Migración inicial: los componentes de `apps/web/src/ui/` se trasladan primero (Button, Input, Select, Card, Tag, Dialog, Toast, EmptyState, ErrorState, Skeleton, icons) convirtiendo sus CSS Modules a utilities.
- Iconos: se mantiene el set SVG propio (`atoms/Icons`), sin nuevas dependencias.
- i18n: cero literales; todo texto por props. Fixtures en español solo para historias.
- Tema: `ThemeToggle` escribe `data-theme="dark|light"` en `<html>` y persiste en `localStorage`; valor inicial desde `prefers-color-scheme`. El CSS ya soporta ambos selectores.

### D-4. Storybook como catálogo y validación (ADR-004)

- Historias colocadas junto al componente (`Button.stories.tsx`), una por variante/estado; los organismos-página usan `fixtures/`.
- Toda historia se renderiza en claro y oscuro (decorator global con toolbar de tema).
- `npm run storybook` en el paquete para desarrollo; `npm run storybook:build` como smoke test en CI (sin publicación).
- Tests de componentes con Vitest + Testing Library (patrón actual), no con Storybook test-runner, para no añadir superficie.

### D-5. Rename `apps/web` → `apps/app` en un solo commit coordinado (ADR-005)

- `git mv apps/web apps/app` + todas las referencias del mapa de impacto en el mismo cambio: scripts raíz (`app:dev`/`app:build`), `name: "@langopia/app"`, `ci.yml`, `preview-deploy.yml` (incluye alias `pr-N.app.langopia.com`), `vercel.json`, `.gitignore`, worktree CLI (`scripts/worktree/**` clave `web`→`app` + sus tests), docs operativa (`ARCHITECTURE.md`, `RUNBOOK.md`, `TRASPASO.md`, `AGENTS.md`), y `npm install` para regenerar el lockfile.
- Docs históricos (`docs/superpowers/**`) y comentarios "Tarea N del panel" no se tocan.
- Manual fuera del repo (checklist en el ADR): crear proyecto Vercel `langopia-app`, migrar env vars, asignar dominio, archivar `langopia-web`. **El merge a `main` se coordina con la creación del proyecto** para que el bucle `vercel link --project langopia-app` no falle.

### D-6. `app.langopia.com` con proxy same-origin (ADR-006)

- Se mantiene el patrón actual: la SPA llama a `/api/*` en su propio origen y Vercel reescribe a `https://api.langopia.com/api/*`. Sin cookies cross-domain, sin `SameSite=None`, sin CORS nuevo.
- Cambios de configuración (Vercel, no código): `BETTER_AUTH_URL=https://api.langopia.com/api/v1/auth` y `BETTER_AUTH_TRUSTED_ORIGINS=https://app.langopia.com` en producción.
- `langopia.com` no se añade a `TENANT_BASE_DOMAINS`: se reserva para la futura landing pública; `app`/`api` ya son subdominios reservados.
- Verificación: login + navegación con sesión + llamada autenticada en el entorno preview del rename antes de tocar producción.

## Alternativas rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| Compilar `packages/ui` a `dist` con `tsc`/tsup como `contracts`/`db` | Sus consumidores son NestJS CJS; los de `ui` son Vite ESM. Build innecesario: Vite transpila la fuente, y evita doble artefacto y sourcemaps rotos. |
| Publicar Storybook (Chromatic/Vercel) | Añade coste, credenciales y superficie sin requisito del brief. Build en CI basta como validación. Decidido con el usuario. |
| Mantener CSS Modules en componentes migrados | Duplicaría estrategia de estilos dentro del paquete. El brief pide Tailwind; un solo idioma de estilos. |
| Adoptar Radix/Headless UI o `cva` | Cero dependencias de ese tipo hoy; el DS actual a mano funciona. Añadir runtime pesado sin necesidad. Se puede reevaluar para componentes con foco complejo (combobox con búsqueda) si la accesibilidad lo exige. |
| Llamadas directas del navegador a `api.langopia.com` (sin proxy) | Exigiría `SameSite=None; Secure`, cookies con `Domain=.langopia.com`, CORS con credenciales y cliente con base URL absoluta. El proxy ya funciona en producción, previews y sites. |
| Renombrar el proyecto Vercel existente | Vercel no renombra proyectos limpiamente con dominios/env; proyecto nuevo + archivo del viejo es más seguro y reversible. |
| Rename gradual (alias `web`→`app` coexistiendo) | Doble nombre en scripts/CI/worktree CLI genera confusión y estados a medias; el mapa de impacto es acotado y cabe en un commit. |
| Añadir `langopia.com` a `TENANT_BASE_DOMAINS` | Abriría subdominios de escuela en `langopia.com`, que se reserva para la landing del producto (decisión del usuario). |
| Renombrar tokens `--ink-*` ahora | Churn masivo sin valor inmediato; se puede hacer en una pasada posterior si se desea. |

## Ficheros afectados

**Nuevos**

- `packages/ui/**` — paquete completo (ver D-3).
- `docs/features/design-system-app/adr-001..006.md`

**Modificados (rename + adopción)**

- `package.json` (raíz): scripts `app:dev`/`app:build`.
- `apps/web → apps/app` (git mv): `package.json` (`name`), `vercel.json` (buildCommand), `src/index.css` (import del theme del paquete + `@source`), comentarios autorreferenciales.
- `.github/workflows/ci.yml`: workspaces del panel + build de Storybook; `.github/workflows/preview-deploy.yml`: rutas, `langopia-app`, alias.
- `scripts/worktree/{ports.ts,env.ts,cmd/dev.ts,cmd/add.ts,cmd/list.ts,__tests__/ports.test.ts}`.
- `.gitignore`, `package-lock.json` (regenerado).
- `ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/TRASPASO.md`, `AGENTS.md`.

**Sin cambios de código** (solo env en Vercel): `apps/api/**`, `packages/db/**`, `packages/contracts/**`, `apps/sites/**`.

## Contratos y modelos

- **API pública del paquete**: `index.ts` reexporta por nivel (`export * from "./atoms/index.js"` …). Cada componente exporta su tipo de props (`ButtonProps`, …), como hace el barrel actual.
- **Theme**: contrato CSS — nombres de tokens `--ink-*` y utilidades generadas (`bg-canvas`, `text-muted`…) son el contrato consumible por las apps.
- **Tema claro/oscuro**: contrato de runtime — `document.documentElement.dataset.theme` ∈ `{"light","dark"}` + clave `localStorage["langopia:theme"]`.
- **Fixtures**: tipos de demostración por organismo (p. ej. `KpiPageData`, `StudentPageData`) definidos en el paquete; cuando las pantallas reales se conecten, los mappers app→fixture viven en la app.
- **HTTP/auth**: sin cambios de contrato. `BETTER_AUTH_TRUSTED_ORIGINS` sigue siendo la única fuente de orígenes.

## Diagrama de estado

### Tema

```
[sin preferencia] --prefers-color-scheme--> claro | oscuro
claro <--toggle--> oscuro        (persiste en localStorage["langopia:theme"])
```

### Tema oscuro en CSS (ya existente, se conserva)

```
:root[data-theme="dark"]  → tokens oscuros (manual, prioridad)
@media (prefers-color-scheme: dark) → tokens oscuros (fallback sin data-theme)
```

### Calendario (molécula más compleja)

```
vista: día ⇄ semana ⇄ mes ⇄ año        (navegación: anterior/hoy/siguiente)
día: habilitado | deshabilitado | hoy | seleccionado | fuera-de-mes
celda de día: vacía → con-eventos (programado | recordatorio | tarea)
creación: click en día/hora → formulario (organismo anfitrión decide)
```

### Formularios (login/lead/CRUD)

```
vacío → dirty → válido/inválido → enviando → éxito | error (→ dirty)
```

### Rename (operativo)

```
[apps/web + langopia-web] → commit rename + proyecto langopia-app creado
→ merge a main → CI enlaza langopia-app → dominio app.langopia.com asignado
→ langopia-web archivado
```

## Plan por fases

1. **Fase 0 — Scaffolding**: `packages/ui` (package.json, tsconfigs, vitest, Storybook), `theme.css` movido desde `apps/web`, barrel, `cx`, architecture.spec, hook en CI (`storybook:build` + tests del paquete).
2. **Fase 1 — Átomos**: migración de `apps/web/src/ui/` (Button, Input, Select→Selector, Card→base, Tag→Chip, Dialog, Toast, EmptyState, ErrorState, Skeleton, Icons) + átomos nuevos del catálogo. La app empieza a consumir `@langopia/ui` (eliminación gradual de `src/ui/`).
3. **Fase 2 — Moléculas**: las 18 del catálogo, calendario incluido (sub-slice propio).
4. **Fase 3 — Organismos**: shell + 13 páginas con fixtures.
5. **Fase 4 — Rename**: commit coordinado + pasos manuales de Vercel (proyecto, dominio, env vars).
6. **Fase 5 — Dominio**: `app.langopia.com` activo, trusted origins en producción, verificación de login/sesión e2e en preview y producción.

## Estrategia de tests

- **Unitarios de componente** (Vitest + Testing Library, jsdom): todos los átomos y moléculas; organismos con interacción relevante (shell, calendario, forms). Convenciones actuales: `globals: false`, cleanup explícito, `user-event`.
- **Test de arquitectura** del paquete: reglas de dependencia atomic (átomos no importan moléculas/organismos; moléculas no importan organismos; nadie importa ReactDOM/server ni `@langopia/*`).
- **Historias como catálogo**: toda variante tiene historia; `storybook:build` en CI como smoke.
- **Sin literales sin traducir**: los fixtures son datos, no UI; test ligero que los componentes no renderizan texto propio (opcional, por convención + review).
- **Rename**: `npm run typecheck`, `npm run test`, `npm run api:build`, CI completo, y tests del worktree CLI (`scripts/worktree/__tests__`).
- **Dominio**: verificación manual + e2e Playwright del panel en preview con el alias nuevo (login → sesión → llamada autenticada).

## Riesgos de despliegue

- **RD-1 (alto)**: merge del rename a `main` sin el proyecto `langopia-app` creado → `vercel link` falla y bloquea el deploy de las tres apps. Mitigación: checklist del ADR-005 ejecutada antes del merge; el job de deploy solo corre en `main` con `VERCEL_DEPLOY_ENABLED`.
- **RD-2 (medio)**: env vars de producción no migradas al proyecto nuevo (o `BETTER_AUTH_TRUSTED_ORIGINS` sin `https://app.langopia.com`) → login roto (403 `INVALID_ORIGIN`). Mitigación: paso explícito + verificación de login como criterio de cierre.
- **RD-3 (medio)**: clases Tailwind del paquete ausentes en el build de la app por `@source` mal configurado → UI sin estilos solo en producción. Mitigación: verificar build de la app en Fase 1 y preview e2e.
- **RD-4 (bajo)**: alias preview `pr-N.web.langopia.com` antiguo queda en comentarios de PRs viejas; inocuo.
- **RD-5 (bajo)**: sesiones activas durante el cambio de dominio del panel: la cookie es host-only del dominio anterior; los usuarios re-inician sesión una vez. Comunicar en release notes.

## Revisión del comité

- **Backend**: sin cambios de código; una sola fuente de orígenes preservada; RLS/tenancy intactos. ✅
- **Frontend**: paquete fuente sin build = simplicidad; riesgo `@source` mitigado con verificación temprana; dos versiones de TS coexisten sin choque (paquete sigue a web). ✅
- **Seguridad**: proxy same-origin evita cookies cross-domain; sin nuevas dependencias de runtime; Storybook no publicado; molécula RGPD solo presentacional en esta fase. ✅
- **Base de datos**: sin impacto. ✅
- **QA**: cobertura por componente + arquitectura + smoke de Storybook; e2e existente sigue pasando tras el rename (mismo puerto, mismas rutas). ✅
- **Negocio**: valor incremental por fases; el rename se deja al final para no bloquear el DS; `langopia.com` preservado para la landing. ✅
