# Revisión final técnica — `design-system-app`

> Rama: `feat/design-system-app`. Fecha: 2026-08-04.
> Alcance: `packages/ui` (design system completo + Storybook + theme), rename `apps/web` → `apps/app`, dominio `app.langopia.com` (config-only, checklist Vercel pendiente).
> Artefactos revisados: `brief.md`, `domain-analysis.md`, `solution.md`, `adr-001..006.md`, `data-model-plan.md`, `test-strategy.md`, `slice-plan.md`, `adversarial-report.md`, `manual-test-plan.md`, ledger `.superpowers/sdd/design-system-app/progress.md`.
> Verificaciones ejecutadas en esta revisión (no solo leídas de los artefactos):
>
> ```
> npm run test --workspace @langopia/ui    → Test Files 50 passed, Tests 371 passed
> npm run test --workspace @langopia/app   → Tests 412 passed
> npm run typecheck (raíz, --workspaces)   → 0 errores en todos los workspaces
> npx tsx --test scripts/worktree/__tests__/*.test.ts → pass 10 / fail 0
> grep "apps/web|@langopia/web|langopia-web" (repo menos docs)  → 0 referencias
> ```

## Veredicto: **CONDITIONAL**

La implementación es sólida: los 4 hallazgos adversariales triageados están corregidos y verificados en código, la suite completa pasa, el rename es limpio y la arquitectura se ajusta a los ADRs en lo esencial. Sin embargo, hay **dos brechas in-repo** frente a los artefactos aprobados que deben resolverse (o aceptarse explícitamente como desviación documentada) antes del merge:

1. **CA-6 sin cumplir**: el brief exige «documentación breve del design system (cómo añadir un componente, convenciones atomic design, uso del theme)» y la estrategia de tests (DOC-001) asume un `packages/ui/README.md` «existente y completo». **No existe** ningún README/MDX en `packages/ui` ni sección equivalente en `README.md`, `ARCHITECTURE.md`, `docs/RUNBOOK.md` o `docs/TRASPASO.md` (verificado por búsqueda exhaustiva). Las historias y el JSDoc cubren el «qué», pero no el «cómo contribuir» que pide el criterio.
2. **ADR-004 / solution.md Fase 0 prometen smoke en CI** (`storybook:build` + tests del paquete) y `.github/workflows/ci.yml` **no ejecuta ni `npm run test --workspace @langopia/ui` ni `storybook:build`**: la CI corre typecheck raíz (que sí cubre `ui`), tests de `api` y `app`, y e2e. Hoy una regresión exclusiva de `packages/ui` pasaría la CI en verde. Alternativa aceptable: enmendar ADR-004 declarando la validación como local/manual y registrar la deuda.

Los pasos manuales de Vercel (checklist ADR-005/006, reproducida en `manual-test-plan.md` §3.2) son **pre-merge documentados, no un defecto de implementación**, y no condicionan el veredicto.

---

## Pasada 1 — Funcional (criterios de aceptación del brief)

| # | Criterio (brief.md) | Implementación | Tests / evidencia | Estado |
|---|---|---|---|---|
| CA-1 | `packages/ui` con Storybook arrancable que muestra todo el catálogo | Paquete creado con scripts `storybook` / `storybook:build`; 48 ficheros `.stories.tsx`; 19 átomos, 16 moléculas, 14 organismos en `packages/ui/src/{atoms,molecules,organisms}/` | `storybook:build` ✓ (evidencia en adversarial-report, `storybook-static/` presente); 371 tests verdes (re-ejecutados en esta revisión) | ✅ |
| CA-2 | Paleta/tokens Tailwind v4 + claro/oscuro en todas las historias | `packages/ui/src/theme.css` con `@theme`, tokens `--ink-*`, `:root[data-theme="dark"]` + `prefers-color-scheme`; decorator global con toolbar de tema | Tests de `ThemeToggle` y `lib/theme.spec.ts`; verificación visual dual-tema → manual (`manual-test-plan.md` §3.1) | ✅ (visual: manual pendiente, cubierto por plan) |
| CA-3 | Tests Vitest+TL para átomos/moléculas; typecheck monorepo | 50 ficheros de spec en `ui` | `npm run test --workspace @langopia/ui` → 371/371; `npm run typecheck` raíz → 0 errores (ambos re-ejecutados) | ✅ |
| CA-4 | `apps/app` compila/arranca con el nuevo nombre; CI pasa | Rename coordinado (commit `af93d13`); `ci.yml` referencia `apps/app` y corre sus 412 tests + e2e; build de app ✓ (adversarial-report, 877 ms) | 412/412 tests app (re-ejecutados); 0 restos de `apps/web`/`langopia-web` fuera de docs históricos; worktree CLI 10/10 | ✅, con **brecha B-CI** (tests de `ui` y `storybook:build` no están en CI, ver Pasada 2 / ADR-004) |
| CA-5 | App responde en `app.langopia.com` y consume la API sin CORS/cookies | Sin cambios de código necesarios: rewrite same-origin `/api/*` ya existente en `apps/app/vercel.json`, trusted origins con wildcard `.langopia.com`, alias preview `pr-N.app.langopia.com` en `preview-deploy.yml` (L82/L154) | e2e `wave-1.spec.ts` cubre login → sesión → llamada autenticada en CI; dominio real requiere pasos manuales Vercel | ⏳ **Pendiente de pasos manuales Vercel** (checklist pre-merge documentada en `manual-test-plan.md` §3.2–3.4; no implementable en repo, no es un defecto) |
| CA-6 | Documentación breve del design system | **Inexistente**: no hay `packages/ui/README.md` ni equivalente | Búsqueda exhaustiva de README/MDX en el repo | ❌ **Brecha B-DOC** (condición 1 del veredicto) |

