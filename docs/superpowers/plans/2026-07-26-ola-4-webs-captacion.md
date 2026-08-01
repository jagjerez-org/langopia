# Ola 4 — Webs de las escuelas y captación · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que el producto deje de solo gestionar la escuela y empiece a hacerla crecer. Es lo que convierte a Langopia de herramienta interna en canal de captación.

**Arquitectura:** una tercera aplicación, `apps/sites`, con **Astro y renderizado en servidor**, que sirve todos los dominios desde un despliegue resolviendo la escuela por el `hostname`. El editor de bloques vive en el panel; Astro solo consume y pinta.

**Stack:** Astro con adaptador de Node, consumiendo la API de NestJS.

**Datos:** el seed trae un sitio publicado con 8 páginas en dos idiomas y 26 bloques de los ocho tipos, más 20 candidatos repartidos por los siete estados del embudo, con su origen y su nivel de la prueba. Se puede construir entero sin un solo cliente.

**Recomendación de negocio:** el orden de las olas sigue teniendo sentido —una escuela que aún no confía en ti no publica su web contigo—, pero eso afecta a cuándo lo *vendes*, no a cuándo lo *construyes*.

## Restricciones globales

- **El hostname se resuelve en tiempo de petición.** No vale un build estático: una escuela nueva debe tener web sin desplegar nada.
- **Cero lógica de negocio en Astro.** Igual que en el panel: los datos vienen de la API.
- Un dominio sin escuela verificada devuelve 404, no la web de otra. Es el mismo aislamiento de siempre, aplicado al borde.
- El catálogo de bloques es **cerrado**. Un lienzo libre no se termina nunca; un catálogo de ocho secciones se construye en dos semanas y se ve bien siempre.
- Toda página existe en los idiomas que la escuela soporta, con `hreflang` correcto.
- Presupuesto de rendimiento: **menos de 50 KB de JavaScript** en una página típica. Si se supera, es que se ha metido interactividad donde no tocaba.

---

## Tarea 1: `sites` — el modelo del sitio

**Ficheros:**
- Crear: `apps/api/src/contexts/sites/domain/model/site.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/sites/domain/model/block.vo.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/sites/domain/model/page.entity.ts`

**Interfaces:**
- Produce: `Site` con `addPage()`, `reorderBlocks()`, `publish()`, `unpublish()`; `Block` validado por tipo.

Catálogo cerrado de bloques, con lo que exige cada uno:

| Bloque | Campos | Notas |
|---|---|---|
| `hero` | titular, subtítulo, imagen, llamada a la acción | Uno por página como máximo |
| `courses` | selección de cursos, o todos los activos | Tira de datos reales del catálogo |
| `teachers` | selección de profesorado | Solo quien haya consentido `image_rights` |
| `pricing` | planes de la escuela | Precios reales, no texto libre |
| `testimonials` | reseñas destacadas | Solo reseñas con permiso explícito |
| `faq` | preguntas y respuestas | |
| `contact` | formulario | Crea un candidato en la API |
| `text` | contenido enriquecido | El comodín, deliberadamente limitado |

Reglas:

- Una página publicada necesita **al menos un bloque** y un `slug` único en el sitio.
- El bloque `teachers` **filtra por consentimiento de derechos de imagen**. Publicar la foto de un profesor que no lo autorizó es un problema legal, no un detalle.
- El bloque `testimonials` solo muestra reseñas marcadas como públicas por su autor.
- Los precios y cursos salen del catálogo real: una escuela que cambia un precio no debe acordarse de actualizar su web.

- [ ] **Paso 1: Pruebas de validación de bloques** — uno por tipo, más los casos de consentimiento
- [ ] **Paso 2: Ejecutar y comprobar que fallan**
- [ ] **Paso 3: Implementar `Block` con su validación por tipo**
- [ ] **Paso 4: Implementar `Page` y `Site`**
- [ ] **Paso 5: Prueba de que un profesor sin `image_rights` no aparece**
- [ ] **Paso 6: Commit** — `feat(sites): modelo de sitio con catálogo cerrado de bloques`

---

## Tarea 2: API pública del sitio

Endpoints sin sesión, que consume Astro.

**Ficheros:**
- Crear: `apps/api/src/contexts/sites/application/queries/get-site-by-host/`
- Crear: `apps/api/src/contexts/sites/infrastructure/http/public-sites.controller.ts`

**Interfaces:**
- Produce: `GET /public/sites/resolve?host=`, `GET /public/sites/:siteId/pages/:slug`.

