# Ola 1 — Panel web · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** las pantallas con las que una academia usa el producto sin tocar la API. Sin esto, la ola 1 no es vendible.

**Arquitectura:** aplicación de una sola página con Vite + React, en `apps/web` del mismo monorepo. **Sin lógica de negocio**: consume la API de NestJS y pinta. No hay renderizado en servidor porque no hace falta —está tras login y no tiene SEO.

**Stack:** Vite 7, React 19, TanStack Router, TanStack Query, react-hook-form + Zod, Tailwind, `next-intl`-equivalente para React (`use-intl` o `react-i18next`), Vitest + Testing Library, Playwright.

## Por qué SPA y no renderizado en servidor

Es la pregunta que alguien hará en el mes tres, así que queda escrita:

1. **El backend ya está separado.** Los datos vienen de la API de NestJS. Un framework con renderizado en servidor añadiría una segunda capa de servidor que solo haría de proxy.
2. **Todo está tras login.** No hay SEO que ganar ni contenido que indexar.
3. **Es una aplicación, no un sitio.** Calendario con arrastrar y soltar, formularios largos, estado compartido entre rutas, filtros que persisten. Eso quiere un cliente rico.
4. **Las webs públicas de las escuelas son otro producto**, van en la ola 4 y **se harán con Astro**, que es donde brilla: contenido, SEO y multidominio.

## Restricciones globales

- **Cero lógica de negocio en el frontend.** Si el panel decide si una cancelación genera devolución, hay dos verdades y una acabará equivocándose. Esa decisión llega en la respuesta de la API.
- Toda cadena de texto pasa por el diccionario de traducciones. Ni un literal suelto en un componente.
- Los importes se reciben en céntimos y se formatean con `Intl.NumberFormat` según el locale y la moneda de la escuela.
- Las fechas llegan en ISO 8601 UTC y se muestran en la zona horaria de la escuela.
- Cada pantalla tiene estado de carga, de vacío y de error. Un error de la API se muestra con su mensaje traducido —del catálogo del panel si conoce el `code`, del `title` de la respuesta si no—, nunca con un «algo salió mal» ni con el código crudo.
- Accesibilidad: navegable con teclado, foco visible, contraste suficiente. No es opcional cuando el usuario pasa ocho horas al día dentro.

---

## Tarea 1: Esqueleto de la aplicación

**Ficheros:**
- Crear: `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Crear: `apps/web/src/main.tsx`, `apps/web/src/app.tsx`
- Modificar: `package.json` de la raíz (workspace y scripts)

**Interfaces:**
- Produce: `npm run web:dev` sirviendo en `http://localhost:5173` con proxy a la API.

- [x] **Paso 1: Crear el workspace**

```bash
cd apps && npm create vite@latest web -- --template react-ts && cd web
npm install @tanstack/react-router @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/user-event jsdom
```

- [x] **Paso 2: Configurar Vite con proxy a la API**

```typescript
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // El proxy evita CORS en desarrollo y hace que las cookies de sesión
    // viajen como si fueran del mismo origen, que es como irán en producción.
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } },
  },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: false },
});
```

- [x] **Paso 3: Añadir los scripts en la raíz**

```json
"web:dev": "npm run dev --workspace @langopia/web",
"web:build": "npm run build --workspace @langopia/web",
"dev": "npm run api:dev & npm run web:dev"
```

- [x] **Paso 4: Verificar**

`npm run web:dev` y comprobar que la página carga y que `/api/v1/health` responde a través del proxy.

- [x] **Paso 5: Commit** — `chore(web): esqueleto de la SPA con Vite y React`

---

## Tarea 2: Cliente de la API con tipos compartidos

Si los tipos de la respuesta se escriben a mano en el frontend, divergen el día que alguien cambia un campo en el backend.

**Ficheros:**
- Crear: `packages/contracts/` (paquete nuevo con los tipos de la API)
- Crear: `apps/web/src/lib/api-client.ts`
- Crear: `apps/web/src/lib/api-client.spec.ts`

**Interfaces:**
- Produce: `api.get/post/patch<T>()` que lanza un `ApiError` tipado con la forma del Problem Details que devuelve la API (ola 0, T8b): `code`, `title`, `params`, `details`, `status` y `traceId`.

- [x] **Paso 1: Extraer los tipos a un paquete compartido**

Mover a `packages/contracts/src/` los tipos de retorno de las consultas —`AgendaEntry`, `TeacherOccupancy`, y los que vayan apareciendo— y que **la API los importe también**. Una sola definición para los dos lados.

- [x] **Paso 2: Escribir la prueba del cliente**

