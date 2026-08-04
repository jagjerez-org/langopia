# `@langopia/ui` — Design system de Langopia

Paquete privado del monorepo con el sistema de diseño completo: tema, átomos, moléculas y organismos. Se consume como **fuente TypeScript** (sin build intermedio): los consumidores son apps Vite/React (`apps/app`, futuras), que lo compilan con su propio pipeline (ADR-001).

## Arranque rápido

```bash
npm run storybook --workspace @langopia/ui   # catálogo en http://localhost:6006
npm run test --workspace @langopia/ui        # tests unitarios + arquitectura
npm run storybook:build --workspace @langopia/ui  # smoke del catálogo (corre en CI)
```

## Uso desde una app

```ts
import { Button, LoginForm, Shell } from "@langopia/ui";
```

```css
/* index.css de la app consumidora */
@import "tailwindcss";
@import "@langopia/ui/theme.css";
@source "../node_modules/@langopia/ui/src"; /* que Tailwind vea las clases del paquete */
```

El tema es CSS-first de Tailwind v4 (ADR-002): todos los tokens viven en `src/theme.css` con prefijo `--ink-*` (colores, tipografía Geist, radios, sombras, z-index, duraciones). Modo oscuro vía `:root[data-theme="dark"]` o `prefers-color-scheme`; el átomo `ThemeToggle` + `lib/theme.ts` gestionan la preferencia persistida.

## Estructura (atomic design, ADR-003)

```
src/
├── theme.css            # tokens compartidos (única fuente de verdad visual)
├── atoms/               # Button, Input, Selector, Chip, CalendarDay, UserAvatar… (19)
├── molecules/           # LoginForm, CrudForm, List, Calendar, SideNavBar, KpiChart… (16)
├── organisms/           # Shell, SiteBuilder, CheckoutPage, LandingPage, KpiPage… (14)
├── fixtures/            # datos mock para stories y specs (no se exportan del barrel)
└── architecture.spec.ts # dirección de imports verificada en test
```

Regla de dependencia estricta, verificada por `architecture.spec.ts`: **átomos ← moléculas ← organismos**. Prohibido al revés, prohibido `fetch`, `@langopia/contracts`, `@langopia/db` y `react-dom/server` dentro del paquete.

Cada componente vive en su carpeta con tres ficheros: `<Nombre>.tsx`, `<Nombre>.spec.tsx` (Vitest + Testing Library), `<Nombre>.stories.tsx` (Storybook CSF3).

## Convenciones

- **Estilos**: solo utilidades Tailwind sobre los tokens del tema. Sin CSS Modules, sin `style` inline en componentes, sin `className` libre en las props públicas.
- **i18n**: los componentes no llevan textos acoplados; todo copy llega por props ya traducido (la app soporta es/en/gl/pt/de).
- **Formularios**: `react-hook-form` + `zod` (peer dependencies — la app las aporta; ya son stack del monorepo).
- **Accesibilidad**: roles ARIA reales, teclado completo en combobox/menús, nombres accesibles obligatorios en controles de solo icono, tests por rol/nombre accesible.
- **Datos**: organismos con datos mock por props + callbacks; ninguna pieza del paquete habla con la API.

## Decisiones de diseño

Los ADRs de esta feature viven en `docs/features/design-system-app/` (adr-001 a adr-006): paquete fuente TS, theme CSS-first, atomic design, Storybook sin publicación, rename `apps/web` → `apps/app`, dominio `app.langopia.com` con proxy same-origin.
