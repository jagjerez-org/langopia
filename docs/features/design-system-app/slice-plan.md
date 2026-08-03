# Plan de slices verticales — Design System Langopia + rename + dominio

> Entradas: `brief.md`, `solution.md`, `test-strategy.md`.
> Cada slice es construible, testeable y, salvo el slice 0, entrega un comportamiento observable en Storybook o en la app.

## Lista de slices

| # | Slice | Valor observable | Dependencias |
|---|---|---|---|
| 0 | Scaffolding de `packages/ui` | Storybook arranca; theme se importa en la app; tests y arquitectura pasan | Ninguna |
| 1 | Sistema de tema + ThemeToggle | Cambiar claro/oscuro en Storybook y persistir preferencia | Slice 0 |
| 2 | Átomos de formulario + botones | Catálogo de inputs, textareas, radios, toggles, botones, chips, selectores en Storybook | Slice 0 |
| 3 | Átomos de navegación, íconos y avatar | Íconos, avatar de usuario, ítem de side nav, día de calendario, item de lista | Slice 0 |
| 4 | Moléculas de formularios | LoginForm, LeadForm y CRUDForm funcionan con validación en Storybook | Slice 2 |
| 5 | Moléculas de navegación | SideNavBar, TopNavBar, BottomPage, Breadcrumb, ActionBar | Slice 3 |
| 6 | Moléculas de datos: listas, tarjetas, sección, KPI | List, ItemList, Card, Section, KpiChart con datos de ejemplo | Slice 2, 3 |
| 7 | Moléculas de calendario | Calendario con vistas día/semana/mes/año, días habilitados/deshabilitados, eventos, recordatorios, tareas | Slice 3 |
| 8 | Moléculas de utilidades: ThemeToggle, CookiesRGPD, UserComponent | Toggle ya entregado; CookiesRGPD y UserComponent renderizan estados | Slice 1, 3 |
| 9 | Organismo Shell | Layout completo de la aplicación con top/side/bottom nav | Slice 5 |
| 10 | Organismos de negocio A: builders + commerce | SiteBuilder, ExerciseBuilder, CheckoutPage, CheckoutSuccess | Slice 6, 8 |
| 11 | Organismos de gestión | RolesPermissionsPage, KpiPage, PaymentsPage, PlanningPage | Slice 6, 7 |
| 12 | Organismos de personas y contenido | StudentPage, ProfessorsPage, ElearningPage, MediaLibraryPage | Slice 6 |
| 13 | Organismo LandingPage | Página de aterrizaje del producto con secciones | Slice 6, 8 |
| 14 | Rename `apps/web` → `apps/app` | `npm run app:dev`, CI y worktree CLI funcionan con el nuevo nombre | Slices 0–13 (o al menos 0) |
| 15 | Dominio `app.langopia.com` | Login/sesión funciona en preview y producción en el nuevo dominio | Slice 14 |

> **Nota de orden**: el rename (slice 14) puede ejecutarse **antes** de que todos los organismos estén terminados, siempre que el scaffolding y los átomos/moléculas base existan; sin embargo, dejarlo al final reduce el riesgo de despliegue. La app puede seguir consumiendo componentes locales mientras el DS se construye.

## Detalle por slice

### Slice 0 — Scaffolding de `packages/ui`

**Descripción**: crear el paquete con su toolchain, mover `tokens.css` a `theme.css`, configurar Storybook, Vitest, el test de arquitectura y el barrel.

**Ficheros nuevos**

- `packages/ui/package.json`
- `packages/ui/tsconfig.json`, `tsconfig.node.json` (Storybook)
- `packages/ui/vite.config.ts`, `vitest.config.ts`
- `packages/ui/.storybook/main.ts`, `preview.tsx`, `preview-head.html`
- `packages/ui/src/theme.css` (movido desde `apps/web/src/ui/tokens.css`)
- `packages/ui/src/index.ts`
- `packages/ui/src/lib/cx.ts`
- `packages/ui/src/architecture.spec.ts`

**Ficheros modificados**

- `package.json` raíz: añadir script `storybook:build` u opciones del workspace.
- `apps/web/src/index.css` (más adelante `apps/app/src/index.css`): `@import "@langopia/ui/theme.css";` + `@source`.

**Interfaces**

- `exports["@langopia/ui"]` → `./src/index.ts`
- `exports["@langopia/ui/theme.css"]` → `./src/theme.css`

**Tests**

- `architecture.spec.ts`: valida reglas de imports.
- `npm run typecheck --workspace @langopia/ui`
- `npm run test --workspace @langopia/ui`
- `npm run storybook:build --workspace @langopia/ui`

---

### Slice 1 — Sistema de tema + ThemeToggle

**Descripción**: exponer el theme en Storybook con un decorator global y crear el átomo/molécula `ThemeToggle` que persiste en `localStorage` y escribe `data-theme` en `<html>`.

**Ficheros nuevos**

- `packages/ui/src/atoms/ThemeToggle/ThemeToggle.tsx`, `ThemeToggle.spec.tsx`
- Decorator de tema en `.storybook/preview.tsx`

**Ficheros modificados**

