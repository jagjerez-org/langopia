# Brief — Design System Langopia + rename `web` → `app` + dominio `app.langopia.com`

> Estado: borrador inicial. Revisa cada sección y corrige lo que no encaje.

## Problema

El panel de gestión (`apps/web`) ha crecido sin un sistema de diseño unificado: los componentes se construyen ad hoc dentro de la SPA, no hay un catálogo visual ni una paleta de colores formalizada, y reutilizar componentes entre el panel, las páginas públicas y futuras superficies (checkout, builders, e-learning) implica duplicar código. Además, el nombre del workspace `apps/web` y su despliegue no reflejan que es **la aplicación** del producto: debe vivir en `app.langopia.com` y consumir la API desde ese dominio.

## Usuario

- **Equipo de desarrollo de Langopia** (principal): desarrolla y mantiene componentes del panel y futuras superficies; necesita un catálogo Storybook como fuente de verdad visual.
- **Dirección de escuela, profesores y alumnos** (indirecto): perciben una UI coherente, con tema claro/oscuro y componentes consistentes.
- **Escuelas (compradoras)**: ven landing, checkout y checkout success con la misma identidad visual.

## Resultado esperado

1. Un paquete nuevo de design system (p. ej. `packages/ui`) con **Storybook**, **Tailwind CSS v4**, paleta de colores propia, soporte de tema claro/oscuro y componentes organizados con **atomic design** (átomos, moléculas, organismos), testeado y documentado en historias.
2. El workspace `apps/web` renombrado a `apps/app`, con todas las referencias actualizadas (npm workspaces, scripts, CI, Vercel, docs).
3. La aplicación desplegada en `app.langopia.com`, consumiendo la API correctamente (CORS, cookies/sesión de Better Auth cross-subdominio, orígenes permitidos).

Catálogo de componentes a diseñar:

**Organismos**
- Shell (layout principal de la aplicación)
- Landing page
- Builders (site builder personalizado, exercise builder)
- Checkout page
- Checkout success
- Roles & permissions page
- KPI page
- Student page
- Professors page
- Payments page
- Planning page
- E-learning page
- Media library page

**Moléculas**
- Login form
- Lead form
- Side nav bar
- Top nav bar
- Bottom page (footer de página)
- Calendar (filtros, navegación, días habilitados/deshabilitados, vistas día/semana/mes/año, creación de eventos, recordatorios, tareas programadas y más)
- Calendar day (contenido y estado personalizables)
- List (acciones, filtros, ordenación, paginación)
- Item list (contenido personalizado, tags)
- CRUD form
- Action bar
- Breadcrumb
- Graphics for KPIs
- Dark/light theme toggle
- Cards (título, contenido, imagen y tags personalizables)
- Cookies RGPD
- User component
- Section (área colapsable con título y tags)

**Átomos**
- Input
- Textarea
- Radio button
- Toggle
- Calendar day (día individual)
- Item list (ítem individual)
- Button
- Form action
- Chip
- Multi selector
- Selector
- Multi selector con búsqueda
- Selector con búsqueda
- Tres puntos (menú de opciones)
- Icons
- Item side nav bar
- User component (avatar/nombre)
- Toggle list option

## Flujo principal

1. Se crea el paquete `packages/ui` con Storybook + Tailwind v4 y se define la paleta de colores y tokens (colores, tipografía, espaciado, radios, sombras) como theme de Tailwind.
2. Se implementan los átomos con sus historias de Storybook y tests.
3. Se componen las moléculas sobre los átomos, con historias y tests.
4. Se componen los organismos (páginas y layouts) sobre moléculas, con datos de demostración en las historias.
5. Se renombra `apps/web` → `apps/app` y se actualizan todas las referencias (workspaces, scripts npm, CI, proyectos Vercel, docs).
6. Se configura el dominio `app.langopia.com` en Vercel y los ajustes de API (CORS, cookies, orígenes) para que la app lo consuma.
7. `apps/app` migra gradualmente a consumir componentes de `packages/ui`.

## Casos alternativos

- **Historia de Storybook con datos de demostración**: los organismos (páginas) usan fixtures/mocks en historias, no la API real.
- **Tema oscuro/claro**: todos los componentes deben renderizar correctamente en ambos temas; el toggle persiste la preferencia del usuario.
- **Componentes que ya existen en `apps/web`**: se extraen y generalizan en `packages/ui` en lugar de duplicarse.
- **Coexistencia temporal**: mientras dura la migración, `apps/app` puede usar componentes propios y de `packages/ui` a la vez.
- **i18n**: el panel soporta 5 idiomas (`es-ES`, `en-GB`, `de-DE`, `pt-BR`, `gl-ES`); los componentes del design system no deben acoplar textos — reciben contenido por props.

## Fuera de alcance

- Cambios de lógica de negocio en la API (los endpoints no cambian; solo CORS/orígenes si es necesario).
- Rediseño de las webs públicas `apps/sites` para consumir el design system (podría ser una fase posterior).
- Migración completa de todas las pantallas existentes del panel a los nuevos componentes (se hará incrementalmente tras esta feature).
- Nuevas funcionalidades de producto (los organismos se diseñan con datos mock; su conexión real a la API es trabajo posterior de cada contexto).

## Criterios de aceptación

1. `packages/ui` existe con Storybook arrancable (`npm run storybook` o similar) que muestra todos los átomos, moléculas y organismos listados arriba.
2. Paleta de colores y tokens definidos como theme de Tailwind v4, con variantes claro/oscuro funcionando en todas las historias.
3. Tests de componentes (Vitest + Testing Library) para átomos y moléculas; `npm run typecheck` pasa en todo el monorepo.
4. `apps/app` compila y arranca con el nuevo nombre; CI pasa (`.github/workflows/ci.yml` actualizado).
5. La app responde en `app.langopia.com` (preview/producción según config de Vercel) y puede autenticarse y llamar a la API sin errores de CORS ni de cookies de sesión.
6. Documentación breve del design system (cómo añadir un componente, convenciones atomic design, uso del theme).

## Comportamiento actual

- `apps/web` es la SPA del panel (Vite + React 19 + TanStack Router/Query + Tailwind v4) con componentes construidos localmente, sin catálogo ni sistema de diseño compartido.
- El proyecto Vercel se llama `langopia-web`; no existe dominio `app.langopia.com` configurado.
- No existe `packages/ui` ni Storybook en el monorepo.

## Riesgos

- **Alcance grande**: ~50 componentes + rename + dominio en una sola feature; conviene dividir en slices (átomos → moléculas → organismos → rename → dominio).
- **Rename rompe CI/Vercel**: referencias ocultas a `apps/web` o `langopia-web` en scripts, workflows, `vercel.json`, `.ports.json` o tooling de worktrees pueden fallar silenciosamente.
- **Sesión cross-subdominio**: Better Auth y cookies entre `app.langopia.com` y el dominio de la API requieren configuración cuidadosa (SameSite, dominio de cookie, CORS con credenciales).
- **Divergencia de estilos**: si `apps/app` sigue usando componentes locales tras crear `packages/ui`, el design system queda desactualizado; hace falta convención clara de adopción.
- **Tailwind v4 compartido**: el theme debe ser consumible tanto por `packages/ui` como por las apps sin duplicar configuración (CSS-first config de v4).
- **Storybook en CI**: si se añade build de Storybook a CI, aumenta el tiempo del pipeline; decidir si se publica (Chromatic/Vercel) o solo se usa en local.
