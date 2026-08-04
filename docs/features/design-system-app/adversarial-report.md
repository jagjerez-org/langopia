# Informe de revisión adversarial — `design-system-app`

> Rama: `feat/design-system-app`. Fecha: 2026-08-04.
> Alcance: `packages/ui` (18 átomos, 16 moléculas, 14 organismos, 367 tests), rename `apps/web` → `apps/app`, dominio `app.langopia.com` (config-only).

## Veredicto

**No hay hallazgos Critical.** No hay XSS, no hay referencias rotas del rename y la suite completa (367 tests) pasa. El hallazgo más serio es un **posible doble pago en `CheckoutPage`** (B-1): el componente no tiene guardia interna contra doble submit y depende por completo de que el consumidor active `isProcessing` síncronamente. Como el checkout aún no está conectado a un proveedor de pago real, el impacto hoy es cero, pero debe corregirse **antes** de conectar Stripe.

Severidad resumida: 1 alto (B-1, proyectado a pagos), 3 medios (B-2, B-3, B-5), 5 bajos (B-4, B-6, B-7, B-8, B-9).

## Metodología

- Lectura del código de: `LoginForm`, `LeadForm`, `CrudForm`, `CheckoutPage`, `Selector`, `SelectorWithSearch`, `MultiSelector`, `MultiSelectorWithSearch`, `Calendar`, `CalendarDay`, `KpiChart`, `UserAvatar`, `TreeDots`, `ThemeToggle`, `Button`, `FormAction`, `lib/theme.ts`, `use-server-error.ts`.
- Suite existente: `npm run test --workspace @langopia/ui` → **50 ficheros, 367 tests, todos en verde**.
- Batería adversarial temporal de 25 tests (`packages/ui/src/adversarial.qa.spec.tsx`, creada para esta revisión y **borrada tras la ejecución** para no contaminar la suite; los pasos de reproducción están en la matriz): **25/25 ejecutados**, todas las hipótesis de ataque confirmadas o refutadas con evidencia.
- Rename: `grep` de `apps/web` / `langopia-web` / `@langopia/web` sobre todo el repo, `npm run typecheck` en `apps/app` y `packages/ui`, `npm run build --workspace @langopia/app` (✓ 877 ms, CSS con selectores `data-theme` y tokens `--ink-*` presentes), `npm run storybook:build` (✓), tests del worktree CLI (`npx tsx --test scripts/worktree/__tests__/*.test.ts` → 10/10).
- No se ha modificado código de producción.

## Matriz de ataque