- `packages/ui/src/theme.css` (confirmar selectores `:root[data-theme="dark"]` y `@media (prefers-color-scheme: dark)`).

**Tests**

- `ThemeToggle.spec.tsx`: click alterna tema, escribe `dataset.theme`, persiste `localStorage["langopia:theme"]`.
- Historia con toolbar de tema claro/oscuro.

---

### Slice 2 — Átomos de formulario + botones

**Descripción**: migrar y crear átomos de entrada: `Input`, `Textarea`, `RadioButton`, `Toggle`, `Button`, `FormAction`, `Chip`, `Selector`, `MultiSelector`, `SelectorWithSearch`, `MultiSelectorWithSearch`, `ToggleListOption`.

**Ficheros nuevos**

- `packages/ui/src/atoms/<Componente>/<Componente>.tsx`, `*.spec.tsx`, `*.stories.tsx`
- `packages/ui/src/atoms/index.ts`

**Ficheros modificados**

- `apps/web/src/ui/` se vacía progresivamente conforme se migran `Button`, `Input`, `Select` (→ Selector), `Tag` (→ Chip), etc.

**Tests**

- Un spec por componente: renderizado, variantes (`data-variant`), estados (`disabled`, `error`), eventos, ref forwarding.
- Historias con controles de Storybook.

---

### Slice 3 — Átomos de navegación, íconos y avatar

**Descripción**: átomos de presentación y navegación: `Icons`, `TreeDots`, `UserAvatar`, `ItemSideNavBar`, `CalendarDay`, `ItemList` (ítem individual).

**Ficheros nuevos**

- `packages/ui/src/atoms/Icons/`, `TreeDots/`, `UserAvatar/`, `ItemSideNavBar/`, `CalendarDay/`, `ItemList/Item.tsx`

**Ficheros modificados**

- Migrar `apps/web/src/ui/icons.tsx` → `packages/ui/src/atoms/Icons/Icons.tsx`.

**Tests**

- Cada átomo renderiza correctamente y aplica estados (activo/inactivo, hoy, fuera-de-mes).

---

### Slice 4 — Moléculas de formularios

**Descripción**: `LoginForm`, `LeadForm`, `CrudForm` usando los átomos del slice 2 y `react-hook-form` + `zod`.

**Ficheros nuevos**

- `packages/ui/src/molecules/LoginForm/`, `LeadForm/`, `CrudForm/`

**Tests**

- Flujo vacío → dirty → inválido → enviando → éxito/error.
- Mocks de `onSubmit`.

---

### Slice 5 — Moléculas de navegación

**Descripción**: `SideNavBar`, `TopNavBar`, `BottomPage`, `Breadcrumb`, `ActionBar`.

**Ficheros nuevos**

- `packages/ui/src/molecules/<Componente>/` para cada uno.

**Tests**

- Render con items, navegación/click en items, estado activo.

---

### Slice 6 — Moléculas de datos: listas, tarjetas, sección, KPI

**Descripción**: `List` (acciones, filtros, ordenación, paginación), `ItemList` (fila con tags), `Card` (título, contenido, imagen, tags), `Section` (colapsable con tags), `KpiChart`.

**Ficheros nuevos**

- `packages/ui/src/molecules/List/`, `ItemList/`, `Card/`, `Section/`, `KpiChart/`
- `packages/ui/src/fixtures/lists.ts`, `cards.ts`, `kpis.ts`

**Tests**

- List: filtrado, ordenación, paginación, acciones por fila.
- Card/Section: render con contenido custom.
- KpiChart: render sin errores con datos de fixture.

---

### Slice 7 — Molécula de calendario

**Descripción**: `Calendar` (vistas día/semana/mes/año, navegación, días habilitados/deshabilitados) + `CalendarDay` (contenido y estado personalizables) con eventos, recordatorios y tareas programadas.

**Ficheros nuevos**

- `packages/ui/src/molecules/Calendar/`, `CalendarDay/`
- `packages/ui/src/fixtures/calendar.ts`

**Tests**

- Cambio de vista, navegación entre meses/semanas, click en día habilitado vs deshabilitado.
- Render de eventos/reminders/tasks en `CalendarDay`.

---

### Slice 8 — Moléculas de utilidades

**Descripción**: `CookiesRgpd` (banner presentacional) y `UserComponent` (avatar + nombre/rol).

**Ficheros nuevos**

- `packages/ui/src/molecules/CookiesRgpd/`, `UserComponent/`

**Tests**

- Render de estados (aceptado/pendiente), props de usuario.

---

### Slice 9 — Organismo Shell

**Descripción**: layout principal de la aplicación (`Shell`) combinando TopNavBar, SideNavBar y BottomPage; área de contenido flexible.

**Ficheros nuevos**

- `packages/ui/src/organisms/Shell/`
- `packages/ui/src/fixtures/shell.ts`

**Tests**

- Render con navegación, toggle de sidebar (si aplica), área de contenido.

---

### Slice 10 — Organismos de negocio A: builders + commerce

**Descripción**: `SiteBuilder`, `ExerciseBuilder`, `CheckoutPage`, `CheckoutSuccess`.

**Ficheros nuevos**

