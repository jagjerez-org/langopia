# Design System Langopia + rename `apps/web` → `apps/app` + dominio `app.langopia.com`

## Qué trae esta PR

**1. Nuevo paquete `@langopia/ui` (`packages/ui`)** — design system completo del producto:

- **48 componentes** en atomic design: 18 átomos (Button, Input, Selector, SelectorWithSearch, Chip, CalendarDay, UserAvatar, TreeDots…), 16 moléculas (LoginForm, LeadForm, CrudForm, List, Card, Calendar con vistas día/semana/mes/año, KpiChart, SideNavBar, TopNavBar, Breadcrumb…), 14 organismos (Shell, SiteBuilder, ExerciseBuilder, CheckoutPage, CheckoutSuccess, RolesPermissionsPage, KpiPage, PaymentsPage, PlanningPage, StudentPage, ProfessorsPage, ElearningPage, MediaLibraryPage, LandingPage).
- **Tema compartido CSS-first** (Tailwind v4): tokens `--ink-*` en `src/theme.css`, consumidos por la app con un solo `@import` — sin duplicar configuración (ADR-002).
- **Tema claro/oscuro** con `ThemeToggle`, persistencia y `prefers-color-scheme`.
- **Storybook** como catálogo navegable de cada componente (`npm run storybook --workspace @langopia/ui`), con build en CI como smoke (ADR-004).
- **371 tests** (Vitest + Testing Library, por rol/nombre accesible) incluyendo un **test de arquitectura** que fuerza la dirección átomos ← moléculas ← organismos y prohíbe fetch/contratos en el paquete.
- Exporta **fuente TypeScript** sin build intermedio (los consumidores son Vite; ADR-001). Solo dos dependencias peer nuevas en el paquete (`react-hook-form`, `zod`) — ya eran stack del monorepo.

**2. Rename `apps/web` → `apps/app`** (`@langopia/app`) — commit coordinado que actualiza scripts raíz, CI, preview-deploy (alias `pr-N.app.langopia.com`), worktree CLI, docs y lockfile. Cero referencias restantes al nombre antiguo (ADR-005).

**3. Dominio `app.langopia.com`** — sin cambios de código: la API ya confía en `.langopia.com` por wildcard y el rewrite same-origin `/api/*` → `api.langopia.com` mantiene la sesión first-party (ADR-006). Requiere la **checklist manual de Vercel antes de mergear** (crear `langopia-app`, env vars, dominio) — ver `docs/features/design-system-app/manual-test-plan.md` §3.2.

## Verificación

- `npm run typecheck` raíz: 0 errores · `@langopia/ui`: 371 tests · `@langopia/app`: 412 tests · `@langopia/api`: 1032 tests · worktree CLI: 10/10 · builds (app, storybook) verdes.
- Revisión adversarial ejecutada: 4 hallazgos corregidos (doble submit en CheckoutPage, recuperación de imagen en UserAvatar, names duplicados en CrudForm, phantom dep), resto como deuda menor registrada.
- Review final: **APPROVED** (`docs/features/design-system-app/pr-review.md`).

## Riesgos y rollback

- **Pre-merge obligatorio**: checklist Vercel (§3.2 del plan de test manual) — sin el proyecto `langopia-app` creado, el deploy de main fallaría.
- Rollback: el dominio anterior sigue activo hasta archivar `langopia-web`; revertir el merge y reasignar el dominio.
- `langopia-web` se archiva ~1 semana después, cuando no queden PRs abiertas contra la estructura antigua.

## Fuera de alcance (siguientes fases)

- Adopción del DS en las pantallas de la app (incremental) y retirada de `apps/app/src/ui/` legacy.
- Publicación de Storybook; landing real en `langopia.com`.

---

Documentación completa de la feature en `docs/features/design-system-app/` (brief, análisis de dominio, solución, 6 ADRs, estrategia de tests, plan de slices, informe adversarial, plan de test manual, review final, release readiness).

---

## Ampliación: la app ya usa solo el design system (sin CSS Modules)

Tras la revisión inicial, se ha completado la adopción total en `apps/app`:

- **6 piezas nuevas en el DS** migradas del legacy: `Dialog` (`<dialog>` nativo), `Toast` (+provider/hook), `Skeleton`, `Table`, `EmptyState`, `ErrorState` — más el átomo `Panel` (contenedor estructural, antes `Card` del panel; el `Card` del DS es de marketing).
- **65 ficheros de la app migrados** a `@langopia/ui` (`Card→Panel`, `Select→Selector`, `Tag→Chip`, `Skeleton` con `className` para dimensiones…). Los 412 tests de la app pasaron sin modificar una sola consulta (todas por rol/nombre accesible).
- **UI legacy eliminado**: `apps/app/src/ui/` borrado por completo y **cero `.module.css`** en la app — se encontraron y migraron también 10 módulos CSS vivos en `features/` (auth, calendar/WeekGrid, dashboard, sites). Tailwind queda como único sistema de estilos.
- Fuentes `@fontsource` ahora solo las declara `@langopia/ui`; polyfill de `<dialog>` de test centralizado en el paquete.
- Fix colateral: la utilidad `duration-fast` del theme existía con la clave equivocada (`--duration-fast` → `--transition-duration-fast`); las transiciones usan ahora los 120ms del token.

Suites tras la migración: `@langopia/app` 400/400 (los 12 tests menos son los que se generaban por fichero legacy borrado), `@langopia/ui` 410/410, typecheck y builds verdes. e2e pendiente de CI (requiere Postgres).