```typescript
// Casos:
//  · una respuesta 200 devuelve los datos ya tipados
//  · un 4xx en formato Problem Details lanza ApiError con code, title, params y traceId
//  · un 403 con code 'missing_tenant' redirige al inicio de sesión
//  · un fallo de red lanza ApiError con code 'network_error' y mensaje traducible
//  · un cuerpo de error ilegible NO se descarta: se registra y se lanza con el status
//  · la cabecera Accept-Language se envía con el locale activo
//  · el traceId de la respuesta llega al ApiError, para poder pedirlo en soporte
```

- [x] **Paso 3: Ejecutar y comprobar que falla**

- [x] **Paso 4: Implementar el cliente**

```typescript
// apps/web/src/lib/api-client.ts
/** La forma que devuelve la API para cualquier error (ola 0, T8b). */
export type Problem = {
  code: string;
  title: string;
  status: number;
  params?: Record<string, unknown>;
  details?: Record<string, unknown>;
  traceId?: string;
};

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.title);
  }

  get code(): string {
    return this.problem.code;
  }

  /** El identificador que el usuario puede dar en soporte. */
  get traceId(): string | undefined {
    return this.problem.traceId;
  }
}

/**
 * Cliente HTTP.
 *
 * `credentials: "include"` manda la cookie de sesión que emite Better Auth.
 * El error llega con `title` ya traducido y con `params` aparte: quien lo
 * pinta decide si usa el catálogo del panel (`useErrorMessage`, T5) o el
 * título de la API. Aquí no se decide, solo se transporta.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": document.documentElement.lang,
        ...init.headers,
      },
    });
  } catch (cause) {
    console.error("fallo de red", { path, cause });
    throw new ApiError({
      code: "network_error",
      title: "No se pudo contactar con el servidor.",
      status: 0,
    });
  }

  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (cause) {
    // Un cuerpo ilegible no se descarta en silencio: si la respuesta además
    // era un error, perderíamos la única pista de qué pasó.
    console.error("respuesta sin JSON válido", { path, status: response.status, cause });
  }

  if (!response.ok) {
    const problem = body as Partial<Problem> | null;
    throw new ApiError({
      code: problem?.code ?? "unknown_error",
      title: problem?.title ?? response.statusText,
      status: response.status,
      params: problem?.params,
      details: problem?.details,
      traceId: problem?.traceId,
    });
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
};
```

- [x] **Paso 5: Ejecutar** — 7 en verde
- [x] **Paso 6: Commit** — `feat(web): cliente de API con errores tipados y tipos compartidos`

---

## Tarea 3: Sesión, rutas protegidas y cambio de escuela

**Ficheros:**
- Crear: `apps/web/src/features/auth/` (proveedor de sesión, pantalla de acceso, selector de escuela)
- Crear: `apps/web/src/router.tsx`

**Interfaces:**
- Produce: `useSession()`, rutas que redirigen a `/entrar` sin sesión, y un selector de escuela para quien pertenece a varias.

- [x] **Paso 1: Pruebas** — sin sesión redirige a `/entrar`; con sesión y una escuela entra directo; con varias muestra el selector; un `missing_tenant` de la API vuelve al selector
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar el proveedor de sesión sobre TanStack Query**
- [x] **Paso 4: Implementar la pantalla de acceso** (correo y contraseña + botón de Google)
- [x] **Paso 5: Implementar el selector de escuela**, que fija la cabecera `x-school-slug` para las siguientes peticiones
- [x] **Paso 6: Verificar contra la API real** con dos escuelas del seed y el mismo usuario
- [x] **Paso 7: Commit** — `feat(web): sesión, rutas protegidas y cambio de escuela`

---

## Tarea 4: Sistema de diseño

El artifact ya fija la identidad visual. Aquí se convierte en componentes.

**Ficheros:**
- Crear: `apps/web/src/ui/` (tokens y componentes base)
- Crear: `apps/web/src/ui/tokens.css`

**Interfaces:**
- Produce: `Button`, `Input`, `Select`, `Table`, `Card`, `Tag`, `Dialog`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`.

Los tokens salen del documento de diseño: azul tinta `#2B47C4` como acento, neutros con sesgo azul, y **estados semánticos separados del acento** —bueno, aviso y crítico— porque el color por sí solo no puede ser la única señal.