Cobertura del catálogo del brief: los 14 organismos, las 16 moléculas y los átomos listados están presentes (el conteo real de átomos es 19 porque `ThemeToggle` vive en `atoms/` aunque el brief lo lista como molécula — desviación de clasificación sin impacto funcional, coherente con el slice-plan que lo entrega en el slice 1).

## Pasada 2 — Arquitectura (conformidad con ADR-001…006)

| ADR | Decisión | Conformidad |
|---|---|---|
| ADR-001 | Paquete fuente TS sin build | ✅ `packages/ui/package.json` exporta `./src/index.ts` y `./src/theme.css`; no hay `dist` ni script `build`; toolchain espejo de la app (TS ~6.0.2, React 19, Vitest 4). |
| ADR-002 | Theme CSS-first compartido | ✅ `theme.css` movido sin renombrar tokens; `apps/app/src/index.css` hace `@import "@langopia/ui/theme.css"` + `@source "../../../packages/ui/src"`. Riesgo RD-3 (`@source`) mitigado: build de app verificado con selectores `data-theme` y tokens en el CSS final (adversarial-report §29). |
| ADR-003 | Atomic design + Tailwind, sin CSS Modules | ✅ Estructura `atoms/molecules/organisms/fixtures`; `src/architecture.spec.ts` (3 tests en la suite, verdes) hace cumplir átomos ← moléculas ← organismos, prohíbe `@langopia/*`, `lucide-react`, `react-router-dom` y `fetch`; helper `lib/cx.ts`; cero CSS Modules. Deuda conocida del spec (imports dinámicos/`window.fetch`) registrada en el ledger (Task 1). |
| ADR-004 | Storybook como catálogo, **validado en CI** sin publicación | ⚠️ Storybook, historias colocadas junto al componente y toolbar de tema: ✅. **Pero `ci.yml` no contiene `storybook:build` ni tests de `@langopia/ui`** (verificado leyendo todos los pasos `run:` del workflow) — desviación de «build en CI como smoke» (**brecha B-CI**, condición 2 del veredicto). Sin publicación: ✅ conforme. |
| ADR-005 | Rename en un commit coordinado | ✅ Commit `af93d13` incluye `git mv`, scripts raíz (`app:dev`/`app:build`), `ci.yml`, `preview-deploy.yml` (proyecto `langopia-app`, alias `pr-N.app.langopia.com`), `vercel.json`, `.gitignore`, worktree CLI (10/10), docs operativa y lockfile. 0 restos fuera de `docs/superpowers/**` y docs de la propia feature (intencionado). Checklist Vercel: pendiente, manual, documentada. |
| ADR-006 | Proxy same-origin para `app.langopia.com` | ✅ Sin cambios de código (correcto según el ADR): rewrite `/api/*` → `api.langopia.com` intacto en `apps/app/vercel.json`; `langopia.com` no añadido a `TENANT_BASE_DOMAINS`; cookie first-party. Env vars de Vercel: checklist manual pendiente. |

**Dirección de imports**: garantizada por `packages/ui/src/architecture.spec.ts` (análisis estático de imports, mismo patrón que `apps/api`), en verde dentro de la suite de 371 tests.

**Dependencias añadidas**: `react-hook-form` y `zod` declaradas como `peerDependencies` de `@langopia/ui` (y como devDependencies para sus tests); ambas ya existentes en el monorepo (`apps/app` las tiene en dependencies). Storybook 8 y fontsource como deps del paquete. Sin dependencias de runtime nuevas de terceros para componentes (iconos SVG propios, sin Radix/cva), conforme a ADR-003. La phantom dependency `@langopia/ui` en `apps/app` (B-5b) está corregida: declarada en `apps/app/package.json` (commit `917bff9`).

**Deuda técnica añadida (registrada en el ledger `progress.md`)**: minors diferidos por tarea (Tasks 1–15: p. ej. navegación por flechas en Calendar, ítems `role="menuitem"` en TreeDots pendientes de la futura molécula de menú, fixtures/convenciones menores) y deuda adversarial diferida (B-4 emojis en iniciales, B-5 reentrada RHF mismo tick, B-6 values duplicados en selectores, B-7 NaN en KpiChart, B-8 Escape combobox⊂TreeDots, B-9 sync de tema entre pestañas, FOUC de tema al cablear el toggle en la app). Toda ella es de severidad baja, está triageada y tiene fix recomendado escrito en `adversarial-report.md`. Añadir a esa lista las brechas B-DOC y B-CI si se aceptan como deuda en vez de cerrarse ahora.

