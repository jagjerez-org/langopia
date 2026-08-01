# Langopia — Especificación de diseño

**Fecha:** 25 de julio de 2026
**Estado:** aprobado, en ejecución
**Reemplaza a:** las decisiones técnicas del artifact inicial en lo relativo al
stack (allí se recomendaba un monolito Next.js; se decidió NestJS).

---

## 1. Qué es

CRM SaaS multi-tenant para academias de idiomas online. Cada escuela es un
tenant con su marca, su alumnado, su profesorado y su facturación.

El producto cubre tres cosas que hoy una academia resuelve por separado:
gestionar la operación (alumnos, profesores, calendario, cobros), producir el
material didáctico (generación con IA anclada al MCER) y medir lo que pasa
(satisfacción, progreso, riesgo de baja).

## 2. Decisiones de producto

| Decisión | Valor | Consecuencia |
|---|---|---|
| Cliente | SaaS vendido a academias | Multi-tenant desde el primer día |
| Cobros | Doble capa | La escuela paga tu suscripción con tu Stripe; cobra a sus alumnos con Stripe Connect |
| Comisión de plataforma | **Configurable por escuela** | `application_fee_bps` + interruptor; se congela en cada factura |
| Idiomas de la interfaz | **Multiidioma** | Locale en escuela y en persona; contenido con tablas de traducción |
| Edad del alumnado | **Cualquiera** | Tutor legal, consentimiento parental y bloqueo de grabación desde la ola 1 |
| Equipo | Una persona con Claude Code | Cada ola debe ser vendible por sí sola |
| Piloto | No hay | Conseguir una academia piloto es tarea de la ola 1, no posterior |

### 2.1 Menores de edad

Aceptar alumnado de cualquier edad no es una casilla: cambia el modelo.

- `student_profiles.date_of_birth` es obligatoria. La minoría de edad se
  deriva, no se declara.
- Un menor necesita al menos un `guardian` con `can_give_consent`.
- Todo `consent` de un menor lleva `granted_by_membership_id` apuntando al
  tutor, nunca al propio alumno.
- Las facturas de un menor se emiten a nombre del tutor
  (`invoices.bill_to_membership_id`).
- **Si un solo participante de una clase no tiene consentimiento de grabación,
  no se graba ni se transcribe la clase entera.** El estado es
  `transcripts.status = 'blocked_no_consent'` y queda registrado el motivo.

### 2.2 Multiidioma

Tres niveles distintos, y confundirlos genera errores:

1. **Interfaz** — `users.locale`, con `memberships.locale` como preferencia por
   escuela. Ficheros de traducción, no base de datos.
2. **Datos de la escuela** — nombres de curso, unidades, ejercicios. Tablas
   `*_translations` con `machine_translated` para saber qué no ha revisado
   nadie.
3. **Idioma que se enseña** — `courses.language`. No tiene nada que ver con los
   dos anteriores: una escuela alemana puede enseñar español a un alumno que
   lee la interfaz en inglés.

Las facturas se emiten en `invoices.locale`, que sale del destinatario.

## 3. Arquitectura

**NestJS + hexagonal + DDD + CQRS** en la API. Monorepo npm workspaces con tres
aplicaciones y dos paquetes:

| App | Qué es | Cuándo |
|---|---|---|
| `apps/api` | API NestJS. Toda la lógica de negocio vive aquí | Olas 0-4 |
| `apps/web` | Panel, aula y portal. **SPA con Vite + React**, sin lógica de negocio | Ola 1 |
| `apps/sites` | Webs públicas de las escuelas. **Astro con SSR multidominio** | Ola 4 |

Dos herramientas de frontend porque son dos productos con necesidades
opuestas, no por indecisión:

- El **panel** está tras login, no tiene SEO y es muy interactivo (calendario
  con arrastrar y soltar, estado compartido entre rutas, vídeo en tiempo real).
  Con la API ya separada no necesita renderizado en servidor: una SPA es la
  opción más simple y directa.
- Las **webs de las escuelas** son lo contrario: SEO crítico, dominio propio
  por escuela, contenido mayormente estático. Astro sirve varios dominios desde
  un despliegue y envía una fracción del JavaScript.

No comparten ni una pantalla, y las separan seis meses. Solo comparten los
tokens de diseño.

```
apps/api/src/contexts/<contexto>/
├── domain/          TypeScript puro. Reglas de negocio. Cero framework.
├── application/     Casos de uso sobre CQRS. Comandos y consultas.
└── infrastructure/  BD, controladores, comunicación entre módulos, externos.
```

Las dependencias apuntan hacia dentro. El detalle está en `ARCHITECTURE.md`.

### 3.1 Contextos acotados