Decisiones:

- Son las **únicas rutas públicas** del producto además del registro. Van marcadas `@Public()` y con límite de peticiones por IP.
- `resolve` devuelve la escuela, su marca, sus idiomas y el mapa de páginas. Un hostname desconocido devuelve **404**, nunca la web de otra escuela.
- La respuesta lleva `Cache-Control` con revalidación: una web de escuela cambia poco y se sirve muchas veces.
- **No** exponen ningún dato de alumnado. Solo lo que la escuela publicó a propósito.

- [x] **Paso 1: Prueba de que un host desconocido da 404**
- [x] **Paso 2: Prueba de que la respuesta no incluye datos de personas no publicadas**
- [x] **Paso 3: Ejecutar y comprobar que fallan**
- [x] **Paso 4: Implementar las consultas y el controlador**
- [x] **Paso 5: Límite de peticiones por IP**
- [x] **Paso 6: Commit** — `feat(sites): API pública de resolución y contenido`

---

## Tarea 3: Aplicación Astro con SSR multidominio

**Ficheros:**
- Crear: `apps/sites/` (proyecto Astro completo)
- Crear: `apps/sites/src/middleware.ts`
- Modificar: `package.json` de la raíz

**Interfaces:**
- Produce: `npm run sites:dev`; resolución de escuela por hostname en cada petición.

- [ ] **Paso 1: Crear el proyecto**

```bash
cd apps && npm create astro@latest sites -- --template minimal --typescript strict
cd sites && npx astro add node
```

- [ ] **Paso 2: Configurar renderizado en servidor**

```javascript
// apps/sites/astro.config.mjs
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  // El hostname hace falta en tiempo de petición para saber de qué escuela
  // es la web. Con un build estático habría que desplegar cada vez que una
  // escuela nueva publica, que es justo lo que no queremos.
  output: "server",
  adapter: node({ mode: "standalone" }),
});
```

- [ ] **Paso 3: Middleware que resuelve la escuela**

```typescript
// apps/sites/src/middleware.ts
import { defineMiddleware } from "astro:middleware";

/**
 * Resuelve de qué escuela es esta petición a partir del hostname.
 *
 * Es el equivalente al interceptor de tenant de la API, en el borde público.
 * Un hostname que no corresponde a ninguna escuela verificada devuelve 404:
 * jamás la web de otra.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get("host")?.split(":")[0] ?? "";

  const response = await fetch(
    `${import.meta.env.API_URL}/api/v1/public/sites/resolve?host=${encodeURIComponent(host)}`,
  );

  if (!response.ok) {
    return new Response("Sitio no encontrado", { status: 404 });
  }

  context.locals.site = await response.json();
  return next();
});
```

- [ ] **Paso 4: Prueba del middleware** — host conocido resuelve, desconocido da 404, host con puerto se normaliza
- [ ] **Paso 5: Verificar en local** con `/etc/hosts` apuntando dos dominios falsos
- [ ] **Paso 6: Commit** — `feat(sites): aplicación Astro con resolución de escuela por hostname`

---

## Tarea 4: Componentes de bloque

**Ficheros:**
- Crear: `apps/sites/src/components/blocks/` (uno por tipo del catálogo)
- Crear: `apps/sites/src/pages/[...slug].astro`

Decisiones:

- **Todos los bloques son `.astro` puro**, sin JavaScript en el cliente. La única excepción es el formulario de contacto, que se hidrata con `client:visible`.
- Los estilos salen de los tokens de marca de la escuela (`branding.primaryColor`, `accentColor`), inyectados como variables CSS.
- Las imágenes pasan por el optimizador de Astro con `loading="lazy"` salvo la del `hero`.

- [ ] **Paso 1: Implementar los ocho componentes de bloque**
- [ ] **Paso 2: Ruta comodín que pinta la página según sus bloques**
- [ ] **Paso 3: Aplicar los tokens de marca de la escuela**
- [ ] **Paso 4: Medir el JavaScript enviado** — una página con hero, cursos y contacto debe quedar bajo 50 KB
- [ ] **Paso 5: Commit** — `feat(sites): componentes de bloque sin JavaScript salvo el formulario`

---

## Tarea 5: SEO y multiidioma

**Ficheros:**
- Crear: `apps/sites/src/components/Seo.astro`
- Crear: `apps/sites/src/pages/sitemap.xml.ts`
- Crear: `apps/sites/src/pages/robots.txt.ts`

Decisiones:

