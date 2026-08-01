# Langopia

CRM SaaS multi-tenant para academias de idiomas online.

API en **NestJS** con **arquitectura hexagonal, DDD y CQRS**: el dominio es
TypeScript puro, la aplicación orquesta sobre el bus de comandos y consultas, y
la infraestructura contiene la base de datos, los controladores, la
comunicación entre contextos y los servicios externos.

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — dónde va cada cosa y por qué.
  Léelo antes de añadir un contexto.

## Estructura

```
apps/
  api/                      NestJS. Un módulo por contexto acotado.
    src/contexts/
      shared/               Primitivas de dominio y adaptadores comunes
      scheduling/           Calendario y clases — contexto de referencia, completo
      billing/              Facturación — esqueleto: por ahora solo escucha eventos
packages/
  db/                       Esquema, políticas de aislamiento y seed
```

## Arrancar

```bash
npm install

docker run -d --name langopia-pg \
  -e POSTGRES_USER=langopia -e POSTGRES_PASSWORD=langopia -e POSTGRES_DB=langopia \
  -p 55432:5432 postgres:17-alpine

cp .env.example .env
npm run db:reset                          # esquema + políticas RLS + datos de demostración
npm run build --workspace @langopia/db    # la API consume el paquete compilado
npm run api:dev
```

| Comando | Qué hace |
|---|---|
| `npm run db:reset` | Solo desarrollo: `db:push` + políticas + seed |
| `npm run db:deploy` | Producción: `db:migrate` + políticas |
| `npm run db:policies` | Aplica RLS y **falla** si alguna tabla queda sin proteger |
| `npm run db:seed` | Regenera los datos y verifica el aislamiento entre escuelas |
| `npm run db:studio` | Explorador visual de la base de datos |
| `npm run api:dev` | API en `http://localhost:3000/api/v1` |
| `npm run typecheck` | Comprueba tipos en todo el monorepo |

## Aislamiento entre escuelas

Es la decisión de la que depende todo lo demás, y no se confía a la disciplina
de quien escribe cada consulta.

- Una base de datos. Toda tabla con datos de una escuela lleva `school_id` y
  una política **Row Level Security**.
- La API se conecta con el rol `langopia_app`, que **no** tiene `BYPASSRLS`.
- El tenant se fija por transacción con `set_config('app.school_id', …, true)`.
  El tercer parámetro impide que el contexto se filtre entre peticiones que
  comparten conexión del pool.
- Sin contexto no se ve **ninguna** fila. El fallo por defecto es no ver nada.

`npm run db:policies` recorre el catálogo de Postgres y falla si encuentra una
tabla desprotegida: olvidar una política es un error de despliegue, no un
incidente de seguridad.

> **Todo acceso a datos va dentro de `uow.execute()` o `uow.read()`, también
> las consultas.** Fuera de ahí no hay tenant y RLS devuelve vacío en silencio.

Comprobación de que el dominio no se ha ensuciado:

```bash
grep -rE "from \"(@nestjs|drizzle-orm|express|@langopia/db)" apps/api/src/contexts/*/domain/
# Sin resultados = correcto.
```

## Datos de demostración

Tres escuelas con perfiles deliberadamente distintos:

| Escuela | Idioma | Plan | Connect | Comisión | Para qué está |
|---|---|---|---|---|---|
| Escuela Atlántico | es-ES | Crecimiento | activo | 2 % | La escuela completa. Reproduce el panel de dirección del diseño. |
| Sprachschule Nordwind | de-DE | Inicial | sin empezar | desactivada | El día uno: en prueba, sin cobros, sin IA, alumnado infantil. |
| Idiomas Paulista | pt-BR | Escala | activo | 0 % pactado | Escuela grande: dominio propio, MCP, transcripción, suscripción impagada. |

Las tarifas y la estructura de cursos siguen referencias reales de julio de
2026: tramos de italki y Preply (community 4-15 €/h, professional 15-40 €/h,
specialist 30-75 €/h) y el formato de Lingoda (sesiones de 60 minutos, grupos
de 3 a 5, ~100 sesiones por nivel MCER).

El seed imprime al terminar un recuento de casos borde y avisa si alguno se ha
quedado sin datos. Cubre: alumnos en riesgo de baja, sin valorar, de baja y
pausados; menores con tutor legal y consentimientos delegados; profesores
sobrecargados, infrautilizados, que se fueron y uno que trabaja en dos
escuelas; clases completadas, canceladas por cada parte, replanificadas y sin
asistentes en las cuatro plataformas de vídeo; los once tipos de ejercicio;
correcciones de IA validadas y sin validar; facturas pagadas, vencidas,
fallidas y con devolución parcial o total; transcripciones listas, importadas y
bloqueadas por falta de consentimiento; y clientes MCP activos y revocados.

Determinismo: el relleno usa un PRNG con semilla fija (`SEED_RANDOM_SEED`). Las
fechas son relativas a hoy para que el panel siempre tenga clases «esta
semana».

## Pendiente

- Sustituir el `TenantInterceptor` de cabeceras por sesiones de Better Auth.
- Migraciones versionadas en lugar de `db:push` antes de tocar producción.
- Cambiar la contraseña de `langopia_app` en `policies.sql` por un secreto real.
- Pruebas del dominio: es puro, se prueba sin base de datos ni NestJS.
- Los once contextos que faltan. `scheduling` es la plantilla.