| Contexto | Módulos del plan original |
|---|---|
| `iam` | 9, 10 — identidad, OAuth, tenants |
| `people` | 1, 2 — alumnos, profesores, tutores, consentimientos |
| `catalog` | 3 — cursos, grupos, matrículas |
| `scheduling` | 3, 12 — calendario, clases, asistencia, aulas |
| `learning` | 4 — contenido, ejercicios, generación con IA |
| `assessment` | 5, 11 — exámenes, nivelación, valoraciones |
| `billing` | 7 — facturas, cobros, comisión, créditos |
| `feedback` | 2 — encuestas, NPS, reseñas |
| `classroom` | 13 — transcripción, grabaciones |
| `sites` | 10 — constructor de webs |

El **servidor MCP (módulo 8) no es un contexto**: es otro adaptador de entrada
sobre los mismos comandos y consultas.

### 3.2 Comunicación entre contextos

- **Evento** para lo que ya pasó. El emisor no conoce al oyente; el oyente no
  puede impedirlo. Solo se importa la clase del evento.
- **Puerto + capa anticorrupción** para lo que hay que preguntar ahora. El
  puerto se declara en el contexto que pregunta, en su propio lenguaje.
- **Prohibido** `imports: [OtroContextoModule]`.

### 3.3 Aislamiento entre escuelas

Tres capas, ninguna sobra:

1. Rol `langopia_app` **sin `BYPASSRLS`**.
2. `UnitOfWork` fija `app.school_id` con `set_config(..., true)` — local a la
   transacción, para que el pool no filtre el tenant.
3. Política RLS en cada tabla con `school_id`.

**Todo acceso a datos va dentro de `uow.execute()` o `uow.read()`, también las
consultas.** Fuera de ahí no hay tenant y RLS devuelve vacío en silencio.

Los repositorios **no filtran por `school_id`**: hacerlo daría la falsa
impresión de que la protección está en el código.

## 4. Stack

| Capa | Elección | Motivo |
|---|---|---|
| API | NestJS 11 | Módulos = contextos; DI para los puertos; CQRS integrado |
| Lenguaje | TypeScript estricto | Un solo lenguaje en todo el proyecto |
| Datos | PostgreSQL 17 + Drizzle | RLS nativa; Drizzle es un detalle sustituible |
| Contexto por petición | `nestjs-cls` | Tenant y transacción sin pasarlos por parámetro |
| Identidad | Better Auth | Resuelve OAuth y el servidor OAuth 2.1 para MCP con una pieza |
| Cobros | Stripe Billing + Connect | Tu suscripción y el cobro de la escuela, separados |
| Aula | LiveKit + Meet/Zoom/Teams | Aula propia para control; integraciones para no perder ventas |
| IA | Claude + TTS + imagen | Salida estructurada validada contra esquema |

**Riesgo abierto:** Better Auth sobre NestJS. Su integración de primera clase
es con Next.js; bajo Nest se monta como handler sobre Express. Debe validarse
en la ola 0, antes de construir nada encima.

## 5. Modelo de datos

45 tablas, agrupadas por dominio en `packages/db/src/schema/`. Toda tabla con
datos de una escuela lleva `school_id` y política RLS.

Las dos únicas tablas globales, y por qué:

- `users` — una persona puede dar clase en dos escuelas. Duplicarla rompería
  el inicio de sesión único.
- `plans` — el catálogo de planes es de la plataforma, no de cada escuela.

## 6. Economía

| Plan | Precio | Alumnos activos | Incluye |
|---|---|---|---|
| Inicial | 49 €/mes | 50 | Operación y cobros. Sin IA. |
| Crecimiento | 149 €/mes | 250 | + contenido y exámenes, 500 créditos |
| Escala | 349 €/mes | sin límite | + transcripción, MCP, webs, 2.000 créditos |
| Recargas | 0,10 €/crédito | — | Sin caducidad |

La IA es coste variable: se vende por créditos, no dentro de la tarifa plana.
`ai_generations` registra el coste real de cada llamada; la diferencia con
`credits_charged` es el margen.

### 6.1 Vídeo generado

El vídeo generado sigue siendo una beta desactivada por defecto.

El criterio para sacarlo de beta es deliberadamente comercial, no técnico: más
del 60 % de los vídeos generados deben haberse publicado sin regenerar. A 28 de
julio de 2026 no hay uso real ni credenciales de proveedor en este entorno para
medir esa tasa. Los datos disponibles son de seed o de pruebas con dobles, así
que no demuestran que el resultado sirva a una escuela real ni que reduzca
trabajo docente.

Consecuencias:

- `videoBetaEnabled` permanece apagado por defecto en las escuelas nuevas.
- Los vídeos generados conservan aviso beta y no bloquean la publicación de una
  unidad si el proveedor falla.
