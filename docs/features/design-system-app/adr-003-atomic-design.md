# ADR-003 — Atomic design con Tailwind utilities (adiós CSS Modules)

- Estado: aceptado
- Fecha: 2026-08-03

## Contexto

El brief pide atomic design (átomos/moléculas/organismos) y Tailwind. El DS actual usa CSS Modules + `data-variant` por componente. Mantener ambos sistemas duplicaría el idioma de estilos. El usuario ha decidido: Tailwind utilities + theme compartido, migrando los componentes existentes.

## Decisión

1. Estructura `src/atoms/`, `src/molecules/`, `src/organisms/`, `src/fixtures/` en `packages/ui`.
2. Regla de dependencia: **átomos ← moléculas ← organismos**; prohibido importar hacia abajo o entre niveles inferiores. Verificada por `packages/ui/src/architecture.spec.ts` (análisis de imports, mismo patrón que `apps/api/src/architecture.spec.ts`).
3. Estilos con clases Tailwind; variantes con selectores nativos `data-[variant=…]:` y un helper interno mínimo `lib/cx.ts` para clases condicionales. Sin `cva` ni CSS Modules.
4. Se mantiene la convención de **no exponer `className`** en las props (los consumidores componen, no redecoran), salvo excepciones documentadas de layout.
5. Migración inicial: componentes de `apps/web/src/ui/` (Button, Input, Select, Card, Tag, Dialog, Toast, EmptyState, ErrorState, Skeleton, Icons) se convierten a átomos/moléculas y la app pasa a consumirlos desde `@langopia/ui`.
6. Iconos: set SVG propio (`atoms/Icons`), sin dependencias nuevas.
7. Cero literales de UI: todo texto por props (i18n vive en las apps).

## Consecuencias

- Un solo idioma de estilos en todo el frontend.
- Las clases usadas dentro del paquete dependen del `@source` de la app (ver ADR-002).
- Los CSS Modules antiguos desaparecen conforme se migran componentes; `apps/web/src/ui/` queda vacío al final de la Fase 1.

## Alternativas consideradas

- CSS Modules también en el paquete: dos sistemas; rechazado.
- `cva`/Radix: dependencias innecesarias hoy; reevaluable si un componente (combobox con búsqueda) exige gestión de foco compleja.
- Permitir `className` libre: rompe la encapsulación del sistema; rechazado salvo excepción documentada.
