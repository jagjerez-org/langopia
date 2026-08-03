# ADR-005 — Rename `apps/web` → `apps/app` en un commit coordinado

- Estado: aceptado
- Fecha: 2026-08-03

## Contexto

El workspace `apps/web` (`@langopia/web`, proyecto Vercel `langopia-web`) debe pasar a `apps/app` (`@langopia/app`, `langopia-app`). La exploración localizó 9 acoplamientos duros (ver `domain-analysis.md`, mapa de impacto). El bucle de deploy de CI deriva el proyecto Vercel del nombre del directorio (`langopia-$app`), así que el rename y la existencia del proyecto Vercel deben coordinarse.

## Decisión

Un **único commit de rename** que incluye:

1. `git mv apps/web apps/app` y `"name": "@langopia/app"` en su `package.json`.
2. Scripts raíz: `app:dev`, `app:build` (y `dev` compuesto).
3. `.github/workflows/ci.yml`: workspaces del panel y rutas de artefactos.
4. `.github/workflows/preview-deploy.yml`: rutas, `langopia-app`, alias `pr-N.app.langopia.com`.
5. `apps/app/vercel.json`: `buildCommand` con el nuevo workspace.
6. `.gitignore` (rutas Playwright).
7. Worktree CLI: clave `web` → `app` en `scripts/worktree/{ports.ts,env.ts,cmd/dev.ts,cmd/add.ts,cmd/list.ts}` + `__tests__/ports.test.ts` (el filtro de `wt:dev` invoca `${app}:dev`; se cambian ambos lados a la vez).
8. Docs operativa: `ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/TRASPASO.md`, `AGENTS.md`. **No** se tocan `docs/superpowers/**` (histórico) ni comentarios "Tarea N del panel".
9. `npm install` para regenerar `package-lock.json`.
10. Comentarios autorreferenciales dentro de `apps/app/src/**`.

### Checklist manual en Vercel (ANTES de mergear a `main`)

- [ ] Crear proyecto `langopia-app` (mismo framework preset: Vite, root `apps/app`).
- [ ] Migrar env vars de `langopia-web` (si las hubiera; el panel no usa `VITE_*`).
- [ ] Asignar dominio `app.langopia.com` a `langopia-app` (ver ADR-006).
- [ ] Verificar deploy desde CI en `main`.
- [ ] Archivar `langopia-web`.

## Consecuencias

- El rename es atómico: no hay estados a medias con doble nombre.
- Orden en la feature: el rename es la **Fase 4**, después de que el DS exista, para no mezclar riesgos.
- Las PRs abiertas contra `apps/web` tendrán conflictos; comunicar antes del merge.

## Alternativas consideradas

- Rename gradual con alias (`web:dev` mantenido): doble nombre persistente; rechazado.
- Renombrar el proyecto Vercel existente: Vercel no reasigna dominios/env limpiamente; proyecto nuevo + archivo es más seguro y reversible.