- `packages/ui/src/organisms/{SiteBuilder,ExerciseBuilder,CheckoutPage,CheckoutSuccess}/`
- `packages/ui/src/fixtures/{sites,exercises,checkout}.ts`

**Tests**

- Render con fixtures; interacciones básicas (siguiente paso de checkout).

---

### Slice 11 — Organismos de gestión

**Descripción**: `RolesPermissionsPage`, `KpiPage`, `PaymentsPage`, `PlanningPage`.

**Ficheros nuevos**

- `packages/ui/src/organisms/{RolesPermissionsPage,KpiPage,PaymentsPage,PlanningPage}/`
- `packages/ui/src/fixtures/{permissions,kpis,payments,planning}.ts`

**Tests**

- Render con datos de demostración; tabs/secciones si las hay.

---

### Slice 12 — Organismos de personas y contenido

**Descripción**: `StudentPage`, `ProfessorsPage`, `ElearningPage`, `MediaLibraryPage`.

**Ficheros nuevos**

- `packages/ui/src/organisms/{StudentPage,ProfessorsPage,ElearningPage,MediaLibraryPage}/`
- `packages/ui/src/fixtures/{students,professors,elearning,media}.ts`

**Tests**

- Render con fixtures.

---

### Slice 13 — Organismo LandingPage

**Descripción**: `LandingPage` del producto, usando secciones y tarjetas.

**Ficheros nuevos**

- `packages/ui/src/organisms/LandingPage/`
- `packages/ui/src/fixtures/landing.ts`

**Tests**

- Render con secciones; alternancia de tema.

---

### Slice 14 — Rename `apps/web` → `apps/app`

**Descripción**: commit coordinado con `git mv`, actualización de scripts raíz, CI, worktree CLI, docs y lockfile.

**Ficheros modificados**

- `git mv apps/web apps/app`
- `package.json` raíz: `app:dev`, `app:build`
- `apps/app/package.json`: `name`
- `.github/workflows/ci.yml`, `preview-deploy.yml`
- `apps/app/vercel.json`
- `.gitignore`
- `scripts/worktree/**`
- `ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/TRASPASO.md`, `AGENTS.md`
- `package-lock.json`

**Tests**

- `npm run typecheck`
- `npm run test --workspace @langopia/app`
- `npm run test:e2e --workspace @langopia/app`
- `scripts/worktree/__tests__/ports.test.ts`

**Checklist manual (Vercel)**

- Crear `langopia-app`.
- Migrar env vars.
- Asignar `app.langopia.com`.
- Archivar `langopia-web`.

---

### Slice 15 — Dominio `app.langopia.com`

**Descripción**: verificar que la app en el nuevo dominio autentica y consume la API sin errores de CORS/cookies.

**Ficheros modificados**

- Ninguno (solo env vars en Vercel).

**Tests**

- E2E Playwright en preview (`pr-N.app.langopia.com`): login → sesión → llamada autenticada.
- Verificación manual en producción post-deploy.

**Checklist manual**

- `BETTER_AUTH_URL=https://api.langopia.com/api/v1/auth`
- `BETTER_AUTH_TRUSTED_ORIGINS=https://app.langopia.com`
- Rewrite `/api/*` de `langopia-app` apunta a `https://api.langopia.com/api/*`.

## Dependencias

```
Slice 0
  ├── Slice 1 (tema)
  ├── Slice 2 (átomos form)
  ├── Slice 3 (átomos nav/iconos)
       ├── Slice 4 (formularios)     [necesita 2]
       ├── Slice 5 (navegación)       [necesita 3]
       ├── Slice 7 (calendario)       [necesita 3]
       ├── Slice 8 (utilidades)       [necesita 1, 3]
       ├── Slice 6 (datos)            [necesita 2, 3]
            ├── Slice 9  (shell)      [necesita 5]
            ├── Slice 10 (builders/commerce) [necesita 6, 8]
            ├── Slice 11 (gestión)    [necesita 6, 7]
            ├── Slice 12 (personas/contenido) [necesita 6]
            ├── Slice 13 (landing)    [necesita 6, 8]
Slice 14 (rename)  [necesita 0 como mínimo; idealmente 0–8]
  ├── Slice 15 (dominio) [necesita 14]
```

## Notas de ejecución

- Los slices 0–8 forman el **núcleo usable** del design system; una vez listos, la app puede empezar a adoptar componentes del paquete aunque los organismos no estén todos.
- El rename (14) se puede ejecutar justo después del núcleo para evitar arrastrar un año de referencias `apps/web`; lo ideal es hacerlo antes de empezar organismos de página para no mover muchos ficheros nuevos.
- Los organismos (9–13) son principalmente composición visual + fixtures; se pueden desarrollar en paralelo una vez que existan los slices 5–8.
- El dominio (15) siempre va al final.

## Criterios de terminación de cada slice

1. `npm run typecheck` pasa.
2. `npm run test --workspace @langopia/ui` pasa (o al menos los tests del slice).
3. `npm run storybook:build --workspace @langopia/ui` pasa y las historias nuevas son navegables.
4. Para slices de rename/dominio: CI verde y verificación manual checklist completada.