| # | Escenario | Pasos | Esperado | Observado | Estado |
|---|-----------|-------|----------|-----------|--------|
| 1 | Doble clic real en LoginForm con `onSubmit` lento | Rellenar email/contraseña válidos, `userEvent.dblClick` en "Entrar", promesa sin resolver | Una sola llamada a `onSubmit` | 1 llamada; `isSubmitting` deshabilita el botón tras el primer clic | **PASS** |
| 2 | Doble submit nativo en el mismo tick (LoginForm/LeadForm/CrudForm) | Dos `fireEvent.submit(form)` síncronos con datos válidos y promesa pendiente | Una sola llamada (guardia de reentrada) | **2 llamadas**: `handleSubmit` de react-hook-form no guarda reentrada; solo el botón deshabilitado protege la interacción real (click/Enter) | **FAIL** (B-5, bajo) |
| 3 | Doble pago en CheckoutPage sin reacción del padre | Dos `fireEvent.submit` con `onSubmit` síncrono y `isProcessing` siempre `false` | Una sola llamada | **2 llamadas**: el guard `if (!isProcessing)` lee una prop que el padre aún no ha actualizado | **FAIL** (B-1, alto proyectado) |
| 4 | CheckoutPage con padre que activa `isProcessing` síncronamente | Harness con `setProcessing(true)` dentro de `onSubmit`, dos submits | Una sola llamada | 1 llamada: la protección funciona solo si el consumidor coopera | **PASS** (condicional) |
| 5 | CrudForm con `fields=[]` | Render y submit | No romper; envío coherente | Renderiza solo las acciones; envía `{}` | **PASS** |
| 6 | CrudForm con dos campos `name` duplicados | `fields=[{name:"email",type:"text"},{name:"email",type:"email",required}]` | Validación de config o comportamiento definido | Warning de duplicate key de React; el esquema zod se sobrescribe (gana el último); `register` compartido. Degradación silenciosa | **FAIL** (B-3, medio) |
| 7 | Selector con `options=[]` | Render con placeholder | No romper | Una sola `<option>` (placeholder), valor `""` | **PASS** |
| 8 | Selector/SelectorWithSearch/MultiSelector con `value` duplicados | Dos opciones con `value="a"` | Comportamiento definido | Warning duplicate key; en SelectorWithSearch dos `role=option` con **el mismo `id`** (`aria-activedescendant` ambiguo); en MultiSelector ambas copias se marcan a la vez | **FAIL** (B-6, bajo) |
| 9 | SelectorWithSearch con `options=[]` + teclado | Abrir, `↓ ↑ Enter Escape` | No romper, sin `onChange` | Muestra `noResultsLabel`, sin crash, `onChange` no llamado | **PASS** |
| 10 | UserAvatar con nombre emoji (`"😀 Prueba"`) | Render sin `src` | Iniciales `"😀P"` o emoji filtrado | `part[0]` corta el surrogate pair: renderiza **surrogate solitario + "P"** (carácter de reemplazo visible) | **FAIL** (B-4, bajo) |
| 11 | UserAvatar con nombre de 200 caracteres | Render sin `src` | Iniciales acotadas | `"AB"` (2 iniciales), sin desbordar | **PASS** |
| 12 | UserAvatar: imagen falla y luego llega `src` válida | `fireEvent.error(img)` → `rerender` con `src` nueva | Mostrar la nueva imagen | **`imageFailed` no se reinicia al cambiar `src`**: la imagen nueva nunca se muestra | **FAIL** (B-2, medio) |
| 13 | KpiChart `data=[0,0,0]` | Render | Línea plana sin NaN | Rango `0 \|\| 1`, puntos válidos | **PASS** |
| 14 | KpiChart `data=[NaN,1,2]` | Render | Ignorar o avisar | Puntos `NaN` en polyline/polygon: gráfica vacía **en silencio** | **FAIL** (B-7, bajo) |
| 15 | KpiChart valores negativos y enormes (`-1e12…1e12`) | Render | Normalizar sin NaN/Infinity | Puntos finitos correctos | **PASS** |
| 16 | Calendar con fecha inválida `"2026-02-30"` | Render con ese evento | Ignorar sin romper | Evento ignorado + `console.warn` en desarrollo (parse manual anti-desborde) | **PASS** |
| 17 | Calendar 29 feb / fin de mes | `defaultDate=2024-01-31`, navegar +1 mes | Febrero 2024, no marzo | `addMonths` recorta al último día: título "febrero de 2024" | **PASS** |
| 18 | Calendar cambio de año | Enero 2026, navegar −1 mes | Diciembre 2025 | Título "diciembre de 2025" | **PASS** |
| 19 | Calendar `firstDayOfWeek=9` (fuera de rango) | Render | Normalizar, no romper | Normaliza con módulo 7; rejilla de 42 celdas íntegra | **PASS** |
| 20 | DST (cambio de hora) | Lectura de `addDays`/`startOfDay`: aritmética por componentes locales (`new Date(y,m,d)` + `setDate`) | Días civiles correctos cruzando DST | Correcto por construcción (no usa sumas de ms) | **PASS** (análisis de código) |
| 21 | Escape con combobox abierto dentro de TreeDots | TreeDots > SelectorWithSearch; abrir ambos; `Escape` con foco en el input | Cerrar solo el combobox (capa superior) | El Escape burbujea al wrapper de TreeDots: **se cierran los dos y el foco salta al disparador**. El combobox no hace `stopPropagation` | **FAIL** (B-8, bajo, a11y) |
| 22 | Clic fuera con TreeDots abierto | `pointerdown` fuera del root | Cerrar el popup | Listener a nivel documento, cierra correctamente | **PASS** |
| 23 | XSS: label con markup hostil | `label='<img src=x onerror=...>'` en Selector | Escapado como texto | Sin `<img>` en el DOM, handler no ejecutado; `grep` confirma **cero `dangerouslySetInnerHTML`/`innerHTML`/`eval`** en `packages/ui` | **PASS** |
| 24 | Tema: `localStorage["langopia:theme"]` corrupto (`"solarized"`) | `getInitialTheme()` | Fallback a sistema | Guard `isTheme` rechaza valores ajenos → cae a `prefers-color-scheme`/light | **PASS** |
| 25 | Tema: inconsistencia entre pestañas | Cambiar `localStorage` desde "otra pestaña" | Re-aplicar tema (o documentar que no) | `lib/theme.ts` **no registra listener `storage`**: las pestañas divergen hasta recargar | **FAIL** (B-9, bajo, limitación conocida) |
| 26 | Tema: FOUC al cargar con tema guardado ≠ sistema | `apps/app/index.html` no tiene script inline que fije `data-theme` antes del primer pintado | Sin flash | Riesgo **latente**: hoy la app no fija `data-theme` (solo fallback `prefers-color-scheme`); cuando se cablee `getInitialTheme` desde React habrá flash si no se añade script inline | **NOT TESTED** (jsdom no pinta; evidencia por lectura) |
| 27 | Refresh / atrás: pérdida de estado | Forms RHF no controlados; `CheckoutPage.billingValues` interno; calendario interno | Comportamiento documentado | Todo el estado se pierde en refresh/atrás; es el comportamiento esperado y documentado en las props (`defaultValues` "solo se leen en el montaje") | **PASS** (documentado) |
| 28 | Rename: referencias rotas | `grep -r "apps/web\|langopia-web\|@langopia/web"` en código, CI, scripts, configs | Cero referencias fuera de docs históricos | Cero en `.github/`, `scripts/`, `apps/`, `packages/`, `.gitignore`, `vercel.json`; solo docs de la propia feature (intencionado) | **PASS** |
| 29 | Rename: build y typecheck | `npm run typecheck` (app+ui), `npm run build --workspace @langopia/app`, `storybook:build`, tests worktree CLI | Todo en verde | typecheck ✓, build app ✓ (theme.css resuelve, selectores dark y tokens en el CSS final), storybook ✓, worktree 10/10, ui 367/367 | **PASS** |
| 30 | Dependencia `@langopia/ui` en `apps/app` | `apps/app/package.json` vs `@import "@langopia/ui/theme.css"` en `src/index.css` | Dependencia declarada | **No está declarada** en `dependencies`: funciona por el symlink hoisted de npm workspaces, pero es una phantom dependency (rompería con pnpm/instaladores estrictos o empaquetado aislado) | **FAIL** (B-5b, bajo) |
| 31 | Dominio `app.langopia.com` end-to-end | Login + sesión + llamada autenticada en preview/producción | Sin errores CORS/cookies | Requiere el proyecto Vercel `langopia-app` y env vars (pasos manuales del ADR-005/006, fuera del repo) | **NOT TESTED** (infra fuera del repo) |
| 32 | Alias preview `pr-N.app.langopia.com` | `preview-deploy.yml` L82/L154 | Alias con el dominio nuevo | Actualizado correctamente | **PASS** |

