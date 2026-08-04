# Estrategia de tests — Design System Langopia + rename + dominio

> Entradas: `brief.md`, `solution.md`.

## Matriz de trazabilidad: criterio → test

| ID | Criterio de aceptación (del brief) | Test | Tipo | Datos / mocks | Automatizado |
|---|---|---|---|---|---|
| CA-1 | `packages/ui` existe con Storybook arrancable que muestra todos los componentes listados | SMOKE-001: `npm run storybook:build` termina sin errores | Smoke / build | Historias de cada componente | ✅ |
| CA-1 |  | SMOKE-002: `npm run typecheck --workspace @langopia/ui` pasa | Typecheck | — | ✅ |
| CA-1 |  | SMOKE-003: `npm run test --workspace @langopia/ui` pasa | Unitario (suite) | — | ✅ |
| CA-2 | Paleta y tokens Tailwind v4, tema claro/oscuro funcionando en todas las historias | ATOM-TOGGLE-001: ThemeToggle cambia `data-theme` y persiste en `localStorage` | Unitario | `localStorage` mock | ✅ |
| CA-2 |  | HIST-001: Decorador global aplica modo oscuro a todas las historias | Storybook (manual/vis) | Historias de átomos y moléculas | ✅ build, ⚠️ visual manual |
| CA-2 |  | ATOM-BUTTON-001: Button renderiza en claro y oscuro con contraste suficiente | Unitario | `render` con wrapper de tema | ✅ |
| CA-3 | Tests de componentes (Vitest + Testing Library) para átomos y moléculas; `npm run typecheck` pasa en todo el monorepo | ATOM-*: un test por átomo de comportamiento/variantes | Unitario | Props + fixtures | ✅ |
| CA-3 |  | MOL-*: un test por molécula de interacción | Unitario / integración ligera | Mocks de handlers, user-event | ✅ |
| CA-3 |  | TYPECHECK-001: `npm run typecheck` raíz pasa | Typecheck | — | ✅ |
| CA-3 |  | COVERAGE-001: cobertura ≥ 80 % en `packages/ui/src/**` | Cobertura | — | ✅ |
| CA-4 | `apps/app` compila y arranca con el nuevo nombre; CI pasa | RENAME-001: `git mv` + cambios de referencias no rompen `npm run typecheck` | Typecheck | — | ✅ |
| CA-4 |  | RENAME-002: `npm run app:dev` levanta el servidor en `localhost:5173` | Manual local | — | ⚠️ manual |
| CA-4 |  | RENAME-003: CI (`ci.yml`) pasa en la rama del rename | CI / e2e | Base de datos de test real | ✅ |
| CA-4 |  | RENAME-004: `scripts/worktree/__tests__` pasan tras renombrar `web` → `app` | Unitario | — | ✅ |
| CA-5 | App responde en `app.langopia.com` y consume API sin errores de CORS ni cookies | E2E-001: login → sesión → llamada autenticada en preview del rename | E2E (Playwright) | Escuela seed + usuario demo | ✅ |
| CA-5 |  | MANUAL-001: verificación de `BETTER_AUTH_TRUSTED_ORIGINS=https://app.langopia.com` en Vercel | Manual | — | ⚠️ manual |
| CA-5 |  | MANUAL-002: certificar dominio `app.langopia.com` asignado a `langopia-app` y rewrite `/api/*` | Manual | — | ⚠️ manual |
| CA-6 | Documentación breve del design system | DOC-001: review de `packages/ui/README.md` (existente y completo) | Revisión manual | — | ⚠️ manual |

## Tipos de test y justificación

### Unitarios con Vitest + jsdom + Testing Library

- **Átomos**: renderizado, variante por defecto, estados (`disabled`, `error`, `checked`), eventos (`onClick`, `onChange`), forwarding de `ref`, atributos de accesibilidad.
- **Moléculas**: interacción compleja (formulario: validación con `react-hook-form` + `zod`, envío, error), navegación (`SideNavBar`, `Breadcrumb`), toggle de tema.
- **Organismos**: se testean solo si añaden lógica de interacción; la mayoría son composición visual y se cubren con historias de Storybook.