- [x] **Paso 1: Volcar los tokens a CSS**, con tema claro y oscuro
- [x] **Paso 2: Prueba de accesibilidad de `Button`** — foco visible, activable con teclado, estado deshabilitado anunciado
- [x] **Paso 3: Implementar los componentes base**
- [x] **Paso 4: Implementar `Tag` con texto además de color** — «Riesgo de baja» se lee igual sin distinguir rojo de ámbar
- [x] **Paso 5: Commit** — `feat(web): sistema de diseño con tokens y componentes base`

---

## Tarea 5: Multiidioma en el panel

**Ficheros:**
- Crear: `apps/web/src/i18n/` con `es-ES`, `en-GB`, `de-DE`, `pt-BR`, `gl-ES`
- Crear: `apps/web/src/i18n/format.ts`
- Crear: `apps/web/src/i18n/errors.ts` y su `.spec.ts`

**Interfaces:**
- Consume: el `code` y los `params` del cuerpo de error de la API (ola 0, T8b).
- Produce: `useT()` para textos, `formatMoney()`, `formatDate()`, `formatRelative()`, `useErrorMessage()`.

Los cinco idiomas van con **ICU**, igual que el backend: mismo formato de mensaje a los dos lados, para que traducir una cadena no dependa de dónde vive.

**Los errores de la API se traducen aquí cuando se puede.** El panel conoce la mayoría de los `code` y puede decir más que la API: enlazar a la pantalla que arregla el problema, o marcar el campo culpable. Cuando no reconoce el `code` —porque el backend se desplegó antes—, usa el `title`, que ya viene traducido. El `code` crudo no se enseña nunca.

```typescript
// apps/web/src/i18n/errors.ts
export function useErrorMessage() {
  const t = useT();
  return (problem: Problem): string =>
    t.has(`errors.${problem.code}`)
      ? t(`errors.${problem.code}`, problem.params)  // el panel sabe más
      : problem.title;                               // respaldo ya traducido
}
```

- [x] **Paso 1: Pruebas de formato** — 18940 céntimos en `es-ES`/EUR da «189,40 €»; en `pt-BR`/BRL, «R$ 189,40»; una fecha UTC se muestra en la zona de la escuela
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar los formateadores sobre `Intl`**
- [x] **Paso 4: Cargar el diccionario según el locale de la sesión**
- [x] **Paso 4b: Implementar `useErrorMessage()`** con sus pruebas: `code` conocido usa el catálogo del panel; `code` desconocido cae al `title`; en ningún caso se muestra el `code`
- [x] **Paso 4c: Prueba de que los códigos no divergen** — las claves bajo `errors.*` del panel deben existir en el catálogo del backend. Un `code` que solo conoce uno de los dos lados es un mensaje que alguien verá mal
- [x] **Paso 5: Prueba que detecta literales sin traducir** — recorre los componentes buscando texto suelto en JSX y falla si encuentra alguno
- [x] **Paso 5b: Prueba de cobertura de los cinco idiomas** — una clave presente en `es-ES` y ausente en `gl-ES` falla, en lugar de mostrar español a quien pidió gallego
- [x] **Paso 6: Commit** — `feat(web): multiidioma con formatos por locale y errores traducidos`

---

## Tarea 6: Panel de dirección

La pantalla del documento de diseño. La consulta de ocupación **ya existe y está verificada**; lo que falta es pintarla.

**Ficheros:**
- Crear: `apps/web/src/features/dashboard/`

**Interfaces:**
- Consume: `GET /dashboard/summary`, `GET /scheduling/teacher-occupancy`.
- Produce: la ruta `/`.

Composición, de arriba abajo, y el orden importa: lo que requiere intervención va antes que lo que solo informa.

1. **Fila de indicadores** — alumnos activos, asistencia media, NPS (vacío hasta la ola 3), facturado en el mes. Cada uno con su tendencia.
2. **Alumnos que requieren atención** — la tabla del diseño, con su etiqueta de estado en texto.
3. **Ocupación del profesorado** — barras con umbral de sobrecarga e infrautilización.

- [x] **Paso 1: Prueba de la fila de indicadores** — carga, vacío, error, y que el importe sale en la moneda de la escuela
- [x] **Paso 2: Ejecutar y comprobar que falla**
- [x] **Paso 3: Implementar los indicadores con sus minigráficos**
- [x] **Paso 4: Implementar la tabla de alumnos en riesgo**, con enlace a la ficha
- [x] **Paso 5: Implementar las barras de ocupación**
- [x] **Paso 6: Comparar con el mockup del documento de diseño** y con los datos del seed: Carla 92 %, Dan 83 %, Sofia 75 %, Yuki 46 %, Marc 38 %
- [x] **Paso 7: Commit** — `feat(web): panel de dirección`

---

## Tarea 7: Alumnado

