# Planes de implementación

Siete documentos, 80 tareas y 536 pasos ejecutables. Cubren las cinco olas de
principio a fin.

**Cada ola se ejecuta cuando la anterior está en producción con alguien
usándola.** Están todas escritas para tener la foto completa, no para
ejecutarlas a la vez.

## Orden

| # | Ola | Documento | Tareas | Semanas |
|---|---|---|---|---|
| 1 | **0 · Fundaciones** | `2026-07-25-ola-0-fundaciones.md` | 14 | 1–4 |
| 2 | **1 · Núcleo vendible (API)** | `2026-07-25-ola-1-nucleo-vendible.md` | 16 | 5–21 |
| 3 | **1 · Panel web** | `2026-07-26-ola-1-panel-web.md` | 13 | (en paralelo) |
| 4 | **2 · Contenido con IA** | `2026-07-26-ola-2-contenido-ia.md` | 16 | 22–29 |
| 5 | **3 · Analítica y MCP** | `2026-07-26-ola-3-analitica-mcp.md` | 11 | 30–37 |
| 6 | **4 · Webs y captación** | `2026-07-26-ola-4-webs-captacion.md` | 10 | 38–45 |

Los dos documentos de la ola 1 se ejecutan intercalados: cada pantalla necesita
sus endpoints, así que conviene ir cerrando vertical por vertical (alumnado
completo, luego calendario completo) en vez de todo el backend y luego todo el
frontend.

## Nada se bloquea por falta de datos

**El seed cubre las cuatro olas.** Cualquiera se puede desarrollar y probar hoy,
sin esperar a tener un cliente:

| Ola | Datos que ya trae el seed |
|---|---|
| 1 | 67 alumnos (7 menores con tutor), 9 profesores, 155 clases en todos sus estados, 56 facturas con comisión, 4 plataformas de vídeo |
| 2 | Unidades en los tres estados, los 11 tipos de ejercicio, intentos sin firmar, 33 tarjetas de repaso, 120 ítems de nivelación calibrados, créditos con consumo real |
| 3 | 26 semanas de histórico de NPS y CSAT, valoraciones en dos periodos, transcripciones en sus 4 estados, 3 autorizaciones MCP (activa, revocada, caducada) |
| 4 | Sitio publicado con 8 páginas en 2 idiomas y 26 bloques, 20 candidatos por los 7 estados del embudo |

La única dependencia técnica real es **la ola 0 antes que todo lo demás**:
sin sesión, sin pruebas y sin despliegue, lo que construyas encima no se
sostiene.

El orden de las olas sigue siendo el recomendado por criterio de negocio
—cobrar antes de generar contenido, tener clientes antes de hacerles webs—,
pero eso afecta a **cuándo lo vendes, no a cuándo lo construyes**.

## Lo que ya está construido

No aparece como tarea pendiente en ningún plan porque **ya funciona y está
verificado contra Postgres**. Documentado como «tarea 0 completada» en el plan
de la ola 1:

| Pieza | Qué incluye |
|---|---|
| Esquema y aislamiento | 51 tablas, 47 políticas RLS con verificación de cobertura |
| Seed | 3 escuelas con datos de las cuatro olas y comprobación de fuga entre tenants |
| Núcleo compartido | Primitivas de dominio, 5 puertos y sus adaptadores |
| **Contexto `scheduling`** | **Tu módulo 3 completo**: dominio, CQRS e infraestructura (28 ficheros) |
| Contexto `billing` | Esqueleto que reacciona a la cancelación de clases |

`scheduling` es además la **plantilla**: cuando un plan dice «sigue el patrón
de `scheduling`», se refiere a ese contexto.

## Antes de tocar cualquier plan

- El diseño consolidado: `../specs/2026-07-25-langopia-diseno.md`
- Las fronteras de la arquitectura: `../../ARCHITECTURE.md`
- El contexto de referencia ya construido: `apps/api/src/contexts/scheduling/`

## Cómo ejecutarlos

Cada plan lleva en su cabecera la sub-skill obligatoria. Dos formas:

1. **Con subagentes** — un agente por tarea, con revisión entre una y otra.
   Contexto fresco en cada tarea, iteración rápida.
2. **En sesión** — ejecución por lotes con puntos de control.

Los pasos usan casillas para marcar el avance según se completan.
