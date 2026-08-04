# ADR-001 — Paquete `@langopia/ui` en `packages/ui`, exportando fuente TypeScript

- Estado: aceptado
- Fecha: 2026-08-03

## Contexto

El design system debe vivir en un paquete compartido del monorepo. Los paquetes existentes (`@langopia/contracts`, `@langopia/db`) compilan a `dist` CJS con `tsc` porque su consumidor principal es la API NestJS (CommonJS/NodeNext). El consumidor de `ui` es exclusivamente Vite/React (ESM, `moduleResolution: bundler`), hoy `apps/web` y mañana `apps/sites` u otros.

## Decisión

Crear `packages/ui` (`@langopia/ui`, privado) que **exporta fuente TypeScript sin paso de build**:

```jsonc
{
  "name": "@langopia/ui",
  "exports": {
    ".": "./src/index.ts",
    "./theme.css": "./src/theme.css"
  }
}
```

Toolchain espejo de `apps/web`: TypeScript ~6.0.2, React 19, Vitest 4 + jsdom + Testing Library (`globals: false`, cleanup explícito), `verbatimModuleSyntax`, jsx `react-jsx`.

## Consecuencias

- Las apps transpilan la fuente del paquete con su propio Vite; no hay artefacto `dist` ni doble compilación.
- Tailwind v4 de la app consumidora debe conocer la fuente del paquete vía `@source` (ver ADR-002).
- El paquete no puede ser consumido por la API NestJS (CJS) — no es un objetivo.
- `npm run build --workspace @langopia/ui` no existe; CI valida con `typecheck`, tests y `storybook:build`.

## Alternativas consideradas

- Build con `tsc`/`tsup` a `dist` ESM: artefacto innecesario y sourcemaps más frágiles cuando el consumidor siempre es Vite.
- Publicar en npm: fuera de alcance; paquete privado del monorepo.