## Riesgos

- **R-1 (alto, proyectado)**: `CheckoutPage` conectará con un proveedor de pago real en una fase posterior. Si el consumidor olvida activar `isProcessing` de forma síncrona, un doble clic = doble `onSubmit` = doble cobro potencial. La defensa hoy es solo documental (JSDoc).
- **R-2 (medio)**: los átomos de selección (`Selector`, `SelectorWithSearch`, `MultiSelector`) confían en que `options` tiene `value` únicos. Cuando las opciones vengan de la API real (datos de escuela, no fixtures), duplicados o vacíos producirán degradación silenciosa y atributos ARIA ambiguos.
- **R-3 (medio)**: dependencia fantasma `@langopia/ui` en `apps/app`. Hoy funciona por hoisting de npm; un cambio de gestor de paquetes o un empaquetado aislado (p. ej. Docker con `npm ci --workspace` filtrado) rompería el build de CSS sin error claro hasta producción (RD-3 del solution.md).
- **R-4 (bajo)**: FOUC de tema latente. Cuando la app cablee `getInitialTheme`/`applyTheme` desde React, el primer pintado usará el fallback de `prefers-color-scheme` y parpadeará si el usuario guardó el tema opuesto. Hay que decidir el script inline en `index.html` **antes** de cablear el toggle en la app.
- **R-5 (bajo)**: `process.env.NODE_ENV` en `Calendar.tsx` asume que el consumidor es siempre Vite/Vitest (que lo definen). Un consumidor esotérico (Node ESM directo, tests ajenos) lanzaría `ReferenceError` al indexar eventos con fecha inválida.
- **R-6 (bajo)**: la cookie de sesión del dominio antiguo es host-only; los usuarios con sesión activa re-iniciarán sesión al cambiar a `app.langopia.com` (ya previsto como RD-5 en solution.md).

## Bugs confirmados