- Las webs públicas y materiales comerciales no deben prometer vídeo generado
  como prestación estable hasta cumplir el umbral con uso real.
- La siguiente revisión debe contar vídeos generados, publicados sin regenerar,
  descartados, regenerados y reseñas asociadas al material con vídeo.

## 7. Calendario y criterios de «listo»

El calendario original (36 semanas) no contaba el frontend, y sin interfaz no
hay producto vendible. Recalculado con las tareas de panel, notificaciones,
registro de escuela, importación, edición de fichas, RGPD y operación:

| Ola | Semanas | Tareas | Listo cuando |
|---|---|---|---|
| 0 | 1–4 | 14 | Una prueba automática demuestra que la escuela A no puede leer ninguna fila de la B; API desplegada; copia restaurada con éxito |
| 1 | 5–21 | 16 backend + 13 panel | Una escuela piloto **se registra sola**, da de alta 30 alumnos desde el panel o los importa de su Excel, imparte una semana de clases y emite sus recibos sin que toques nada |
| 2 | 22–29 | 16 | Un profesor genera una unidad, la revisa, la publica y los alumnos la completan; el coste se descuenta de los créditos |
| 3 | 30–37 | 11 | Desde Claude preguntas «¿qué alumnos de B1 llevan tres semanas sin valorar?» y obtienes la respuesta de tu escuela, aislada del resto |
| 4 | 38–45 | 10 | Una escuela publica su web, recibe una solicitud y ese contacto se convierte en alumno matriculado sin intervención manual |

Las cinco olas están detalladas tarea a tarea: **80 tareas y 536 pasos** en
`docs/superpowers/plans/`, con su índice en el `README.md` de esa carpeta.
Están escritas para tener la foto completa, no para ejecutarse a la vez —cada
ola espera a que la anterior esté en producción.

**Lo vendible pasa de la semana 12 a la 21.** El motivo no es que haya crecido
el alcance: es que el plan anterior daba por hecha una interfaz que nadie iba a
construir. El calendario de 36 semanas era optimista por omisión, no por
ambición.

### Si hace falta acortar

Dos partidas de la ola 1 se pueden posponer sin romper el criterio de vendible,
a cambio de trabajo manual tuyo durante el piloto:

| Se pospone | Ahorro | Qué implica |
|---|---|---|
| Importación desde CSV | ~1,5 semanas | Los datos del piloto los cargas tú con un script |
| RGPD operativo (exportación y borrado) | ~1 semana | Aceptable con un piloto pequeño; **no** con un cliente institucional |

Con las dos fuera, lo vendible cae a la semana 19. La purga de grabaciones
vencidas (ola 0, tarea 12) **no** entra en ese recorte: es lo que impide
incumplir la retención que la propia escuela configura.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Construirlo todo antes de vender nada | Escuela piloto cerrada **antes** de empezar la ola 2 |
| Fuga entre tenants | RLS obligatoria + test de aislamiento en cada despliegue |
| El coste de IA se come el margen | Créditos con tope duro, caché y modelo barato para tareas mecánicas |
| Grabaciones, menores y RGPD | Consentimiento por participante, retención configurable, borrado real |
| Fricción en el onboarding de Connect | El producto se usa entero antes de conectar Stripe |
| Las integraciones de vídeo se rompen | LiveKit es el camino principal; el resto es comodidad |
| Better Auth no encaja en Nest | Validarlo en la ola 0, antes de construir encima |
| Ceremonia de DDD frena la entrega | Rigor completo donde hay reglas (cobros, consentimientos, calendario); ligero en los CRUD (catálogo, traducciones) |

## 9. Estado a fecha de hoy

**Hecho y verificado contra Postgres real:**

- Monorepo con `apps/api` y `packages/db`.
- Esquema completo (45 tablas), políticas RLS con verificación automática de
  cobertura, y seed de 3 escuelas que cubre todos los casos borde y comprueba
  el aislamiento.
- Núcleo compartido del dominio: primitivas, puertos (`Clock`, `IdGenerator`,
  `UnitOfWork`, `EventPublisher`, `TenantContext`) y sus adaptadores.
- Contexto `scheduling` completo: dominio, CQRS y toda la infraestructura.
- Contexto `billing` como esqueleto que escucha eventos.
- `typecheck` limpio, API arrancando, endpoints y reglas de dominio probados.

**Pendiente en la ola 0:** autenticación real, i18n, pruebas automatizadas,
migraciones versionadas, integración continua, despliegue, copias verificadas y
purga de datos vencidos.

**No empezado:** el panel web (`apps/web`) y todo el contexto de
notificaciones. Son la mitad del trabajo de la ola 1.
