# Release readiness — Design System Langopia + rename + dominio

> Fecha: 2026-08-04. Veredicto del pr-review: APPROVED.

## Estado de la implementación

| Entregable | Estado | Evidencia |
|---|---|---|
| `packages/ui` (18 átomos, 16 moléculas, 14 organismos, theme, Storybook) | ✅ Completo | 371 tests, storybook:build, architecture.spec |
| Tema claro/oscuro | ✅ Completo | ThemeToggle + lib/theme.ts + toolbar Storybook |
| Rename `apps/web` → `apps/app` | ✅ Completo | 0 restos, typecheck + 412 tests + build verdes |
| CI: tests ui + smoke Storybook | ✅ Completo | `.github/workflows/ci.yml` |
| Dominio `app.langopia.com` | ⬜ Config manual pendiente | Código listo (wildcard trusted origins + rewrite same-origin) |

## Riesgos de despliegue y mitigaciones

1. **RD-1 (principal): mergear sin crear `langopia-app` en Vercel rompe el deploy de main.** El bucle de CI deriva `langopia-app` del directorio `apps/app`. Mitigación: ejecutar la checklist Vercel del `manual-test-plan.md` §3.2 ANTES de mergear (crear proyecto, env vars, dominio). El orden importa.
2. **RD-2: previews de otras PRs abiertas** seguirán desplegando `langopia-web` hasta que se rebasen sobre main. Aceptable: `langopia-web` no se archiva hasta que no haya PRs antiguas activas.
3. **RD-3: worktrees locales existentes** con la CLI antigua: la clave `web` desaparece (`wt:dev app`). Comunicar a quien tenga worktrees vivos que se actualice.
4. **RD-4: FOUC de tema** cuando la app adopte el toggle: añadir script inline en `index.html` en esa fase (registrado en el ledger).

## Plan de rollout

1. Ejecutar checklist Vercel §3.2 (crear `langopia-app`, migrar env vars, asignar `app.langopia.com`).
2. Mergear la PR a `main` → CI despliega `langopia-api`, `langopia-app`, `langopia-sites`.
3. Verificación post-deploy (§3.3 del plan manual): login + llamada autenticada en `https://app.langopia.com`.
4. Si falla: el dominio anterior sigue activo hasta archivar `langopia-web` — rollback = reasignar dominio y revertir el merge.
5. Tras una semana estable: archivar `langopia-web`.

## No incluido en este release (alcance futuro)

- Migración de pantallas de la app al design system (adopción incremental posterior).
- Eliminación de `apps/app/src/ui/` legacy (cuando la migración consolide).
- Publicación de Storybook (Chromatic/Vercel).
- Landing real en `langopia.com` (el organismo LandingPage está listo; el despliegue es otra feature).
- Deuda menor registrada en el ledger (navegación por flechas en Calendar, molécula de menú completa para TreeDots, sync de tema entre pestañas…).