## Pasada 3 — Adversarial (seguimiento de `adversarial-report.md`)

El informe triageó 4 hallazgos para corrección inmediata. Verificado en código (no solo en el mensaje de commit):

| Hallazgo | Fix | Verificación en esta revisión |
|---|---|---|
| B-1 (alto proyectado) — doble submit en `CheckoutPage` | Commit `7a47cd5`: guardia interna `submitInFlightRef` (`CheckoutPage.tsx:145`), se libera al resolver/rechazar la promesa o en el siguiente microtask; `onSubmit` admite promesa | ✅ Código presente; 46 líneas de tests nuevas en `CheckoutPage.spec.tsx`; suite verde |
| B-2 (medio) — `UserAvatar` no se recupera de imagen fallida | Commit `7a47cd5`: `failedSrc` guarda la src que falló (`UserAvatar.tsx:50-51`), una src distinta reintenta | ✅ Código presente + 12 líneas de tests; suite verde |
| B-3 (medio) — `CrudForm` con `name` duplicados silencioso | Commit `7a47cd5`: `console.warn` en desarrollo (`CrudForm.tsx:328`) + keys `name`+índice + JSDoc | ✅ Código presente + 15 líneas de tests; suite verde |
| B-5b (bajo) — phantom dep `@langopia/ui` en `apps/app` | Commit `917bff9`: `"@langopia/ui": "*"` en dependencies + lockfile | ✅ Confirmado en `apps/app/package.json` |

**Deuda diferida registrada**: ✅ `progress.md` (líneas de triaje adversarial) enumera explícitamente B-4, B-5, B-6, B-7, B-8, B-9 y el FOUC de tema como diferidos con severidad baja, y `manual-test-plan.md` §4 los recoge como riesgo aceptado. Riesgo R-1 (doble cobro al conectar Stripe) queda mitigado por la guardia interna ya mergeada; la recomendación «antes de conectar pagos» del informe está cumplida.

## Pasada 4 — Regresión / Manual (seguimiento de `manual-test-plan.md`)

El plan distingue correctamente lo automatizado de lo manual y cubre lo no automatizable:

- **§3.1 Visual Storybook**: recorrido del índice (18/16/14 componentes), tema dual en historias representativas, viewport móvil de Shell y LandingPage. No automatizable sin Chromatic (decisión ADR-004); cobertura correcta.
- **§3.2 Checklist Vercel (bloqueante pre-merge)**: crear `langopia-app`, migrar env vars (incl. `BETTER_AUTH_TRUSTED_ORIGINS` si está definida), asignar `app.langopia.com`, verificar rewrite `/api/*`, archivar `langopia-web`. Es exactamente la del ADR-005/006.
- **§3.3 Post-deploy**: login real, persistencia de sesión, llamada autenticada sin CORS, retirada del dominio anterior.
- **§3.4 Preview de la PR**: comentario del workflow con `pr-N.app.langopia.com` + login en preview.
- **§4 Riesgos aceptados**: FOUC de tema, flechas en Calendar, teclado completo de TreeDots, sync de tema entre pestañas — todos trazables a la deuda registrada en el ledger.

**Regresión re-ejecutada en esta revisión**: `ui` 371/371, `app` 412/412, typecheck raíz 0 errores, worktree CLI 10/10. El plan afirma 1032 tests en `@langopia/api`; no se re-ejecutaron aquí (la API no tiene cambios de código en esta feature — verificado en `solution.md` «Sin cambios de código» y en el diff de la rama), pero CI los corre en cada push.

## Condiciones para convertir en APPROVED

1. **B-DOC (CA-6)**: añadir documentación breve del DS (sugerencia: `packages/ui/README.md` con cómo añadir un componente, reglas atomic design y uso del theme), o registrar la desviación como deuda aceptada en el ledger.
2. **B-CI (ADR-004)**: añadir a `.github/workflows/ci.yml` `npm run test --workspace @langopia/ui` y `npm run storybook:build --workspace @langopia/ui`, o enmendar ADR-004 declarando la validación local/manual y registrar la deuda.

**Recordatorio operativo pre-merge (no es condición del veredicto, es proceso ya acordado)**: ejecutar la checklist Vercel de `manual-test-plan.md` §3.2 antes de mergear a `main` (riesgo RD-1: el deploy de CI deriva el proyecto del nombre del directorio y fallará si `langopia-app` no existe).

---

## Actualización post-CONDITIONAL (commit b8db031)

Las dos condiciones quedan cerradas:

- **B-DOC**: creado `packages/ui/README.md` (uso, estructura, convenciones, ADRs). CA-6 cumplido.
- **B-CI**: `.github/workflows/ci.yml` ejecuta ahora `npm run test --workspace @langopia/ui` y `npm run storybook:build --workspace @langopia/ui` como pasos del job `verificar`. ADR-004 cumplido.

**Veredicto actualizado: APPROVED.** Único pendiente: checklist manual de Vercel (manual-test-plan.md §3.2) antes de mergear a `main`, de naturaleza operativa y documentada.
