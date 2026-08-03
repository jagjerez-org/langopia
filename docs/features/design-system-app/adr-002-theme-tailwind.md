# ADR-002 — Theme compartido CSS-first de Tailwind v4

- Estado: aceptado
- Fecha: 2026-08-03

## Contexto

`apps/web/src/ui/tokens.css` ya define el sistema visual completo (tokens `--ink-*`, bisagra `@theme inline`, doble modo oscuro `:root[data-theme="dark"]` + `prefers-color-scheme`, fuentes Geist, `prefers-reduced-motion`). Tailwind v4 se configura en CSS (no hay `tailwind.config.js`). El riesgo R-5 del brief exige que el theme sea consumible por el paquete y las apps sin duplicar configuración.

## Decisión

1. **Mover** `apps/web/src/ui/tokens.css` a `packages/ui/src/theme.css` sin renombrar tokens (cero churn; un posible rename de `--ink-*` se difiere).
2. El paquete lo expone como subpath `./theme.css`.
3. Cada app consumidora lo importa en su CSS de entrada y declara la fuente del paquete:

```css
@import "tailwindcss";
@import "@langopia/ui/theme.css";
@source "../../packages/ui/src";
```

4. Las fuentes Geist viajan dentro del theme (una única importación, como hoy).

## Consecuencias

- Una sola fuente de verdad visual; las apps no definen tokens propios.
- Los nombres de tokens y las utilidades generadas (`bg-canvas`, `text-muted`…) son el contrato CSS del sistema.
- Si `@source` falta o apunta mal, la UI pierde estilos solo en producción: se verifica con build en la Fase 1 y con el e2e de preview (riesgo RD-3 de `solution.md`).

## Alternativas consideradas

- Theme duplicado por app: divergencia garantizada; rechazado.
- Paquete JS de tokens (`tailwind.config` compartido): Tailwind v4 es CSS-first; mezclar config JS iría contra la convención ya adoptada.
- Renombrar `--ink-*` a `--lang-*` ahora: churn masivo sin valor; diferido.