- Una URL por idioma: `/`, `/en/`, `/de/`. Con `hreflang` recíproco y `x-default` al idioma por defecto de la escuela.
- Datos estructurados `EducationalOrganization` y `Course`: es lo que hace que una academia aparezca bien en una búsqueda de «clases de español online».
- `sitemap.xml` y `robots.txt` **generados por escuela**, no compartidos. Un sitemap con las URLs de otra escuela es una fuga de información y un problema de posicionamiento.
- Metadatos de redes sociales con la imagen del hero.

- [ ] **Paso 1: Componente de SEO con metadatos y `hreflang`**
- [ ] **Paso 2: Datos estructurados**
- [ ] **Paso 3: `sitemap.xml` y `robots.txt` por escuela**
- [ ] **Paso 4: Prueba de que el sitemap de una escuela no contiene URLs de otra**
- [ ] **Paso 5: Verificar con la herramienta de resultados enriquecidos**
- [ ] **Paso 6: Commit** — `feat(sites): SEO, datos estructurados y multiidioma`

---

## Tarea 6: Editor de bloques en el panel

**Ficheros:**
- Crear: `apps/web/src/features/site-editor/`

Decisiones:

- Lista de bloques reordenable, con formulario por tipo. **No** es un editor visual de arrastrar sobre un lienzo: eso es un producto entero y no es este.
- Previsualización en un `iframe` apuntando al sitio con un token de borrador.
- Publicar es explícito: los cambios no salen en vivo hasta pulsarlo.
- Selector de idioma para editar cada versión.

- [ ] **Paso 1: Lista de bloques con reordenación**
- [ ] **Paso 2: Formulario por tipo de bloque**
- [ ] **Paso 3: Previsualización en iframe**
- [ ] **Paso 4: Publicar y despublicar**
- [ ] **Paso 5: Aviso al añadir un profesor sin derechos de imagen** — explicando por qué no aparecerá
- [ ] **Paso 6: Commit** — `feat(web): editor de bloques del sitio`

---

## Tarea 7: Dominios propios

**Ficheros:**
- Crear: `apps/api/src/contexts/sites/application/commands/add-domain/`
- Crear: `apps/api/src/contexts/sites/infrastructure/external/dns-verifier.adapter.ts`

Flujo:

1. La escuela añade `suacademia.com`.
2. El sistema genera un registro TXT de verificación.
3. Un trabajo comprueba el DNS cada 15 minutos durante 48 horas.
4. Al verificar, se emite el certificado TLS y el dominio queda activo.
5. Si no se verifica en 48 horas, se marca como fallido con instrucciones claras.

- [ ] **Paso 1: Comando de alta de dominio con token de verificación**
- [ ] **Paso 2: Verificador de DNS**
- [ ] **Paso 3: Trabajo de comprobación periódica acotado en el tiempo**
- [ ] **Paso 4: Emisión de certificado**
- [ ] **Paso 5: Pantalla en el panel con las instrucciones de DNS, copiables**
- [ ] **Paso 6: Commit** — `feat(sites): dominios propios con verificación por DNS`

---

## Tarea 8: Candidatos y embudo de matrícula

Es donde la web deja de ser un folleto y empieza a traer alumnos.

**Ficheros:**
- Crear: `apps/api/src/contexts/people/domain/model/lead.aggregate.ts` y su `.spec.ts`
- Crear: comandos `capture-lead`, `convert-lead`
- Crear: `apps/web/src/features/leads/`

**Interfaces:**
- Produce: `Lead` con `capture()`, `assignPlacement()`, `convert()`, `discard()`; eventos `LeadCaptured` y `LeadConverted`.

`Lead` vive en `people` a propósito, junto a `EnrolStudentCommand`: convertir un candidato en alumno es un caso de uso del mismo contexto, no un salto de frontera. `sites` no lo toca — el formulario del bloque de contacto llama a la API por HTTP, como cualquier otro cliente.

El embudo, y por qué en este orden:

```
Formulario web  →  Candidato  →  Prueba de nivelación  →  Matrícula  →  Alumno
```

- Un candidato guarda de dónde vino: qué página, qué idioma, qué campaña.
- Al capturarlo se le envía **automáticamente la prueba de nivelación** de la ola 2. Es la conversión más alta del embudo: alguien que acaba de pedir información está dispuesto a hacer una prueba de cinco minutos. Va por evento: `people` publica `LeadCaptured` y `assessment` lo escucha y crea la prueba. `people` no despacha comandos de `assessment`.
- El resultado sugiere grupo, y la escuela confirma o cambia.
- Convertir crea el alumno reutilizando `EnrolStudentCommand`: **si es menor, pide el tutor igual**. La captación no puede saltarse las reglas del alta.
- Un candidato sin respuesta en 30 días se marca como frío, no se borra.

