# ADR-004 — Storybook como catálogo, validado en CI sin publicación

- Estado: aceptado
- Fecha: 2026-08-03

## Contexto

El brief pide un proyecto Storybook para desarrollar y exhibir los componentes reutilizables. No existe Storybook en el repo. El usuario decidió: build en CI como validación, sin publicación (ni Chromatic ni Vercel) en esta fase.

## Decisión

1. Storybook con `@storybook/react-vite` dentro de `packages/ui`, compartiendo la major de Vite del monorepo.
2. Historias colocadas junto al componente (`Button.stories.tsx`); una historia por variante/estado relevante; los organismos-página consumen `src/fixtures/`.
3. Decorator global con toolbar de tema claro/oscuro: toda historia es inspeccionable en ambos temas (soporte de la regla DR-4).
4. Scripts: `storybook` (dev) y `storybook:build` (smoke en CI). Tests de comportamiento con Vitest + Testing Library, **no** con Storybook test-runner.

## Consecuencias

- El catálogo es la referencia visual del sistema en desarrollo.
- CI gana un paso de build estático (minutos); aceptable como smoke.
- Sin superficie pública ni credenciales nuevas.

## Alternativas consideradas

- Publicar Storybook en Vercel/Chromatic: coste y credenciales sin requisito; rechazado por ahora.
- Ladle/Histoire como alternativa ligera: Storybook es el estándar pedido por el brief y su ecosistema (decorators, toolbar) cubre el requisito de tema dual sin código propio.
