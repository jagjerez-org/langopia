# CLI de Git Worktrees para Langopia

## Objetivo

Crear un CLI interno para gestionar Git worktrees aislados dentro de `.worktrees/`, con asignación automática de puertos y bases de datos Postgres aisladas por worktree. Inspirado en el CLI de worktrees de Kadens (`scripts/worktree.mjs`), pero adaptado al stack y estructura de Langopia.

## Contexto

Langopia es un monorepo npm workspaces con:

- `apps/web`: frontend Vite (puerto base 5173).
- `apps/api`: backend NestJS (puerto base 3000).
- `apps/sites`: sitios Astro (puerto base 4321).
- `packages/db`: esquema y migraciones Drizzle.
- Postgres local en `localhost:5432` (según `.env.example`).

Actualmente no existe ninguna herramienta para trabajar con worktrees; los desarrolladores deben gestionarlos manualmente con `git worktree`.

## Decisiones de diseño

| Decisión | Valor | Razón |
|----------|-------|-------|
| Lenguaje | TypeScript + `tsx` | Consistente con el resto del monorepo. Permite ejecutar sin build step. |
| Ubicación | `scripts/worktree.ts` | Suficiente para un CLI interno; se puede dividir en `scripts/worktree/` si crece. |
| Carpeta de worktrees | `.worktrees/` | Consistente con Kadens y el skill `using-git-worktrees`. |
| Prefijo scripts | `wt:*` | Corto, consistente con Kadens. |
| Step de puertos | `1` | Cada app usa un único puerto base; no se necesitan rangos grandes. |
| Gestión de DB | Aislada por worktree, con fallback a DB compartida (`--no-db`) | Evita que migraciones/seeds de un worktree afecten a otros. |

## Comandos

| Comando | Descripción |
|---------|-------------|
| `wt:add <name> [--from <branch>] [--no-db] [--clone-from <source>\|main] [--seed]` | Crea un worktree, copia `.env`, asigna puertos, configura DB aislada, instala deps y abre VSCode. |
| `wt:remove <name> [--branch] [--keep-db]` | Elimina el worktree, limpia registries y borra la DB aislada (salvo `--keep-db`). |
| `wt:list` | Muestra worktrees activos con branch, puertos y DB; detecta colisiones de offset. |
| `wt:open <name>` | Abre el worktree en VSCode (`code <path>`). |
| `wt:dev [name] [--filter web\|api\|sites]` | Lanza desarrollo en el worktree indicado (o main si no se indica). |
| `wt:db <name> [init\|push\|migrate\|generate\|seed\|studio\|status\|drop\|clone]` | Gestión de la DB aislada del worktree. |
| `wt:clean [--all]` | Elimina directorios huérfanos en `.worktrees/` que git ya no trackea. |

## Configuración de puertos

Los puertos base se definen en el CLI:

| App | Puerto base |
|-----|-------------|
| web | 5173 |
| api | 3000 |
| sites | 4321 |

Cada worktree recibe un offset entero único (empezando por 1), registrado en `.worktrees/.ports.json`. El puerto efectivo es `base + offset`.

Ejemplo para worktree con offset `3`:

- web: 5176
- api: 3003
- sites: 4324

El offset se asigna automáticamente al crear el worktree, evitando colisiones con los existentes.

## Gestión de bases de datos

- El nombre de la DB aislada se deriva del nombre del worktree: `langopia_<name>` (reemplazando `-` por `_`).
- El registro se guarda en `.worktrees/.databases.json`.
- Las credenciales se leen del `.env` del repo raíz (`DATABASE_URL`, `DATABASE_URL_APP`).
- Al crear un worktree, el CLI reescribe las siguientes variables en su `.env`:
  - `DATABASE_URL`
  - `DATABASE_URL_APP`
  - `BETTER_AUTH_URL`
  - `BETTER_AUTH_TRUSTED_ORIGINS`
  - `API_URL`
- Por defecto, la DB se clona desde la DB principal (`langopia`). Con `--no-db` se usa la DB compartida. Con `--clone-from <source>` se clona desde otro worktree.

## Estructura de archivos

```text
package.json               ← scripts wt:* y devDependency tsx
.gitignore                 ← añadir .worktrees/
scripts/
  worktree.ts              ← entry point del CLI
  worktree/                ← módulos auxiliares (solo si el script crece)
    args.ts
    db.ts
    ports.ts
    git.ts
```

## Registries

Tres archivos JSON dentro de `.worktrees/`:

- `.ports.json`: `{ "<name>": <offset> }`
- `.databases.json`: `{ "<name>": "langopia_<name>" }`
- `.paths.json`: `{ "<name>": "/ruta/absoluta" }` (solo para directorios personalizados, no usado en la versión inicial)

## Flujo principal: `wt:add`

1. Validar nombre (`[a-zA-Z0-9._-]+`).
2. Validar que el branch base existe (`--from`, default `main`).
3. Asegurar que `.worktrees/` está en `.gitignore` (añadirlo si falta).
4. Ejecutar `git worktree add .worktrees/<name> -b <name> <base>`; si el branch ya existe, hacer checkout.
5. Copiar `.env` del repo raíz al worktree.
6. Asignar offset de puerto y escribir `.worktrees/.ports.json`.
7. Derivar nombre de DB y escribir `.worktrees/.databases.json` (salvo `--no-db`).
8. Reescribir variables de entorno del worktree para apuntar a sus puertos y DB.
9. Ejecutar `npm install` dentro del worktree.
10. Crear o clonar la DB aislada y ejecutar migraciones (si `--no-db`, omitir).
11. Ejecutar seed si se pidió (`--seed`).
12. Abrir VSCode con `code <path>`.

## Manejo de errores

- Verificar que el comando corre dentro de un repositorio git.
- No eliminar un worktree con cambios sin confirmación o `--force`.
- No borrar una DB sin `--force`.
- Si Postgres no está disponible, omitir la parte de DB y mostrar instrucciones para ejecutarla después.
- Si `code` no está disponible, mostrar el comando manual.

## Testing

- Tests unitarios mínimos para funciones puras:
  - `deriveDbName`
  - `assignOffset`
  - `parseArgs`
- No se añaden tests de integración contra git o Postgres para no ralentizar el CI.

## Notas de implementación

- `tsx` se añade como `devDependency` en root, ya que aunque existe en workspaces hijos, los scripts de root no lo heredan.
- El CLI no gestiona Docker; asume Postgres ya corriendo en localhost.
- El CLI se inspiró en `scripts/worktree.mjs` de Kadens, pero se simplifica eliminando funcionalidades específicas de Kadens (Redis, BullMQ, storage providers, tmux, etc.).