- **B-1 (alto proyectado) — CheckoutPage sin guardia interna de doble submit.** `CheckoutPage.tsx:135-138`: el guard lee la prop `isProcessing`, que llega como pronto un render después del primer submit. Repro: test nº 3 de la matriz (dos `fireEvent.submit` → dos llamadas). Fix recomendado: guardia interna con `useRef` (`if (submittingRef.current) return; submittingRef.current = true;` antes de llamar a `onSubmit`, liberándola cuando `isProcessing` vuelva a `false`) o exigir `onSubmit: () => Promise<void>` y derivar el estado como hacen las moléculas de formulario.
- **B-2 (medio) — UserAvatar no se recupera de una imagen fallida.** `UserAvatar.tsx:47-48`: `imageFailed` persiste aunque cambie `src`. Repro: test nº 12. Fix: reiniciar el estado cuando cambie `src` (`useEffect(() => setImageFailed(false), [src])`) o key por `src`.
- **B-3 (medio) — CrudForm acepta `name` duplicados sin aviso.** `CrudForm.tsx:127` (shape sobrescrito) + `key={field.name}` (duplicate key de React). Repro: test nº 6. Fix: validar la config en desarrollo (`console.warn`/throw si hay `name` repetido) antes de construir el esquema.
- **B-4 (bajo) — UserAvatar rompe emojis en las iniciales.** `UserAvatar.tsx:24`: `part[0]` corta surrogate pairs. Repro: test nº 10. Fix: usar `[...part][0]` (iteración por code points) o `Intl.Segmenter`.
- **B-5 (bajo) — Doble submit programático en formularios RHF.** `handleSubmit` no guarda reentrada; la protección real (botón deshabilitado vía `isSubmitting`) cubre click y Enter, pero no dos eventos `submit` en el mismo tick. Repro: test nº 2. Fix recomendado (opcional): envolver `wrapSubmit` con un flag de "en curso" en `use-server-error.ts` para que la guardia sea estructural y no solo visual.
- **B-5b (bajo) — `apps/app` no declara `@langopia/ui`.** `apps/app/package.json` carece de la entrada mientras `src/index.css` la importa. Fix: añadir `"@langopia/ui": "*"` a `dependencies` y regenerar el lockfile.
- **B-6 (bajo) — `value` duplicados en selectores.** Duplicate keys de React, `id` de opción duplicados (`aria-activedescendant` ambiguo en `SelectorWithSearch.tsx:208`) y en `MultiSelector` todas las copias se marcan a la vez (`MultiSelector.tsx:102`). Fix: aviso en desarrollo ante valores repetidos (mismo patrón que el warn de `Calendar`).
- **B-7 (bajo) — KpiChart con `NaN` en `data` falla en silencio.** `KpiChart.tsx:89-99`: `Math.min/max` propagan `NaN` a todos los puntos → SVG vacío sin aviso. Fix: filtrar no finitos (`Number.isFinite`) y, si no quedan puntos, mostrar el estado vacío.
- **B-8 (bajo, a11y) — Escape anidado cierra combobox y TreeDots a la vez.** `SelectorWithSearch.tsx:144-149` no hace `stopPropagation`; el wrapper de `TreeDots.tsx:70-76` recibe el burbujeo, cierra el menú y mueve el foco al disparador. Repro: test nº 21. Fix: `event.stopPropagation()` en el `Escape` del combobox cuando cierra su lista.
- **B-9 (bajo) — Tema sin sincronización entre pestañas.** `lib/theme.ts` no escucha el evento `storage`. Fix (opcional): listener `storage` que re-aplique el tema al cambiar `langopia:theme`.

## Fixes recomendados (orden sugerido)

1. **Antes de conectar pagos**: B-1 (guardia interna en `CheckoutPage`).
2. **Antes de datos reales de API**: B-3, B-6, B-7 (validación de configs y saneado de datos en desarrollo).
3. **En la siguiente pasada del paquete**: B-2, B-4 (UserAvatar), B-5/B-5b (guardia de submit compartida y dependencia declarada), B-8 (stopPropagation en Escape).
4. **Al cablear el tema en `apps/app`**: script inline en `index.html` que fije `data-theme` antes del primer pintado (mitiga R-4) y, si se desea, listener `storage` (B-9).
5. **Cierre del dominio**: ejecutar el checklist del ADR-005/006 en Vercel y la verificación e2e de login en preview (escenario 31, único NOT TESTED bloqueante para el criterio de aceptación 5 del brief).

## Evidencia de ejecución

```
npm run test --workspace @langopia/ui        → Test Files 50 passed, Tests 367 passed
npx vitest run src/adversarial.qa.spec.tsx   → 25 passed (fichero temporal, borrado tras la corrida)
npm run typecheck --workspace @langopia/app  → ✓ sin errores
npm run typecheck --workspace @langopia/ui   → ✓ sin errores
npm run build --workspace @langopia/app      → ✓ built in 877ms (CSS final con data-theme, prefers-color-scheme y tokens --ink-*)
npm run storybook:build --workspace @langopia/ui → ✓ built (storybook-static)
npx tsx --test scripts/worktree/__tests__/*.test.ts → 10 pass / 0 fail
git status                                   → working tree clean (sin cambios de producción)
```