**Convenciones heredadas de `apps/web`**:

- `environment: "jsdom"`, `globals: false`, setup con `cleanup` explícito en `afterEach`.
- `user-event@14` para interacciones.
- Mocks con `vi.hoisted` + `vi.mock` cuando sea necesario.

### Test de arquitectura

- `packages/ui/src/architecture.spec.ts` verifica:
  - `atoms/` no importa de `molecules/` ni `organisms/`.
  - `molecules/` no importa de `organisms/`.
  - Nada de `packages/ui` importa `@langopia/contracts`, `@langopia/db`, `@langopia/api`, `lucide-react` (los iconos son propios) ni hace fetch.
  - Los componentes no importan `react-router-dom` ni `dominio específico de app`.

### Smoke / typecheck

- `npm run typecheck --workspace @langopia/ui` — TypeScript estricto del paquete.
- `npm run typecheck` raíz — valida que `apps/app` y demás workspaces siguen compilando tras consumir `@langopia/ui`.
- `npm run storybook:build` — asegura que todas las historias compilan y el catálogo es navegable.

### E2E (Playwright)

- Se reutiliza la suite existente (`apps/web/e2e/wave-1.spec.ts`) adaptando la ruta de trabajo a `apps/app`.
- Escenario específico del dominio: login en `https://pr-N.app.langopia.com`, navegación, y llamada autenticada (valida cookie + CORS/Origin).

### Manual

- Configuración de Vercel (proyecto, dominio, env vars) no puede automatizarse desde el repo sin credenciales adicionales.
- Verificación visual de tema oscuro/claro y pixel-perfect: Storybook facilita la inspección, pero no reemplaza el ojo humano.

## Datos de test y mocks

### Fixtures del paquete (`packages/ui/src/fixtures/`)

- `button.ts`: variantes y tamaños.
- `forms.ts`: estados de formulario (vacío, inválido, cargando, éxito, error).
- `calendar.ts`: días con eventos, días deshabilitados, recordatorios, tareas.
- `lists.ts`: filas con tags, acciones, paginación.
- `pages.ts`: datos de demostración para cada organismo-página (KPI, Student, Payments, etc.).

### Mocks

- `localStorage` para el toggle de tema (`Storage.prototype.getItem` / `setItem`).
- `matchMedia` para `prefers-color-scheme`.
- `IntersectionObserver` si organismos lo usan para lazy loading (default jsdom lo ausenta).
- `fetch` no se mockea en el paquete; no hay llamadas de red.

## Cobertura

- Objetivo: **≥ 80 %** en `packages/ui/src/**`.
- Excepciones: `src/fixtures/**` (datos) y archivos `.stories.tsx` quedan excluidos de la medición.
- Cobertura no es requisito para historias; solo para lógica de componentes.

## Brechas identificadas y seguimiento

| Brecha | Por qué ocurre | Mitigación |
|---|---|---|
| Storybook visual (regresión visual) | No hay Chromatic ni screenshot testing automatizado | Inspección manual + build de Storybook como smoke. Posible Chromatic en fase futura. |
| Theme oscuro en producción | Depende de `@source` correcto en la app | Verificación temprana con build de producción y e2e. |
| Rename rompe preview-deploy.yml | El alias pasa a `pr-N.app.langopia.com`; requiere Vercel manual | Checklist ADR-005. |
| Cookies de sesión en dominio nuevo | Host-only cookie invalida sesiones previas | Comunicar a usuarios; no hay cambio funcional. |
| Componentes migrados de `apps/web/src/ui/` | Podrían perder comportamientos al pasar de CSS Modules a Tailwind | Tests de átomos existentes se migran con ellos. |

## Tests a añadir tras la implementación

- `no-untranslated-literals.spec.ts` en `packages/ui` (copia/adaptación de `apps/web/src/i18n/no-untranslated-literals.spec.ts`) para asegurar que los componentes del DS no renderizan textos propios.
- `architecture.spec.ts` del paquete (reglas atomic design).
- Si se decide publicar Storybook más adelante: test de accesibilidad automatizado (`storybook-addon-a11y`) y/o Chromatic.