**Ficheros:**
- Crear: `apps/web/src/features/students/`

**Interfaces:**
- Consume: los endpoints de `people` (ola 1 backend, tareas 2, 13 y 14).
- Produce: `/alumnos`, `/alumnos/nuevo`, `/alumnos/:id`, `/alumnos/importar`.

Pantallas:

- **Listado** con búsqueda, filtro por nivel y estado, y paginación.
- **Alta**, con el formulario que **muestra los campos de tutor legal en cuanto la fecha de nacimiento indica que es menor**. Es la regla de negocio hecha interfaz: no se puede guardar un menor sin tutor, y el formulario lo dice antes de intentarlo.
- **Ficha** con pestañas: datos, asistencia, consentimientos, facturas, valoraciones.
- **Importación** en dos pasos: subir el CSV, ver el informe con las filas erróneas señaladas, confirmar.

- [x] **Paso 1: Prueba del formulario de alta** — al poner una fecha de menor aparecen los campos de tutor; sin tutor no deja enviar; el error `guardian_required` de la API se muestra junto al campo correcto
- [x] **Paso 2: Ejecutar y comprobar que falla**
- [x] **Paso 3: Implementar el listado con filtros**
- [x] **Paso 4: Implementar el formulario de alta y edición**
- [x] **Paso 5: Implementar la ficha con sus pestañas**
- [x] **Paso 6: Implementar la importación en dos pasos**
- [x] **Paso 7: Formulario de valoración del alumno** en la ficha, con avance, puntos fuertes, mejoras y siguientes pasos; y aviso visible cuando lleva más de tres semanas sin valorar
- [x] **Paso 8: Commit** — `feat(web): alumnado, alta con tutor legal, importación y valoraciones`

---

## Tarea 8: Profesorado, cursos y grupos

**Ficheros:**
- Crear: `apps/web/src/features/teachers/`, `apps/web/src/features/courses/`

**Interfaces:**
- Produce: `/profesores`, `/profesores/:id`, `/cursos`, `/grupos/:id`.

- [x] **Paso 1: Listado y ficha de profesorado**, con disponibilidad semanal editable en cuadrícula
- [x] **Paso 2: Alta de curso** con sus traducciones —un campo por idioma soportado por la escuela
- [x] **Paso 3: Grupos**, con matriculación de alumnos y aviso al llegar a la capacidad
- [x] **Paso 4: Commit** — `feat(web): profesorado, cursos y grupos`

---

## Tarea 9: Calendario

La pantalla más interactiva del producto, y la razón por la que el panel es una SPA.

**Ficheros:**
- Crear: `apps/web/src/features/calendar/`

**Interfaces:**
- Consume: `GET /scheduling/agenda`, y los comandos de programar, cancelar y replanificar.
- Produce: `/calendario`.

- [x] **Paso 1: Vista semanal** con las clases posicionadas por hora y color por profesor
- [x] **Paso 2: Programar clase** en un diálogo, con selector de aula (LiveKit, Zoom, Meet, Teams)
- [x] **Paso 3: Cancelar**, mostrando **antes de confirmar** si genera devolución. El dato lo calcula la API; el panel solo lo enseña
- [x] **Paso 4: Replanificar** arrastrando, con confirmación
- [x] **Paso 5: Manejar los errores del dominio** — `teacher_overlap` y `teacher_not_available` se muestran junto al campo, no como aviso genérico
- [x] **Paso 6: Pasar lista** desde la clase
- [x] **Paso 7: Commit** — `feat(web): calendario con programación, cancelación y asistencia`

---

## Tarea 10: Facturación

**Ficheros:**
- Crear: `apps/web/src/features/billing/`

**Interfaces:**
- Produce: `/facturacion`, `/facturacion/:id`, `/ajustes/cobros`.

- [x] **Paso 1: Listado de facturas** con filtro por estado y total del mes
- [x] **Paso 2: Detalle** con líneas, cobro, devoluciones y **la comisión de plataforma desglosada** —la escuela tiene derecho a ver qué se le retiene
- [x] **Paso 3: Emitir factura** y **abrir devolución** con motivo
- [x] **Paso 4: Pantalla de conexión con Stripe**, que deja claro que se puede usar el producto sin conectar y qué se desbloquea al hacerlo
- [x] **Paso 5: Commit** — `feat(web): facturación y conexión con Stripe`

---

## Tarea 11: Portal del alumno y aula del profesor

**Ficheros:**
- Crear: `apps/web/src/features/portal/`, `apps/web/src/features/classroom/`

**Interfaces:**
- Produce: `/mi/clases`, `/mi/facturas`, `/mi/asistencia`, `/aula/:sessionId`.