- [ ] **Paso 1: Pruebas del ciclo de vida del candidato**
- [ ] **Paso 2: Ejecutar y comprobar que fallan**
- [ ] **Paso 3: Implementar `Lead`**
- [ ] **Paso 4: Captura desde el formulario del bloque de contacto**
- [ ] **Paso 5: Envío automático de la prueba de nivelación** — manejador de `LeadCaptured` en `assessment`, no una llamada desde `people`
- [ ] **Paso 6: Conversión a alumno reutilizando el comando de alta**
- [ ] **Paso 7: Pantalla de embudo en el panel**
- [ ] **Paso 8: Prueba de que un candidato menor exige tutor al convertir**
- [ ] **Paso 9: Commit** — `feat(people): candidatos y embudo de matrícula`

---

## Tarea 9: Decidir el futuro del vídeo generado

Pendiente desde la ola 2, se resuelve aquí con datos.

- [x] **Paso 1: Revisar el uso real** — cuántos vídeos se generaron, cuántos se publicaron, cuántos se descartaron
- [x] **Paso 2: Revisar las reseñas** del material que incluía vídeo
- [x] **Paso 3: Decidir con criterio explícito** — sale de beta solo si más del 60 % de los vídeos generados se publicaron sin regenerar
- [x] **Paso 4: Documentar la decisión** en el spec, se tome la que se tome
- [x] **Paso 5: Commit** — `docs: decisión sobre el vídeo generado`

Si no cumple el criterio, se queda en beta sin drama. Prometer en la web lo que el modelo no da genera devoluciones.

**Decisión 2026-07-28:** se mantiene en beta y apagado por defecto. No hay uso real ni credenciales
de proveedor para calcular una tasa de publicación fiable; la muestra local es seed/prueba y no sirve
para sacar la prestación de beta.

---

## Tarea 10: Recorrido completo de la ola 4

- [ ] **Paso 1: Escribir el recorrido**

```
 1. Crear un sitio desde el panel con hero, cursos y contacto
 2. Publicarlo y verlo en el subdominio de la escuela
 3. Comprobar que un profesor sin derechos de imagen no aparece
 4. Añadir un dominio propio y verificarlo por DNS
 5. Comprobar que el sitio responde en ese dominio
 6. Comprobar que un dominio no verificado devuelve 404
 7. Rellenar el formulario de contacto → se crea un candidato
 8. Comprobar que llega la prueba de nivelación
 9. Hacerla y ver el nivel sugerido en el panel
10. Convertir el candidato en alumno y matricularlo en un grupo
11. Medir el JavaScript de la portada: por debajo de 50 KB
```

- [ ] **Paso 2: Ejecutarlo**
- [ ] **Paso 3: Añadirlo al CI**
- [ ] **Paso 4: Commit** — `test: recorrido completo de la ola 4`

---

## Criterio de «listo» de la ola 4

- [ ] Una escuela publica su web, recibe una solicitud de información y ese contacto se convierte en alumno matriculado sin intervención manual.
- [ ] Un dominio propio funciona con TLS tras verificar el DNS.
- [ ] Un hostname desconocido devuelve 404, nunca la web de otra escuela.
- [ ] El sitemap de una escuela no contiene ni una URL de otra.
- [ ] La portada envía menos de 50 KB de JavaScript.
- [ ] Nadie aparece en una web sin haberlo consentido.

---

## Autorrevisión

**Cobertura.** Módulo 10 (constructor de webs) → tareas 1-7. El embudo de captación, que no estaba en tus 13 módulos pero es lo que da sentido al constructor → tarea 8. La decisión pendiente sobre vídeo de la ola 2 → tarea 9.

**Placeholders.** La configuración de Astro y el middleware van completos por ser lo que distingue esta app de las anteriores. El resto especifica bloques, campos y reglas con precisión suficiente para escribir las pruebas antes.

**Consistencia.** `Block` y `Site` se definen en T1 y se consumen en T2, T4 y T6. La API pública de T2 la consume el middleware de T3. `Lead` se define en T8 y reutiliza `EnrolStudentCommand` de la ola 1, no lo reimplementa. El bloque `teachers` de T1 depende del consentimiento `image_rights`, que existe en el esquema desde el primer día.
