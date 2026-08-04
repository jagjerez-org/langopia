# Plan de test manual — Design System Langopia + rename + dominio

> Estado de verificación a fecha del cierre de implementación. Leyenda: ✅ verificado automáticamente · 🔶 inferido (verificado indirectamente) · ⬜ no testeado — requiere verificación manual.

## 1. Verificado automáticamente (no requiere test manual)

- ✅ `packages/ui` compila y typecheck limpio (raíz, todos los workspaces).
- ✅ 371 tests unitarios en `@langopia/ui` (átomos, moléculas, organismos, arquitectura atomic).
- ✅ 412 tests en `@langopia/app` tras el rename.
- ✅ 1032 tests en `@langopia/api`.
- ✅ `storybook:build` de `@langopia/ui` correcto (50 archivos de historias).
- ✅ Build de producción de `@langopia/app` correcto.
- ✅ Rename exhaustivo: cero referencias a `apps/web`/`@langopia/web`/`langopia-web` fuera de históricos; lockfile regenerado; worktree CLI 10/10.
- ✅ Doble clic/submit en formularios bloqueado; guardia interna en CheckoutPage.
- ✅ Calendar ante fechas límite (29-feb, DST, cambio de año).
- ✅ XSS: sin `dangerouslySetInnerHTML`; payloads escapados por React.

## 2. Inferido (verificado indirectamente, bajo riesgo)

- 🔶 Alias de preview `pr-N.app.langopia.com`: configurado en `preview-deploy.yml`, pero no se ha desplegado una preview real desde esta rama.
- 🔶 Trusted origins de Better Auth cubren `app.langopia.com` vía wildcard `.langopia.com` (código revisado, no probado contra el entorno real).
- 🔶 Tema oscuro/claro en Storybook (toolbar global): verificado en tests y stories, no visualmente.

## 3. Test manual obligatorio antes de mergear a `main`

### 3.1 Storybook visual

1. `npm run storybook --workspace @langopia/ui` → abrir http://localhost:6006.
2. Recorrer el índice: 18 átomos, 16 moléculas, 14 organismos — cada historia carga sin error en la consola.
3. Alternar el tema claro/oscuro con la toolbar global en 3-4 historias representativas (Shell, LandingPage, LoginForm, Calendar): contraste y tokens correctos en ambos.
4. Story `Mobile` de Shell y LandingPage con viewport estrecho: navegación inferior visible, sin overflow horizontal.

### 3.2 Checklist Vercel (BLOQUEANTE para el rename, ADR-005)

1. Crear el proyecto Vercel `langopia-app` (Root Directory `apps/app`).
2. Migrar env vars de `langopia-web` a `langopia-app` (copiar tal cual; incluye `VITE_*` si las hay).
3. Asignar el dominio `app.langopia.com` al proyecto `langopia-app`.
4. En la API (`langopia-api`): si `BETTER_AUTH_TRUSTED_ORIGINS` está definida, añadir `https://app.langopia.com` a la lista (si no está definida, el wildcard `.langopia.com` ya lo cubre).
5. Verificar que el rewrite `/api/*` del proyecto `langopia-app` apunta a `https://api.langopia.com/api/*` (viene de `apps/app/vercel.json`, confirmar tras el primer deploy).
6. Archivar (o pausar) el proyecto `langopia-web` una vez `langopia-app` esté sirviendo.

### 3.3 Verificación post-deploy (producción)

1. Abrir `https://app.langopia.com` → carga la SPA.
2. Login real → sesión creada (cookie first-party, mismo origen vía rewrite).
3. Una llamada autenticada cualquiera (p. ej. lista de alumnos) → 200, sin errores CORS en consola.
4. Refrescar la página con sesión → la sesión persiste.
5. Comprobar que `langopia-web` (dominio anterior) redirige o se ha retirado según lo decidido.

### 3.4 Preview de la PR

1. Al abrir la PR, el workflow `preview-deploy` debe comentar con la fila `App` apuntando a `pr-N.app.langopia.com`.
2. Abrir esa URL y repetir login + una llamada autenticada.

## 4. No testeado (aceptado como riesgo conocido)

- ⬜ FOUC de tema en la app real: `apps/app/index.html` no tiene script inline de tema; cuando se cablee el ThemeToggle en la app habrá que añadirlo (deuda registrada).
- ⬜ Navegación por flechas dentro de la rejilla del Calendar (limitación documentada).
- ⬜ Menú de TreeDots: los items con `role="menuitem"` y teclado completo llegan con la futura molécula de menú (deuda registrada).
- ⬜ Sincronización de tema entre pestañas (B-9, bajo).