- [x] **Paso 1: Portal del alumno**, con navegación distinta según el rol de la sesión
- [x] **Paso 2: Vista de tutor legal** — un tutor con dos hijos ve a los dos y cambia entre ellos
- [x] **Paso 3: Aula sobre LiveKit**, con vídeo, audio y lista de participantes
- [x] **Paso 4: Aviso visible cuando la grabación está bloqueada** por falta de consentimiento, indicando el motivo
- [x] **Paso 5: Prueba de que un alumno no ve datos de otro** — mismo grupo, distinto alumno
- [x] **Paso 6: Commit** — `feat(web): portal del alumno y aula en vivo`

---

## Tarea 12: Registro de escuela y onboarding

La primera pantalla que ve un cliente nuevo, y la única que no requiere sesión.

**Ficheros:**
- Crear: `apps/web/src/features/onboarding/`

**Interfaces:**
- Consume: `POST /schools/register` (ola 1 backend, tarea 11).
- Produce: `/registro`, `/bienvenida`.

- [x] **Paso 1: Formulario de registro** con validación del `slug` en vivo y aviso de disponibilidad
- [x] **Paso 2: Asistente de puesta en marcha** — marca, idiomas, primer profesor, primer curso. Cada paso se puede saltar
- [x] **Paso 3: Aviso de días restantes de prueba**, presente pero discreto
- [x] **Paso 4: Commit** — `feat(web): registro de escuela y puesta en marcha`

---

## Tarea 13: Recorrido completo con Playwright

El criterio de «listo» de la ola 1, comprobado como lo haría una persona.

**Ficheros:**
- Crear: `apps/web/e2e/wave-1.spec.ts`

- [x] **Paso 1: Escribir el recorrido**

```
 1. Registrar una escuela nueva desde /registro
 2. Completar la puesta en marcha
 3. Dar de alta un profesor con disponibilidad
 4. Crear un curso y un grupo
 5. Dar de alta un alumno adulto
 6. Dar de alta un alumno menor → comprobar que el formulario exige tutor
 7. Importar 20 alumnos desde CSV, con 2 filas erróneas señaladas
 8. Programar tres clases en el calendario
 9. Cancelar una con más de 24 h → la interfaz anuncia devolución
10. Cancelar otra con menos de 24 h → la interfaz anuncia que no la hay
11. Pasar lista de la tercera
12. Emitir una factura y ver la comisión desglosada
13. Entrar como el alumno y ver solo sus datos
```

- [x] **Paso 2: Ejecutarlo contra la API y la base de datos reales**
- [x] **Paso 3: Añadirlo al CI**, con la API levantada como servicio
- [x] **Paso 4: Commit** — `test(web): recorrido completo de la ola 1 con Playwright`

---

## Criterio de «listo» del panel

- [ ] Una persona que no ha visto el producto registra su escuela, da de alta un alumno menor con su tutor y programa una clase, sin ayuda.
- [ ] El panel se puede usar entero con teclado.
- [x] Cambiando el idioma cambia toda la interfaz, incluidos importes y fechas.
- [x] Ningún error muestra «algo salió mal»: todos dicen qué pasó y qué hacer.
- [ ] El recorrido de Playwright pasa en CI.
- [x] **Cero lógica de negocio en el frontend**: la decisión de si hay devolución llega de la API, no se calcula aquí.
- [x] Un error de la API se ve en el idioma del usuario, y un `code` que el panel no conoce muestra el `title` traducido, nunca el código.
- [x] Ninguna pantalla muestra español a quien pidió gallego.

---

## Autorrevisión

**Cobertura.** Las trece tareas cubren las pantallas de todos los módulos de la ola 1: alumnado (1), profesorado (2), clases (3), aulas (12), contabilidad (7), tenant (10 parcial). Los módulos 4, 5, 8, 11 y 13 son de olas posteriores.

**Placeholders.** Las tareas 1 y 2 llevan configuración y código completos por ser la base sobre la que se apoya todo lo demás. De la 3 a la 13 se especifican pantallas, comportamientos y criterios de verificación sin volcar el JSX: el detalle visual está en el documento de diseño y repetirlo aquí lo duplicaría con riesgo de divergencia. Cada tarea nombra sus pruebas con precisión suficiente para escribirlas antes que el componente.

**Consistencia.** `ApiError` se define en T2 y se consume en T3 y T9. Los tokens de T4 los usan todas las pantallas. `useT`, `formatMoney` y `formatDate` se definen en T5 y se usan a partir de T6. Las rutas no se solapan.
