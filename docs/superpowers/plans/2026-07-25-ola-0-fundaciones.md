# Ola 0 — Fundaciones · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** dejar el terreno listo para construir producto: identidad real, multiidioma, pruebas y despliegue, sobre la base ya montada.

**Arquitectura:** NestJS con hexagonal + DDD + CQRS. El dominio es TypeScript puro; la aplicación orquesta con CQRS; la infraestructura contiene base de datos, controladores, comunicación entre contextos y servicios externos. El aislamiento entre escuelas lo garantiza Postgres con RLS, no el código de aplicación.

**Stack:** NestJS 11, TypeScript estricto, Drizzle, PostgreSQL 17, `nestjs-cls`, Better Auth, Vitest.

## Restricciones globales

- Node ≥ 22. TypeScript en modo estricto con `noUncheckedIndexedAccess`.
- `apps/api/src/contexts/*/domain/` **no puede importar** `@nestjs/*`, `drizzle-orm`, `express` ni `@langopia/db`. Verificable con el grep de la Tarea 3.
- Todo acceso a datos va dentro de `uow.execute()` o `uow.read()`. Sin excepción, también las consultas.
- Los repositorios **no filtran por `school_id`**: lo hace RLS.
- Toda tabla nueva con `school_id` necesita su política; `npm run db:policies` falla si falta alguna.
- Los mensajes de cara al usuario van en español. Los identificadores de código, en inglés.
- Commits en español, formato convencional: `feat:`, `fix:`, `test:`, `chore:`, `docs:`.

## Estado de partida

Ya está hecho y verificado (no repetir):

| Pieza | Dónde |
|---|---|
| Monorepo, esquema de 45 tablas, políticas RLS, seed de 3 escuelas | `packages/db/` |
| Núcleo compartido del dominio y sus adaptadores | `apps/api/src/contexts/shared/` |
| Contexto `scheduling` completo | `apps/api/src/contexts/scheduling/` |
| Contexto `billing` (esqueleto que escucha eventos) | `apps/api/src/contexts/billing/` |

Lo que falta es lo que planifica este documento.

---

## Tarea 1: Infraestructura de pruebas

Sin esto, ninguna tarea posterior puede seguir el ciclo test-primero. Va antes que todo lo demás.

**Ficheros:**
- Crear: `apps/api/vitest.config.ts`
- Crear: `apps/api/src/contexts/scheduling/domain/model/time-slot.spec.ts`
- Modificar: `apps/api/package.json` (scripts y dependencias)

**Interfaces:**
- Consume: nada.
- Produce: comando `npm run test --workspace @langopia/api`; patrón de prueba de dominio sin base de datos ni NestJS.

- [x] **Paso 1: Instalar Vitest**

```bash
cd apps/api
npm install -D vitest@^3 @vitest/coverage-v8@^3
```

- [x] **Paso 2: Crear la configuración**

```typescript
// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      // El dominio es puro: si algo debe estar cubierto, es esto.
      include: ["src/contexts/*/domain/**"],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
```

- [x] **Paso 3: Añadir los scripts**

En `apps/api/package.json`, sustituir el script `test` existente:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:cov": "vitest run --coverage"
```

- [x] **Paso 4: Escribir la prueba que debe fallar**

```typescript
// apps/api/src/contexts/scheduling/domain/model/time-slot.spec.ts
import { describe, expect, it } from "vitest";
import { TimeSlot } from "./time-slot.vo.js";

describe("TimeSlot", () => {
  const monday10 = new Date("2026-09-07T10:00:00Z");

  it("acepta una clase de 60 minutos", () => {
    const slot = TimeSlot.fromDuration(monday10, 60);
    expect(slot.durationMinutes).toBe(60);
    expect(slot.end.toISOString()).toBe("2026-09-07T11:00:00.000Z");
  });

  it("rechaza una clase de menos de 15 minutos", () => {
    expect(() => TimeSlot.fromDuration(monday10, 10)).toThrow(/15 minutos/);
  });

  it("rechaza una clase de más de 4 horas", () => {
    expect(() => TimeSlot.fromDuration(monday10, 300)).toThrow(/240 minutos/);
  });

  it("rechaza que el fin no sea posterior al inicio", () => {
    expect(() => TimeSlot.of(monday10, monday10)).toThrow(/posterior/);
  });

  it("detecta solape entre franjas", () => {
    const a = TimeSlot.fromDuration(monday10, 60);
    const b = TimeSlot.fromDuration(new Date("2026-09-07T10:30:00Z"), 60);
    expect(a.overlaps(b)).toBe(true);
  });

  it("no considera solape que dos clases se toquen", () => {
    const a = TimeSlot.fromDuration(monday10, 60);
    const b = TimeSlot.fromDuration(new Date("2026-09-07T11:00:00Z"), 60);
    expect(a.overlaps(b)).toBe(false);
  });

  it("calcula las horas de antelación", () => {
    const slot = TimeSlot.fromDuration(monday10, 60);
    const now = new Date("2026-09-06T10:00:00Z");
    expect(slot.hoursOfNoticeFrom(now)).toBe(24);
  });

  it("conserva la duración al mover la clase", () => {
    const slot = TimeSlot.fromDuration(monday10, 90);
    const moved = slot.movedTo(new Date("2026-09-08T16:00:00Z"));
    expect(moved.durationMinutes).toBe(90);
  });
});
```

- [x] **Paso 5: Ejecutar y comprobar que pasa**

Comando: `npm run test --workspace @langopia/api`
Esperado: 8 pruebas en verde. `TimeSlot` ya existe, así que estas pruebas documentan comportamiento existente en lugar de guiar código nuevo — es correcto para la primera prueba, cuya función es validar el arnés.

- [x] **Paso 6: Commit**

```bash
git add apps/api/vitest.config.ts apps/api/package.json apps/api/src/contexts/scheduling/domain/model/time-slot.spec.ts
git commit -m "test: añadir Vitest y cubrir el objeto de valor TimeSlot"
```

---

## Tarea 2: Pruebas de la política de cancelación y del agregado

La regla de negocio con más valor del sistema hoy. Es dominio puro: se prueba sin base de datos.

**Ficheros:**
- Crear: `apps/api/src/contexts/scheduling/domain/model/session-status.ts`
- Crear: `apps/api/src/contexts/scheduling/domain/model/cancellation-policy.spec.ts`
- Crear: `apps/api/src/contexts/scheduling/domain/model/class-session.spec.ts`
- Modificar: `class-session.aggregate.ts` y `room.vo.ts` para usar los conjuntos en lugar de literales

**Interfaces:**
- Consume: `TimeSlot`, `CancellationPolicy`, `ClassSession`, `Room`, `SessionId`, `GroupId`, `TeacherId`, `SchoolId`, `MembershipId` (Tarea 1 y código existente).
- Produce: `SessionStatus`, `CancelingParty`, `RoomProvider`, y la garantía de que la política y la máquina de estados no se rompen al tocarlas.

- [x] **Paso 0: Extraer los conjuntos cerrados**

Hoy `"canceled_by_student"`, `"livekit"` y `"student"` están escritos a mano en varios sitios de `scheduling`. Antes de escribir pruebas que los repitan otra vez, se declaran una vez:

```typescript
// apps/api/src/contexts/scheduling/domain/model/session-status.ts
export const SessionStatus = {
  Scheduled: "scheduled",
  InProgress: "in_progress",
  Completed: "completed",
  CanceledBySchool: "canceled_by_school",
  CanceledByStudent: "canceled_by_student",
  Rescheduled: "rescheduled", // esta instancia se sustituyó por otra
  NoShow: "no_show",          // nadie se conectó
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

/** Quién cancela cambia si procede devolución, así que es del dominio. */
export const CancelingParty = {
  School: "school",
  Student: "student",
} as const;

export type CancelingParty = (typeof CancelingParty)[keyof typeof CancelingParty];
```

`RoomProvider` va en `room.vo.js`, junto al objeto de valor que lo usa, con los cinco valores de la columna `room_provider`.

Sustituir después los literales en `class-session.aggregate.ts` y `room.vo.ts`. La prueba de coherencia con la base de datos (tarea 3, paso 1b) es la que impide que se separen.

- [x] **Paso 1: Escribir las pruebas de la política**

```typescript
// apps/api/src/contexts/scheduling/domain/model/cancellation-policy.spec.ts
import { describe, expect, it } from "vitest";
import { CancellationPolicy } from "./cancellation-policy.js";
import { CancelingParty } from "./session-status.js";
import { TimeSlot } from "./time-slot.vo.js";

describe("CancellationPolicy", () => {
  const policy = CancellationPolicy.default(); // 24 h
  const slot = TimeSlot.fromDuration(new Date("2026-09-07T10:00:00Z"), 60);

  it("el alumno tiene devolución si avisa con la antelación mínima", () => {
    const twoDaysBefore = new Date("2026-09-05T10:00:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.Student, slot, canceledAt: twoDaysBefore })).toBe(true);
  });

  it("el alumno NO tiene devolución si avisa tarde", () => {
    const threeHoursBefore = new Date("2026-09-07T07:00:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.Student, slot, canceledAt: threeHoursBefore })).toBe(false);
  });

  it("en el límite exacto de 24 h sí hay devolución", () => {
    const exactlyAtLimit = new Date("2026-09-06T10:00:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.Student, slot, canceledAt: exactlyAtLimit })).toBe(true);
  });

  it("si cancela la escuela SIEMPRE hay devolución, avise cuando avise", () => {
    const fiveMinutesBefore = new Date("2026-09-07T09:55:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.School, slot, canceledAt: fiveMinutesBefore })).toBe(true);
  });

  it("rechaza una antelación negativa", () => {
    expect(() => CancellationPolicy.of(-1)).toThrow(/no negativo/);
  });

  it("rechaza una antelación de más de una semana", () => {
    expect(() => CancellationPolicy.of(200)).toThrow(/una semana/);
  });
});
```

- [x] **Paso 2: Ejecutar**

Comando: `npm run test --workspace @langopia/api -- cancellation-policy`
Esperado: 6 en verde.

- [x] **Paso 3: Escribir las pruebas del agregado**

```typescript
// apps/api/src/contexts/scheduling/domain/model/class-session.spec.ts
import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CancellationPolicy } from "./cancellation-policy.js";
import { ClassSession } from "./class-session.aggregate.js";
import { GroupId, SessionId, TeacherId } from "./identifiers.js";
import { Room } from "./room.vo.js";
import { TimeSlot } from "./time-slot.vo.js";

const NOW = new Date("2026-09-01T09:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const GROUP = GroupId.of("22222222-2222-4222-8222-222222222222");
const TEACHER = TeacherId.of("33333333-3333-4333-8333-333333333333");
const ACTOR = MembershipId.of("44444444-4444-4444-8444-444444444444");

function newSession(daysAhead = 7) {
  const startsAt = new Date(NOW.getTime() + daysAhead * 86_400_000);
  return ClassSession.schedule({
    id: SessionId.of("55555555-5555-4555-8555-555555555555"),
    schoolId: SCHOOL,
    groupId: GROUP,
    teacherId: TEACHER,
    slot: TimeSlot.fromDuration(startsAt, 60),
    room: Room.of({ provider: RoomProvider.LiveKit, url: "https://aula.langopia.app/x" }),
    now: NOW,
  });
}

describe("ClassSession", () => {
  it("al programarse emite el evento correspondiente", () => {
    const session = newSession();
    const events = session.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventName).toBe("scheduling.class_session.scheduled");
  });

  it("no se puede programar en el pasado", () => {
    expect(() => newSession(-1)).toThrow(/pasado/);
  });

  it("al cancelar congela si procede devolución", () => {
    const session = newSession();
    session.pullDomainEvents();
    session.cancel({
      party: CancelingParty.Student,
      by: ACTOR,
      reason: "Viaje",
      policy: CancellationPolicy.default(),
      now: NOW,
    });
    expect(session.status).toBe(SessionStatus.CanceledByStudent);
    expect(session.cancellation!.refundDue).toBe(true);
    expect(session.pullDomainEvents()[0]!.eventName).toBe("scheduling.class_session.canceled");
  });

  it("no se puede cancelar dos veces", () => {
    const session = newSession();
    const cancel = () =>
      session.cancel({
        party: CancelingParty.School,
        by: ACTOR,
        reason: "x",
        policy: CancellationPolicy.default(),
        now: NOW,
      });
    cancel();
    expect(cancel).toThrow(/cancel una session en estado/);
  });

  it("al replanificar cierra la original y devuelve la sustituta", () => {
    const session = newSession();
    session.pullDomainEvents();
    const replacement = session.rescheduleTo({
      newSessionId: SessionId.of("66666666-6666-4666-8666-666666666666"),
      newSlot: session.slot.movedTo(new Date("2026-09-10T16:00:00Z")),
      reason: "Conflicto de agenda",
      now: NOW,
    });
    expect(session.status).toBe(SessionStatus.Rescheduled);
    expect(replacement.status).toBe(SessionStatus.Scheduled);
    expect(replacement.rescheduledFrom!.value).toBe(session.id.value);
    expect(replacement.slot.durationMinutes).toBe(60);
  });

  it("una clase a la que no se conectó nadie no es «completada» sino «sin asistentes»", () => {
    const session = newSession();
    session.complete({ now: NOW, anyoneAttended: false });
    expect(session.status).toBe(SessionStatus.NoShow);
    expect(session.pullDomainEvents().filter((e) => e.eventName.endsWith("completed"))).toHaveLength(0);
  });

  it("una clase completada emite el evento con la capacidad de transcripción del aula", () => {
    const session = newSession();
    session.pullDomainEvents();
    session.complete({ now: NOW, anyoneAttended: true });
    const event = session.pullDomainEvents()[0]!;
    expect(event.eventName).toBe("scheduling.class_session.completed");
    expect(event.payload().transcriptionCapable).toBe(true);
  });

  it("una clase cancelada no cuenta para la ocupación del profesor", () => {
    const session = newSession();
    expect(session.countsTowardsOccupancy).toBe(true);
    session.cancel({
      party: CancelingParty.School,
      by: ACTOR,
      reason: "x",
      policy: CancellationPolicy.default(),
      now: NOW,
    });
    expect(session.countsTowardsOccupancy).toBe(false);
  });
});
```

- [x] **Paso 4: Ejecutar**

Comando: `npm run test --workspace @langopia/api`
Esperado: 22 pruebas en verde (8 + 6 + 8).

- [x] **Paso 5: Commit**

```bash
git add apps/api/src/contexts/scheduling/domain/model/*.spec.ts
git commit -m "test: cubrir la política de cancelación y el agregado ClassSession"
```

---

## Tarea 3: Guardia de arquitectura automatizada

La regla «el dominio no importa infraestructura» solo vale si algo la comprueba. Hoy es un grep en el README que nadie ejecuta.

**Ficheros:**
- Crear: `apps/api/src/architecture.spec.ts`

**Interfaces:**
- Consume: nada.
- Produce: fallo de test si alguien ensucia el dominio o cruza fronteras entre contextos.

- [x] **Paso 1: Escribir la prueba**

```typescript
// apps/api/src/architecture.spec.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTEXTS_DIR = join(import.meta.dirname, "contexts");

function tsFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) output.push(...tsFiles(path));
    else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) output.push(path);
  }
  return output;
}

function contexts(): string[] {
  return readdirSync(CONTEXTS_DIR).filter((d) =>
    statSync(join(CONTEXTS_DIR, d)).isDirectory(),
  );
}

describe("Fronteras de la arquitectura", () => {
  const FORBIDDEN_IN_DOMAIN = ["@nestjs/", "drizzle-orm", "express", "@langopia/db", "postgres"];

  it("ningún dominio importa infraestructura", () => {
    const violations: string[] = [];

    for (const context of contexts()) {
      const domain = join(CONTEXTS_DIR, context, "domain");
      let files: string[];
      try {
        files = tsFiles(domain);
      } catch (error) {
        // Solo se tolera «todavía no existe». Cualquier otro fallo de lectura
        // haría que la guardia pasara sin comprobar nada, que es peor que no
        // tenerla.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        continue;
      }
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        for (const forbidden of FORBIDDEN_IN_DOMAIN) {
          if (content.includes(`from "${forbidden}`)) {
            violations.push(`${file} importa ${forbidden}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("un contexto solo importa los eventos de otro", () => {
    const violations: string[] = [];
    const all = contexts().filter((c) => c !== "shared");

    for (const context of all) {
      for (const file of tsFiles(join(CONTEXTS_DIR, context))) {
        const content = readFileSync(file, "utf8");
        for (const other of all) {
          if (other === context) continue;
          // Entre contextos, lo único público son los eventos. Los comandos y
          // las consultas los importan los adaptadores de entrada, que no son
          // contextos y viven fuera de este directorio.
          const pattern = new RegExp(`from "[^"]*contexts/${other}/(?!domain/events)`, "g");
          const found = content.match(pattern);
          if (found) {
            violations.push(`${file} → ${found.join(", ")}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("un adaptador de entrada solo importa comandos, consultas y eventos", () => {
    const violations: string[] = [];
    const ENTRYPOINTS_DIR = join(import.meta.dirname, "entrypoints");

    let files: string[];
    try {
      files = tsFiles(ENTRYPOINTS_DIR);
    } catch (error) {
      // Todavía no hay adaptadores de entrada fuera de los contextos.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return;
    }

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const pattern =
        /from "[^"]*contexts\/(?!shared)[^/]+\/(?!application\/(commands|queries)|domain\/events)[^"]*"/g;
      const found = content.match(pattern);
      if (found) {
        violations.push(`${file} → ${found.join(", ")}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("solo los repositorios escriben SQL", () => {
    const violations: string[] = [];

    for (const context of contexts()) {
      for (const file of tsFiles(join(CONTEXTS_DIR, context))) {
        if (file.includes(join("infrastructure", "persistence"))) continue;
        const content = readFileSync(file, "utf8");
        if (/from "drizzle-orm"/.test(content) || /\bsql`/.test(content)) {
          violations.push(`${file} escribe SQL fuera de infrastructure/persistence/`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("ningún módulo de contexto importa el módulo de otro contexto", () => {
    const violations: string[] = [];
    for (const context of contexts()) {
      const modulePath = join(CONTEXTS_DIR, context, `${context}.module.ts`);
      let content: string;
      try {
        content = readFileSync(modulePath, "utf8");
      } catch (error) {
        // Un contexto puede no tener módulo todavía; un fallo de permisos, no.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        continue;
      }
      const imports = content.match(/imports:\s*\[([^\]]*)\]/s)?.[1] ?? "";
      if (/\w+Module/.test(imports.replace(/CqrsModule|ConfigModule|ClsModule/g, ""))) {
        violations.push(`${modulePath} importa otro módulo de contexto`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
```

- [x] **Paso 1b: Escribir la prueba de coherencia de los conjuntos cerrados**

Los estados, roles y tipos se declaran en el dominio (que no puede importar `@langopia/db`) y como `pgEnum` en el esquema. Esta prueba es lo único que impide que se separen: vive fuera de `contexts/`, así que puede importar los dos lados.

```typescript
// apps/api/src/enums-match-db.spec.ts
import * as pg from "@langopia/db/schema/enums";
import { describe, expect, it } from "vitest";
import { ConsentKind } from "./contexts/people/domain/model/consent.vo.js";
import { StudentStatus } from "./contexts/people/domain/model/student-status.js";
import { RoomProvider } from "./contexts/scheduling/domain/model/room.vo.js";
import { SessionStatus } from "./contexts/scheduling/domain/model/session-status.js";

// Cada pareja: el conjunto del dominio y su columna en Postgres.
const PAIRS: Array<[string, Record<string, string>, { enumValues: readonly string[] }]> = [
  ["StudentStatus", StudentStatus, pg.studentStatus],
  ["SessionStatus", SessionStatus, pg.sessionStatus],
  ["RoomProvider", RoomProvider, pg.roomProvider],
  ["ConsentKind", ConsentKind, pg.consentKind],
];

describe("los conjuntos del dominio coinciden con los de la base de datos", () => {
  it.each(PAIRS)("%s", (_name, domain, column) => {
    expect(Object.values(domain).sort()).toEqual([...column.enumValues].sort());
  });
});
```

Al añadir un contexto se añade su pareja aquí. Un valor nuevo en un lado y no en el otro deja de ser un fallo que aparece en producción con un `invalid input value for enum`.

- [x] **Paso 2: Ejecutar y comprobar que pasa con el código actual**

Comando: `npm run test --workspace @langopia/api -- architecture`
Esperado: 5 en verde. Si falla la segunda, revisa que la única importación cruzada sea `billing → scheduling/domain/events`. La tercera pasa en vacío hasta que exista `src/entrypoints/` (el servidor MCP de la ola 3).

- [x] **Paso 3: Comprobar que la guardia detecta una infracción**

Añadir temporalmente al principio de `apps/api/src/contexts/scheduling/domain/model/room.vo.ts`:

```typescript
import { Injectable } from "@nestjs/common";
```

Ejecutar: `npm run test --workspace @langopia/api -- architecture`
Esperado: FALLA con `room.vo.ts importa @nestjs/`.
**Después, borrar esa línea** y volver a ejecutar: verde.

- [x] **Paso 4: Commit**

```bash
git add apps/api/src/architecture.spec.ts
git commit -m "test: guardia automática de las fronteras hexagonales"
```

---

## Tarea 4: Migraciones versionadas

`db:push` vale en desarrollo y es inaceptable contra producción: aplica cambios sin registro ni marcha atrás.

**Ficheros:**
- Crear: `packages/db/drizzle/` (lo genera el comando)
- Modificar: `packages/db/package.json`
- Modificar: `README.md`

**Interfaces:**
- Consume: el esquema de `packages/db/src/schema/`.
- Produce: `npm run db:migrate` reproducible; `db:push` queda solo para iterar en local.

- [x] **Paso 0: Neutralizar el vocabulario del proveedor de pago**

**Va antes de generar la migración inicial, y esa es toda la gracia.** Hoy el esquema nombra a Stripe en nueve sitios. Mientras no haya una sola factura emitida, esto es un renombrado; con datos en producción, es una migración con conversión y ventana de riesgo sobre la tabla de cobros.

| Hoy | Pasa a ser | Por qué |
|---|---|---|
| `payments.stripe_payment_intent_id` | `payments.provider` + `payments.provider_ref` | Los dos proveedores conviven durante la transición |
| `payments.stripe_destination_account_id` | `payments.merchant_ref` | Es «a quién se paga», no «qué cuenta de Stripe» |
| `refunds.stripe_refund_id` | `refunds.provider_ref` | Idem |
| `invoices.stripe_invoice_id` | `invoices.provider_ref` | Idem |
| `subscriptions.stripe_subscription_id` | `subscriptions.provider_ref` | Idem |
| `plans.stripe_price_id` | `plans.provider_ref` | Idem |
| `schools.stripe_customer_id` | `schools.billing_customer_ref` | Idem |
| `schools.connect_account_id` | `schools.merchant_ref` | Connect es de Stripe; comerciante, nuestro |
| `schools.connect_status` (enum `connect_status`) | `schools.merchant_status` (enum `merchant_status`) | Igual, con los mismos cinco valores |
| `schools.connect_onboarded_at` | `schools.merchant_onboarded_at` | Igual |

Se añade `payment_provider` como enum nuevo, hoy con un único valor `stripe`. Parece superfluo con un solo proveedor: es exactamente lo que permite que el segundo entre sin tocar las filas del primero.

**Por qué un par `provider` + `provider_ref` y no una columna por proveedor:** cambiar de pasarela nunca es un corte limpio. Los cobros antiguos siguen viviendo en Stripe durante meses —devoluciones, disputas, conciliación— mientras los nuevos entran por el otro. Con una columna por proveedor, cada fila lleva un `NULL` que alguien tendrá que interpretar; con el par, cada cobro dice de quién es.

Actualizar también el seed y las políticas RLS que nombren esas columnas.

- [x] **Paso 1: Generar la migración inicial**

```bash
cd packages/db
npx drizzle-kit generate --name inicial
```

Esperado: aparece `packages/db/drizzle/0000_inicial.sql` y `drizzle/meta/`.

- [x] **Paso 2: Verificarla contra una base de datos limpia**

```bash
docker rm -f langopia-migra 2>/dev/null
docker run -d --name langopia-migra -e POSTGRES_USER=langopia \
  -e POSTGRES_PASSWORD=langopia -e POSTGRES_DB=langopia -p 55433:5432 postgres:17-alpine
sleep 5
DATABASE_URL=postgres://langopia:langopia@localhost:55433/langopia npx drizzle-kit migrate
```

Esperado: aplica sin errores.

- [x] **Paso 3: Comprobar que las políticas se aplican sobre la migración**

```bash
DATABASE_URL=postgres://langopia:langopia@localhost:55433/langopia npm run db:policies
```

Esperado: `Sin tablas desprotegidas. 41 políticas activas.`

- [x] **Paso 4: Limpiar**

```bash
docker rm -f langopia-migra
```

- [x] **Paso 5: Documentar la separación**

En `README.md`, sustituir la fila de `db:reset` de la tabla de comandos por estas dos:

```markdown
| `npm run db:reset` | Solo desarrollo: `db:push` + políticas + seed |
| `npm run db:deploy` | Producción: `db:migrate` + políticas |
```

Y añadir el script en `packages/db/package.json`:

```json
"db:deploy": "drizzle-kit migrate && tsx src/apply-policies.ts"
```

- [x] **Paso 6: Commit**

```bash
git add packages/db/drizzle packages/db/package.json README.md
git commit -m "chore: migraciones versionadas y separación entre desarrollo y despliegue"
```

---

## Tarea 5: Validar Better Auth sobre NestJS

**Es la tarea de mayor riesgo del plan y va antes de construir nada encima.** De ella dependen los módulos 8 (MCP) y 9 (OAuth). Si Better Auth no encaja, hay que saberlo ahora y no en el mes cuatro.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/infrastructure/auth/better-auth.config.ts`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/auth.controller.ts`
- Crear: `apps/api/src/contexts/iam/iam.module.ts`
- Modificar: `apps/api/src/app.module.ts`
- Modificar: `.env.example`

**Interfaces:**
- Consume: `DrizzleService` de `shared`.
- Produce: `auth` (instancia de Better Auth) con sesiones y proveedor Google; ruta `/api/v1/auth/*`.

- [x] **Paso 1: Instalar**

```bash
cd apps/api
npm install better-auth@^1
```

- [x] **Paso 2: Configurar Better Auth**

```typescript
// apps/api/src/contexts/iam/infrastructure/auth/better-auth.config.ts
import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * Better Auth gestiona SUS propias tablas (`user`, `session`, `account`,
 * `verification`). No se mezclan con nuestro esquema: `users` de Langopia
 * guarda el perfil de la persona, y esta tabla guarda credenciales y sesiones.
 * El puente entre ambas es el correo electrónico.
 */
export function createAuth(connectionString: string) {
  return betterAuth({
    database: new Pool({ connectionString }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export const AUTH = Symbol("Auth");
```

- [x] **Paso 3: Montar el handler bajo Nest**

```typescript
// apps/api/src/contexts/iam/infrastructure/http/auth.controller.ts
import { All, Controller, Inject, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AUTH, type Auth } from "../auth/better-auth.config.js";

/**
 * Adaptador de entrada para Better Auth.
 *
 * Better Auth expone un handler que habla el estándar Fetch API. Nest usa
 * Express, así que hay que traducir en ambos sentidos. Es exactamente el punto
 * que había que validar antes de comprometerse con esta librería.
 */
@Controller("auth")
export class AuthController {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  @All("*path")
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const url = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
    const headers = new Headers();
    for (const [clave, valor] of Object.entries(req.headers)) {
      if (typeof valor === "string") headers.set(clave, valor);
      else if (Array.isArray(valor)) headers.set(clave, valor.join(","));
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const response = await this.auth.handler(request);

    res.status(response.status);
    response.headers.forEach((valor, clave) => res.setHeader(clave, valor));
    res.send(await response.text());
  }
}
```

- [x] **Paso 4: Crear el módulo**

```typescript
// apps/api/src/contexts/iam/iam.module.ts
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AUTH, createAuth } from "./infrastructure/auth/better-auth.config.js";
import { AuthController } from "./infrastructure/http/auth.controller.js";

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("DATABASE_URL");
        if (!url) throw new Error("Falta DATABASE_URL para Better Auth");
        return createAuth(url);
      },
    },
  ],
  exports: [AUTH],
})
export class IamModule {}
```

- [x] **Paso 5: Registrarlo**

En `apps/api/src/app.module.ts`, añadir `IamModule` al array `imports` (después de `SharedModule`) y su import correspondiente:

```typescript
import { IamModule } from "./contexts/iam/iam.module.js";
```

- [x] **Paso 6: Instalar el driver que Better Auth necesita**

```bash
cd apps/api && npm install pg && npm install -D @types/pg
```

- [x] **Paso 7: Crear las tablas de Better Auth**

```bash
cd apps/api
npx @better-auth/cli migrate --config src/contexts/iam/infrastructure/auth/better-auth.config.ts
```

Si el CLI no acepta ese fichero, generar el SQL con `npx @better-auth/cli generate` y aplicarlo con psql.

- [x] **Paso 8: Probar el camino completo**

```bash
npm run build && node dist/main.js &
sleep 6
curl -s -X POST http://localhost:3000/api/v1/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"marta@atlantico.example","password":"contrasena-larga-1","name":"Marta Colomer"}'
```

Esperado: respuesta con el usuario creado y una cookie de sesión.

**Si este paso falla y no se resuelve en media jornada, PARAR.** Es la señal de que Better Auth sobre Nest no es viable, y hay que decidir alternativa (Auth.js con adaptador propio, o servidor OAuth a medida) antes de seguir.

- [x] **Paso 9: Documentar las variables**

En `.env.example`:

```bash
# Better Auth
BETTER_AUTH_SECRET=genera-uno-con-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000/api/v1/auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [x] **Paso 10: Commit**

```bash
git add apps/api/src/contexts/iam .env.example apps/api/package.json apps/api/src/app.module.ts
git commit -m "feat: montar Better Auth sobre NestJS y validar el registro por correo"
```

---

## Tarea 6: Resolver el tenant desde la sesión real

Sustituye el `TenantInterceptor` que hoy confía en cabeceras HTTP —cualquiera puede escribir `x-school-id` y leer otra escuela.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/domain/ports/membership-lookup.port.ts`
- Crear: `apps/api/src/contexts/iam/infrastructure/persistence/drizzle-membership-lookup.repository.ts`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/session-tenant.interceptor.ts`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/session-tenant.spec.ts`
- Borrar: `apps/api/src/contexts/shared/infrastructure/tenant/tenant.interceptor.ts`
- Modificar: `apps/api/src/app.module.ts`

**Interfaces:**
- Consume: `AUTH` (Tarea 5), `MembershipLookupPort`, `ClsService`.
- Produce: `SessionTenantInterceptor`, que rellena `CLS_SCHOOL_ID`, `CLS_MEMBERSHIP_ID` y `CLS_ROLES` a partir de la sesión verificada.

**Nada de SQL en el interceptor.** La consulta vive en un repositorio detrás de `MembershipLookupPort`, como cualquier otro acceso a datos. Un interceptor que sabe escribir `JOIN` es infraestructura de persistencia disfrazada de HTTP.

Esta consulta es **la única excepción legítima a `uow.execute()`**, y conviene entender por qué antes de copiarla: fija el tenant, así que se ejecuta forzosamente *antes* de que haya tenant que fijar. Si fuera dentro del `UnitOfWork`, RLS la dejaría vacía y nadie podría iniciar sesión nunca. Por eso:

- Va en **un solo repositorio**, con un nombre que lo delata (`DrizzleMembershipLookupRepository`), y no se reutiliza para otra cosa.
- Filtra por el correo de la **sesión ya verificada** por Better Auth, nunca por algo que venga del cliente.
- Devuelve solo las membresías de esa persona: no hay forma de pedirle las de otra.
- Está anotada en la deuda de `ARCHITECTURE.md`. Cualquier otra lectura fuera del `UnitOfWork` es un error.

- [x] **Paso 1: Escribir la prueba de la regla de resolución**

```typescript
// apps/api/src/contexts/iam/infrastructure/http/session-tenant.spec.ts
import { describe, expect, it } from "vitest";
import { resolveTenant, type MembershipRow } from "./session-tenant.interceptor.js";

const enAtlantico: MembershipRow = {
  membershipId: "m-atl",
  schoolId: "s-atl",
  schoolSlug: "atlantico",
  role: "owner",
};
const enPaulista: MembershipRow = {
  membershipId: "m-pau",
  schoolId: "s-pau",
  schoolSlug: "paulista",
  role: "teacher",
};

describe("resolveTenant", () => {
  it("con una sola membresía, la elige sin preguntar", () => {
    expect(resolveTenant([enAtlantico], undefined)).toEqual(enAtlantico);
  });

  it("con varias membresías, usa el subdominio pedido", () => {
    expect(resolveTenant([enAtlantico, enPaulista], "paulista")).toEqual(enPaulista);
  });

  it("rechaza un subdominio en el que la persona no tiene membresía", () => {
    expect(() => resolveTenant([enAtlantico], "paulista")).toThrow(/no perteneces/i);
  });

  it("rechaza no elegir cuando hay varias", () => {
    expect(() => resolveTenant([enAtlantico, enPaulista], undefined)).toThrow(/indica la escuela/i);
  });

  it("rechaza a quien no tiene ninguna membresía", () => {
    expect(() => resolveTenant([], undefined)).toThrow(/ninguna escuela/i);
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que falla**

Comando: `npm run test --workspace @langopia/api -- session-tenant`
Esperado: FALLA — el módulo no existe.

- [x] **Paso 3: Implementar el puerto y su repositorio**

```typescript
// apps/api/src/contexts/iam/domain/ports/membership-lookup.port.ts
export type MembershipRow = {
  membershipId: string;
  schoolId: string;
  schoolSlug: string;
  schoolLocale: string | null;
  role: string;
};

export const MEMBERSHIP_LOOKUP = Symbol("MembershipLookupPort");

export interface MembershipLookupPort {
  /**
   * Membresías activas de una persona, en todas sus escuelas.
   *
   * El correo llega de una sesión ya verificada, nunca del cliente. Es la
   * única lectura del sistema que ocurre fuera del `UnitOfWork`, porque es la
   * que averigua QUÉ tenant hay que fijar: dentro de la transacción, RLS la
   * dejaría vacía y no se podría iniciar sesión.
   */
  activeFor(email: string): Promise<MembershipRow[]>;
}
```

```typescript
// apps/api/src/contexts/iam/infrastructure/persistence/drizzle-membership-lookup.repository.ts
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { MembershipLookupPort, MembershipRow } from "../../domain/ports/membership-lookup.port.js";

@Injectable()
export class DrizzleMembershipLookupRepository implements MembershipLookupPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async activeFor(email: string): Promise<MembershipRow[]> {
    const rows = await this.drizzle.connection.execute<MembershipRow>(sql`
      SELECT m.id AS "membershipId", s.id AS "schoolId",
             s.slug AS "schoolSlug", s.locale AS "schoolLocale",
             m.role::text AS role
      FROM memberships m
      JOIN schools s ON s.id = m.school_id
      JOIN users u   ON u.id = m.user_id
      WHERE lower(u.email) = lower(${email})
        AND m.status = 'active'
    `);
    return [...rows];
  }
}
```

- [x] **Paso 3b: Implementar el interceptor**

```typescript
// apps/api/src/contexts/iam/infrastructure/http/session-tenant.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { Observable } from "rxjs";
import type { Request } from "express";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import {
  CLS_MEMBERSHIP_ID,
  CLS_ROLES,
  CLS_SCHOOL_ID,
} from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import {
  MEMBERSHIP_LOOKUP,
  type MembershipLookupPort,
  type MembershipRow,
} from "../../domain/ports/membership-lookup.port.js";
import { AUTH, type Auth } from "../auth/better-auth.config.js";

export type { MembershipRow };

class TenantResolutionError extends DomainError {
  readonly code = "tenant_resolution_failed";
  readonly kind = "forbidden" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

/**
 * Decide en qué escuela actúa esta petición.
 *
 * La lista de membresías sale de la sesión verificada, así que el cliente no
 * puede inventarse una escuela: como mucho puede pedir una a la que YA
 * pertenece. Ese es el cambio esencial respecto del interceptor de cabeceras.
 */
export function resolveTenant(
  memberships: MembershipRow[],
  requestedSlug: string | undefined,
): MembershipRow {
  if (memberships.length === 0) {
    throw new TenantResolutionError("No perteneces a ninguna escuela.");
  }
  if (requestedSlug) {
    const encontrada = memberships.find((m) => m.schoolSlug === requestedSlug);
    if (!encontrada) {
      throw new TenantResolutionError(`No perteneces a la escuela «${requestedSlug}».`, {
        requestedSlug,
      });
    }
    return encontrada;
  }
  if (memberships.length > 1) {
    throw new TenantResolutionError(
      "Perteneces a varias escuelas: indica la escuela en el subdominio o en la cabecera x-school-slug.",
      { schools: memberships.map((m) => m.schoolSlug) },
    );
  }
  return memberships[0]!;
}

@Injectable()
export class SessionTenantInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    @Inject(MEMBERSHIP_LOOKUP) private readonly memberships: MembershipLookupPort,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Las rutas de autenticación no tienen tenant todavía.
    if (request.path.startsWith("/api/v1/auth")) return next.handle();

    const headers = new Headers();
    if (request.headers.cookie) headers.set("cookie", request.headers.cookie);
    const session = await this.auth.api.getSession({ headers });
    if (!session) {
      // Seguir es correcto —hay rutas públicas—, pero no en silencio: sin esta
      // línea, un fallo de cookie se manifiesta como un 403 sin causa visible.
      this.logger.debug({ path: request.path }, "petición sin sesión: no se fija tenant");
      return next.handle();
    }

    const rows = await this.memberships.activeFor(session.user.email);

    const slug = subdomain(request) ?? header(request, "x-school-slug");
    const chosen = resolveTenant([...rows], slug);

    this.cls.set(CLS_SCHOOL_ID, chosen.schoolId);
    this.cls.set(CLS_MEMBERSHIP_ID, chosen.membershipId);
    this.cls.set(
      CLS_ROLES,
      [...rows].filter((m) => m.schoolId === chosen.schoolId).map((m) => m.role),
    );

    return next.handle();
  }
}

function subdomain(request: Request): string | undefined {
  const host = request.get("host")?.split(":")[0] ?? "";
  const parts = host.split(".");
  if (parts.length < 3) return undefined;
  const first = parts[0]!;
  return ["www", "api", "localhost"].includes(first) ? undefined : first;
}

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
```

- [x] **Paso 4: Ejecutar las pruebas**

Comando: `npm run test --workspace @langopia/api -- session-tenant`
Esperado: 5 en verde.

- [x] **Paso 5: Cambiar el interceptor global**

En `apps/api/src/app.module.ts`, sustituir la línea de `TenantInterceptor` por:

```typescript
{ provide: APP_INTERCEPTOR, useClass: SessionTenantInterceptor },
```

Actualizar el import y **borrar** `apps/api/src/contexts/shared/infrastructure/tenant/tenant.interceptor.ts`.

- [x] **Paso 6: Comprobar que el atajo de cabeceras ya no funciona**

```bash
npm run build && node dist/main.js &
sleep 6
curl -s -w " [HTTP %{http_code}]" \
  -H "x-school-id: 11111111-1111-4111-8111-111111111111" \
  "http://localhost:3000/api/v1/scheduling/agenda?from=2026-07-20T00:00:00Z&to=2026-07-27T00:00:00Z"
```

Esperado: **403** con `missing_tenant`. Inventarse una escuela en una cabecera ya no sirve de nada.

- [x] **Paso 7: Commit**

```bash
git add apps/api/src/contexts/iam apps/api/src/app.module.ts
git rm apps/api/src/contexts/shared/infrastructure/tenant/tenant.interceptor.ts
git commit -m "feat: resolver el tenant desde la sesión verificada en lugar de cabeceras"
```

---

## Tarea 7: Guardia de autenticación y de roles

Sin esto, todo endpoint es público.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/infrastructure/http/authenticated.guard.ts`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/roles.decorator.ts`
- Modificar: `apps/api/src/app.module.ts`
- Modificar: `apps/api/src/contexts/scheduling/infrastructure/http/scheduling.controller.ts`

**Interfaces:**
- Consume: `TENANT_CONTEXT`.
- Produce: decoradores `@Roles('owner','admin')` y `@Public()`.

- [x] **Paso 1: Crear los decoradores**

```typescript
// apps/api/src/contexts/iam/infrastructure/http/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "langopia:roles";
export const PUBLIC_KEY = "langopia:public";

/** Restringe el endpoint a los roles indicados dentro de la escuela activa. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Marca el endpoint como accesible sin sesión. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
```

- [x] **Paso 2: Crear el guardia**

```typescript
// apps/api/src/contexts/iam/infrastructure/http/authenticated.guard.ts
import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { PUBLIC_KEY, ROLES_KEY } from "./roles.decorator.js";

class ForbiddenRoleError extends DomainError {
  readonly code = "insufficient_role";
  readonly kind = "forbidden" as const;
  constructor(required: string[], actual: readonly string[]) {
    super(`Esta acción requiere el rol ${required.join(" o ")}.`, { required, actual });
  }
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const esPublico = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) return true;

    // Lanza `missing_tenant` (403) si no hay sesión: es la comprobación de que
    // el interceptor pudo resolver una escuela para esta persona.
    this.tenant.schoolId();

    const requeridos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) return true;

    const actuales = this.tenant.roles();
    if (!requeridos.some((r) => actuales.includes(r))) {
      throw new ForbiddenRoleError(requeridos, actuales);
    }
    return true;
  }
}
```

- [x] **Paso 3: Registrarlo globalmente**

En `apps/api/src/app.module.ts`, añadir a `providers`:

```typescript
{ provide: APP_GUARD, useClass: AuthenticatedGuard },
```

con `import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";`

- [x] **Paso 4: Proteger el contexto de programación**

En `scheduling.controller.ts`, añadir sobre la clase:

```typescript
@Roles("owner", "admin", "teacher")
@Controller("scheduling")
```

y sobre los métodos `schedule`, `cancel` y `reschedule`, que son de gestión:

```typescript
@Roles("owner", "admin")
```

- [x] **Paso 5: Marcar las rutas de autenticación como públicas**

En `auth.controller.ts`, añadir `@Public()` sobre el método `handle`.

- [x] **Paso 6: Verificar**

```bash
npm run build && node dist/main.js &
sleep 6
curl -s -w " [HTTP %{http_code}]" http://localhost:3000/api/v1/scheduling/agenda?from=2026-07-20T00:00:00Z\&to=2026-07-27T00:00:00Z
```

Esperado: **403**, sin sesión.

- [x] **Paso 7: Commit**

```bash
git add apps/api/src/contexts/iam apps/api/src/app.module.ts apps/api/src/contexts/scheduling/infrastructure/http/scheduling.controller.ts
git commit -m "feat: guardia de sesión y de roles por escuela"
```

---

## Tarea 8: Multiidioma de la interfaz

Decidido: multiidioma desde el principio. Meterlo después es un refactor caro.

**Ficheros:**
- Crear: `apps/api/src/contexts/shared/infrastructure/i18n/messages.ts`
- Crear: `apps/api/src/contexts/shared/infrastructure/i18n/locale.resolver.ts`
- Crear: `apps/api/src/contexts/shared/infrastructure/i18n/locale.spec.ts`
- Modificar: `apps/api/src/contexts/shared/infrastructure/http/domain-error.filter.ts`

**Interfaces:**
- Consume: `TenantContext`.
- Produce: `resolveLocale(...)` y `translateError(code, locale, params)`; el filtro de errores devuelve el mensaje en el idioma del solicitante.

**Los mensajes llevan parámetros.** «El profesor ya tiene otra clase» sirve de poco: hay que decir qué profesor y a qué hora. Formato ICU, no concatenación, porque el plural y el género no se resuelven pegando cadenas —y en alemán tampoco el orden—. Los `params` del mensaje son los `details` del error de dominio: se declaran juntos.

**El catálogo debe estar completo.** Hoy el dominio tiene **13 códigos** y aquí solo se traducen 6; los otros siete saldrían en español a un alemán. Y `SUPPORTED_LOCALES` incluye `gl-ES`, que no aparece en ninguna entrada. El paso 4b lo cubre y el 4c lo verifica para siempre.

- [x] **Paso 1: Escribir la prueba**

```typescript
// apps/api/src/contexts/shared/infrastructure/i18n/locale.spec.ts
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES, resolveLocale } from "./locale.resolver.js";
import { translateError } from "./messages.js";

describe("resolveLocale", () => {
  it("prefiere el locale de la persona", () => {
    expect(resolveLocale({ user: "en-GB", school: "es-ES", header: "pt-BR" })).toBe("en-GB");
  });

  it("si la persona no tiene, usa el de la escuela", () => {
    expect(resolveLocale({ user: null, school: "de-DE", header: null })).toBe("de-DE");
  });

  it("si no hay ninguno, negocia con la cabecera del navegador", () => {
    expect(resolveLocale({ user: null, school: null, header: "pt-BR,pt;q=0.9" })).toBe("pt-BR");
  });

  it("cae al español ante un idioma que no soportamos", () => {
    expect(resolveLocale({ user: "sv-SE", school: null, header: null })).toBe("es-ES");
  });

  it("los idiomas soportados incluyen los cuatro del seed", () => {
    expect(SUPPORTED_LOCALES).toEqual(expect.arrayContaining(["es-ES", "en-GB", "de-DE", "pt-BR"]));
  });
});

describe("translateError", () => {
  it("traduce un código conocido", () => {
    const params = { teacherName: "Ana", startsAt: new Date("2026-09-07T10:00:00Z") };
    expect(translateError("teacher_overlap", "en-GB", params)).toMatch(/another class/i);
    expect(translateError("teacher_overlap", "es-ES", params)).toMatch(/otra clase/i);
  });

  it("interpola los parámetros del error", () => {
    const message = translateError("teacher_overlap", "es-ES", {
      teacherName: "Ana",
      startsAt: new Date("2026-09-07T10:00:00Z"),
    });
    expect(message).toContain("Ana");
    expect(message).not.toContain("{");
  });

  it("resuelve el plural según el idioma", () => {
    expect(translateError("pending_reviews", "es-ES", { count: 1 })).toContain("1 valoración");
    expect(translateError("pending_reviews", "es-ES", { count: 3 })).toContain("3 valoraciones");
  });

  it("ante un código desconocido devuelve null y deja el mensaje original", () => {
    expect(translateError("unknown_code", "es-ES")).toBeNull();
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que falla**

Comando: `npm run test --workspace @langopia/api -- locale`
Esperado: FALLA — los módulos no existen.

- [x] **Paso 2b: Instalar el formateador** — `npm i intl-messageformat`

- [x] **Paso 3: Implementar el resolutor**

```typescript
// apps/api/src/contexts/shared/infrastructure/i18n/locale.resolver.ts
export const SUPPORTED_LOCALES = ["es-ES", "en-GB", "de-DE", "pt-BR", "gl-ES"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es-ES";

/**
 * En qué idioma se le habla a esta persona.
 *
 * Tres fuentes, en orden de prioridad: lo que la persona eligió, lo que su
 * escuela usa por defecto, y lo que pide su navegador. Es distinto del idioma
 * que la escuela ENSEÑA, que vive en `courses.language`.
 */
export function resolveLocale(sources: {
  user: string | null | undefined;
  school: string | null | undefined;
  header: string | null | undefined;
}): Locale {
  const candidates = [
    sources.user,
    sources.school,
    ...parseAcceptLanguage(sources.header ?? ""),
  ];
  for (const candidate of candidates) {
    const found = match(candidate);
    if (found) return found;
  }
  return DEFAULT_LOCALE;
}

function match(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  // «pt» debe encontrar «pt-BR»: el idioma pesa más que la región.
  const language = value.split("-")[0]!.toLowerCase();
  return SUPPORTED_LOCALES.find((l) => l.split("-")[0]!.toLowerCase() === language) ?? null;
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag!.trim(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag.length > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}
```

- [x] **Paso 4: Implementar los mensajes**

```typescript
// apps/api/src/contexts/shared/infrastructure/i18n/messages.ts
import IntlMessageFormat from "intl-messageformat";
import { DEFAULT_LOCALE, type Locale } from "./locale.resolver.js";

/**
 * Mensajes de error de cara al usuario.
 *
 * El dominio lanza un `code` estable; la traducción es cosa de esta capa. Un
 * código sin traducción devuelve `null` y el filtro deja el mensaje original
 * en español: preferible a enseñar una clave sin traducir.
 */
export const MESSAGES: Record<string, Partial<Record<Locale, string>>> = {
  teacher_overlap: {
    "es-ES": "El profesor ya tiene otra clase que se solapa con esa franja.",
    "en-GB": "The teacher already has another class overlapping that slot.",
    "de-DE": "Die Lehrkraft hat in diesem Zeitraum bereits einen anderen Unterricht.",
    "pt-BR": "O professor já tem outra aula que se sobrepõe a esse horário.",
  },
  teacher_not_available: {
    "es-ES": "El profesor no tiene disponibilidad declarada en esa franja.",
    "en-GB": "The teacher has no declared availability for that slot.",
    "de-DE": "Für diesen Zeitraum ist keine Verfügbarkeit hinterlegt.",
    "pt-BR": "O professor não tem disponibilidade declarada nesse horário.",
  },
  session_already_closed: {
    "es-ES": "Esta clase ya está cerrada y no admite más cambios.",
    "en-GB": "This class is already closed and cannot be changed.",
    "de-DE": "Dieser Unterricht ist bereits abgeschlossen.",
    "pt-BR": "Esta aula já está encerrada e não aceita alterações.",
  },
  cannot_schedule_in_the_past: {
    "es-ES": "No se puede programar una clase en el pasado.",
    "en-GB": "A class cannot be scheduled in the past.",
    "de-DE": "Unterricht kann nicht in der Vergangenheit geplant werden.",
    "pt-BR": "Não é possível agendar uma aula no passado.",
  },
  not_found: {
    "es-ES": "No existe ese recurso en esta escuela.",
    "en-GB": "That resource does not exist in this school.",
    "de-DE": "Diese Ressource existiert in dieser Schule nicht.",
    "pt-BR": "Esse recurso não existe nesta escola.",
  },
  missing_tenant: {
    "es-ES": "Necesitas iniciar sesión y elegir una escuela.",
    "en-GB": "You need to sign in and choose a school.",
    "de-DE": "Bitte melde dich an und wähle eine Schule.",
    "pt-BR": "Você precisa entrar e escolher uma escola.",
  },
};

/**
 * Mensaje traducido e interpolado.
 *
 * `params` son los `details` del error de dominio. Si el mensaje no lleva
 * marcadores, `params` sobra y no estorba.
 */
export function translateError(
  code: string,
  locale: Locale | string,
  params: Record<string, unknown> = {},
): string | null {
  const byLocale = MESSAGES[code];
  if (!byLocale) return null;

  const pattern = byLocale[locale as Locale] ?? byLocale[DEFAULT_LOCALE];
  if (!pattern) return null;

  return new IntlMessageFormat(pattern, locale).format(params) as string;
}
```

- [x] **Paso 4b: Completar el catálogo**

Los trece códigos que ya existen en el dominio, en los cinco idiomas de `SUPPORTED_LOCALES`. Faltan siete —`concurrency_conflict`, `invalid_cancellation_policy`, `invalid_room`, `invalid_time_slot`, `invalid_uuid`, `missing_actor`, `unknown_room_provider`— y falta `gl-ES` en todos.

Los que aceptan parámetros los declaran en formato ICU:

```typescript
teacher_overlap: {
  "es-ES": "{teacherName} ya tiene otra clase el {startsAt, date, long} a las {startsAt, time, short}.",
  "en-GB": "{teacherName} already has another class on {startsAt, date, long} at {startsAt, time, short}.",
  // …
},
```

- [x] **Paso 4c: Escribir la prueba de cobertura del catálogo**

Es la que impide que esto vuelva a quedarse a medias. Vive fuera de `contexts/` para poder recorrer el código de todos:

```typescript
// apps/api/src/i18n-coverage.spec.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./contexts/shared/infrastructure/i18n/locale.resolver.js";
import { MESSAGES } from "./contexts/shared/infrastructure/i18n/messages.js";

/** Todo `readonly code = "..."` que exista en el dominio. */
function codesInDomain(): string[] {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".ts")) {
        for (const m of readFileSync(path, "utf8").matchAll(/readonly code = "([a-z_]+)"/g)) {
          found.add(m[1]!);
        }
      }
    }
  };
  walk(join(import.meta.dirname, "contexts"));
  return [...found];
}

describe("cobertura del catálogo de errores", () => {
  it("todo error de dominio tiene mensaje", () => {
    const missing = codesInDomain().filter((code) => !MESSAGES[code]);
    expect(missing, `sin traducir: ${missing.join(", ")}`).toEqual([]);
  });

  it("todo mensaje está en todos los idiomas soportados", () => {
    const gaps: string[] = [];
    for (const [code, byLocale] of Object.entries(MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!byLocale[locale]) gaps.push(`${code} → ${locale}`);
      }
    }
    expect(gaps, gaps.join("\n")).toEqual([]);
  });

  it("no sobra ningún mensaje", () => {
    // Un código traducido que ya no lanza nadie es texto muerto que alguien
    // mantendrá creyendo que sirve.
    const codes = new Set(codesInDomain());
    const orphans = Object.keys(MESSAGES).filter((c) => !codes.has(c));
    expect(orphans, `sin uso: ${orphans.join(", ")}`).toEqual([]);
  });
});
```

Añadir un error de dominio sin su traducción deja de compilar el CI. Es la única forma de que un catálogo multiidioma no se degrade solo.

- [x] **Paso 5: Ejecutar las pruebas**

Comando: `npm run test --workspace @langopia/api -- locale i18n-coverage`
Esperado: 10 en verde.

> Nota de ejecución real: son 12 en verde (9 de `locale.spec.ts` + 3 de
> `i18n-coverage.spec.ts`), no 10 — el catálogo final tiene 16 códigos, no 13,
> porque en el momento de implementar ya existían en el árbol de trabajo dos
> códigos más de `iam` (`insufficient_role`, `tenant_resolution_failed`, y
> luego `school_not_operational`/`email_not_verified` aparecieron en vivo por
> el trabajo concurrente). Ver el informe de la tarea para el detalle.

- [x] **Paso 6: Exponer la resolución de idioma a la capa HTTP**

> Hecho: `CLS_LOCALE` añadido a `cls-tenant-context.ts`. `schoolLocale` ya
> viajaba en `memberships_for_email` antes de empezar esta tarea (obra ajena).
> Pendiente, no hecho por la advertencia de concurrencia sobre `contexts/iam/`:
> la llamada a `this.cls.set(CLS_LOCALE, resolveLocale(...))` dentro de
> `SessionTenantGuard`, y el campo `locale` en el usuario de Better Auth (no
> existe todavía). Detalle completo en el informe de la Tarea 8.
>
> Cerrado después por la Tarea 8b: `SessionTenantGuard` fija `CLS_LOCALE` con
> `resolveLocale({ user: null, school, header })` —la fuente «persona» queda
> en `null` a propósito, Better Auth no declara ese campo (comentario en el
> propio guard)— y `AllExceptionsFilter` lo consume, con cobertura en
> `all-exceptions.spec.ts`.

**No se toca `domain-error.filter.ts`:** ese fichero desaparece en la T8b, sustituido por `AllExceptionsFilter`. Traducir aquí sería escribir código para borrarlo dos tareas después.

Lo que sí hace falta es que el idioma esté resuelto y disponible cuando el filtro lo pida. Se guarda en CLS junto al tenant, en el mismo interceptor de la T6:

```typescript
// en SessionTenantInterceptor, tras resolver la membresía
this.cls.set(CLS_LOCALE, resolveLocale({
  user: session.user.locale,
  school: chosen.schoolLocale,
  header: header(request, "accept-language"),
}));
```

Las tres fuentes en su orden de prioridad, que es justo lo que `resolveLocale` implementa. Una petición sin sesión no llega hasta aquí: para esas, el filtro negocia solo con la cabecera.

Añadir `CLS_LOCALE` a `cls-tenant-context.ts` y `schoolLocale` a la consulta de membresías del repositorio.

- [ ] **Paso 7: Verificar de extremo a extremo** (no ejecutable en esta tarea, ver nota)

> `domain-error.filter.ts` sigue sin traducir a propósito (lo dice el propio
> Paso 6: desaparece en la T8b) y `SessionTenantGuard` no fija `CLS_LOCALE`
> (bloqueado por la concurrencia en `iam/`). Con eso, ninguna petición HTTP
> real puede devolver hoy el error traducido: el filtro global sigue
> devolviendo `error.message` tal cual, en español, sea cual sea la cabecera.
> La verificación real que sí se hizo —`resolveLocale`/`translateError`
> invocados directamente con las mismas cabeceras que llevaría la petición,
> más la batería de pruebas— está en el informe de la Tarea 8.

- [x] **Paso 8: Commit**

```bash
git add apps/api/src/contexts/shared/infrastructure/i18n apps/api/src/contexts/shared/infrastructure/http/domain-error.filter.ts
git commit -m "feat: negociación de idioma y errores traducidos"
```

---

## Tarea 8b: Contrato único de errores

Hoy `DomainErrorFilter` solo captura `DomainError`. Un fallo de Postgres, uno de Stripe o un `TypeError` salen con la estructura por defecto de Nest, así que **el cliente recibe dos formatos distintos según lo que se rompa**. Y el `if (status >= 500)` de ese filtro es código muerto —ningún `kind` produce un 500—, de modo que a día de hoy no se registra ni un error.

**Ficheros:**
- Crear: `apps/api/src/contexts/shared/infrastructure/http/problem-details.ts`
- Crear: `apps/api/src/contexts/shared/infrastructure/http/all-exceptions.filter.ts` y su `.spec.ts`
- Borrar: `apps/api/src/contexts/shared/infrastructure/http/domain-error.filter.ts`
- Modificar: `apps/api/src/main.ts`

**Interfaces:**
- Consume: `translateError` y `CLS_LOCALE` (T8), `TenantContext`, el registro de eventos (T8c).
- Produce: `AllExceptionsFilter` registrado con `APP_FILTER`; **una sola forma de error en toda la API**.

**Formato: RFC 9457 (Problem Details).** No es capricho de estándar: es lo que ya entienden los clientes HTTP, y el adaptador MCP se lo pasa a un modelo que tiene que explicárselo a una persona.

```jsonc
{
  "type": "https://langopia.app/errors/teacher_overlap",
  "title": "Ana ya tiene otra clase el 7 de septiembre de 2026 a las 10:00.",
  "status": 409,
  "code": "teacher_overlap",
  "instance": "/api/v1/scheduling/sessions",
  "traceId": "01K2QН7X8Y",
  "params": { "teacherName": "Ana", "startsAt": "2026-09-07T10:00:00Z" },
  "details": { "teacherId": "…", "conflictingSessionId": "…" }
}
```

`title` va **traducido e interpolado** al idioma de quien pregunta (T8). `code` es estable, en inglés y no se traduce nunca: es lo que el cliente compara.

**`params` viaja aparte a propósito.** El panel tiene su propio catálogo y prefiere traducir él —puede enlazar a la pantalla que resuelve el problema, o agrupar los errores de un formulario—, y para eso necesita los valores sin incrustar. Si no conoce el `code` —backend desplegado antes que el panel—, muestra el `title`, que ya viene traducido. El `code` crudo no se enseña nunca.

Y el `title` no sobra aunque el panel traduzca: los correos, las facturas en PDF, las respuestas MCP y los webhooks no tienen frontend que traduzca por ellos.

**Cuatro familias, y ninguna se escapa:**

| Qué llega | Qué sale | Se registra como |
|---|---|---|
| `DomainError` | `status` según `kind`, `code` del error, `title` traducido | `warn` |
| `HttpException` de Nest (incluye `ValidationPipe`) | Su status, `code: "validation_failed"`, más `errors[]` por campo | `warn` |
| Error de Postgres con `code` conocido (`23505`, `23503`, `22P02`) | 409 / 400 con un `code` propio | `error` |
| **Cualquier otra cosa** | 500, `code: "internal_error"`, `title` genérico | `error` con el stack completo |

La cuarta fila es la importante: al cliente se le da un mensaje genérico y el `traceId`; al registro, la excepción entera. Nunca al revés — filtrar un mensaje de Postgres al cliente cuenta de más, y tragárselo cuenta de menos.

**Ningún error sale sin registrar.** El filtro escribe *siempre*, y el nivel lo decide el status: 5xx es `error`, 4xx es `warn`, y un 404 de lectura es `info`. No hay rama que devuelva una respuesta sin haber dejado rastro.

- [x] **Paso 1: Escribir las pruebas del filtro**

Casos mínimos, uno por familia y los dos que hoy fallan:

```typescript
// apps/api/src/contexts/shared/infrastructure/http/all-exceptions.spec.ts
describe("AllExceptionsFilter", () => {
  it("un DomainError sale con su code y el status de su kind", () => { /* … */ });
  it("el título llega traducido al idioma del solicitante", () => { /* … */ });
  it("el título llega interpolado, sin marcadores sueltos", () => {
    // nada de "{teacherName} ya tiene otra clase"
  });
  it("params viaja aparte para que el panel pueda traducir por su cuenta", () => { /* … */ });
  it("un code sin traducción cae al idioma por defecto, no al code crudo", () => { /* … */ });
  it("un error de validación devuelve errors[] por campo", () => { /* … */ });
  it("una violación de unicidad de Postgres es 409, no 500", () => { /* … */ });
  it("un error desconocido NO filtra su mensaje al cliente", () => {
    // el cuerpo trae "internal_error" y el traceId; el mensaje real, solo en el log
  });
  it("un error desconocido SÍ queda registrado entero con su stack", () => { /* … */ });
  it("toda respuesta de error lleva traceId", () => { /* … */ });
});
```

- [x] **Paso 2: Ejecutar y comprobar que fallan** (parcial, ver nota)

> Nota de ejecución real: los tests y la implementación (`problem-details.ts`,
> `all-exceptions.filter.ts`) se escribieron de forma entrelazada, no en rojo
> estricto antes de tocar código de producción — el diseño de las tres clases
> `DomainError` sintéticas para Postgres y el descubrimiento en vivo del bug
> de `IntlMessageFormat` con parámetros no escalares (ver informe) hicieron
> más práctico iterar los dos ficheros a la vez. El resultado sí se verificó
> en rojo→verde de fondo: cada caso se ejecutó y se vio pasar tras su
> implementación correspondiente, y la batería completa pasa al final (10/10).

- [x] **Paso 3: Implementar `problem-details.ts`** — el constructor del cuerpo, con `details` filtrado: solo claves declaradas por el error, nunca el objeto entero
- [x] **Paso 4: Implementar `AllExceptionsFilter` con `@Catch()` sin argumentos**
- [x] **Paso 5: Registrarlo con `APP_FILTER`** en `app.module.ts` y borrar el filtro anterior
- [x] **Paso 6: Verificar de extremo a extremo** — provocar los cuatro tipos con `curl` y comprobar que los cuatro cuerpos tienen la misma forma
- [x] **Paso 7: Commit** — `feat: contrato único de errores con Problem Details`

---

## Tarea 8c: Registro unificado y sin silencios

Hoy cada sitio usa `new Logger(...)` de Nest con su propio criterio, no hay forma de seguir una petición de punta a punta, y nada impide que un `catch` vacío se coma un fallo.

**Ficheros:**
- Crear: `apps/api/src/contexts/shared/infrastructure/logging/logger.module.ts`
- Crear: `apps/api/src/contexts/shared/infrastructure/logging/redact.ts` y su `.spec.ts`
- Modificar: `apps/api/src/main.ts`, `packages/db/src/seed/index.ts`, `apps/api/src/architecture.spec.ts`

**Interfaces:**
- Consume: `ClsService` (ya en uso para el tenant).
- Produce: un logger único para API, trabajos y seed; `traceId` por petición.

**Pino con `nestjs-pino`.** Una línea JSON en producción —que es lo que sabe leer cualquier agregador— y `pino-pretty` en desarrollo, que es cuando lo lees tú:

```
14:32:07.412 INFO  [scheduling] clase programada
                   traceId=01K2Q… school=atlantico sessionId=8f2a… durationMs=34
14:32:09.881 WARN  [billing]    devolución rechazada: fuera de plazo
                   traceId=01K2Q… school=atlantico code=refund_window_closed
```

**Los mismos campos en todos los eventos**, o no sirve para buscar: `time`, `level`, `context`, `msg`, `traceId`, `schoolId`, `membershipId`, `durationMs`.

El `traceId` se genera en el borde y vive en `nestjs-cls`, junto al tenant. Así la línea que escribe el dominio y la que escribe el filtro de errores comparten identificador, y el `traceId` que ve el usuario en la respuesta es el que te lleva al fallo.

**Redacción obligatoria.** Tratas con menores: un correo o una fecha de nacimiento en un log es una brecha de datos con retención de 30 días. Se redactan siempre `email`, `phone`, `dateOfBirth`, `password`, `token`, `cookie`, `authorization` y todo lo que empiece por `stripe`. La prueba de `redact.ts` lo verifica sobre un objeto anidado.

**Prohibido el silencio.** Tres formas de perder un error, y las tres se detectan solas:

| Antipatrón | Qué hacer |
|---|---|
| `catch {}` o `catch { /* ignorar */ }` | Registrar con contexto, aunque se siga adelante |
| `.catch(() => null)` | Idem, o dejar que suba |
| Devolver una respuesta tras un fallo sin registrarlo | Registrar antes de devolver |

Un `catch` que decide continuar es legítimo —a veces seguir es lo correcto—, pero **continuar en silencio no lo es nunca**. Si el fallo no merece una línea de registro, no merece un `try`.

- [x] **Paso 1: Añadir la guardia de silencios** a `architecture.spec.ts`

```typescript
it("ningún catch se traga el error", () => {
  const violations: string[] = [];
  for (const context of contexts()) {
    for (const file of tsFiles(join(CONTEXTS_DIR, context))) {
      const content = readFileSync(file, "utf8");
      // catch vacío, o con solo un comentario dentro
      if (/catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*\s*)*\}/.test(content)) {
        violations.push(`${file}: catch vacío`);
      }
      if (/\.catch\(\s*\(\s*\)\s*=>\s*(null|undefined|\{\s*\})\s*\)/.test(content)) {
        violations.push(`${file}: .catch que descarta el error`);
      }
    }
  }
  expect(violations, violations.join("\n")).toEqual([]);
});
```

- [x] **Paso 2: Ejecutar y comprobar que falla** — el `catch { continue }` de la propia guardia y el `if (!session) return next.handle()` del interceptor de tenant son los dos primeros infractores. El primero se arregla comprobando `ENOENT` en lugar de tragarse todo; el segundo, registrando en `debug` por qué no se resolvió tenant (nota: ambos ya venían arreglados de tareas anteriores — la guardia nueva pasó a la primera, ver informe)
- [x] **Paso 3: Instalar y configurar** — `npm i nestjs-pino pino pino-http && npm i -D pino-pretty`
- [x] **Paso 4: Implementar `redact.ts`** con su prueba sobre objeto anidado
- [x] **Paso 5: Generar el `traceId` en el interceptor de tenant** y guardarlo en CLS
- [x] **Paso 6: Sustituir `new Logger(...)`** por el logger inyectado en todo `apps/api`
- [x] **Paso 7: Usar el mismo formato en el seed y las migraciones** — un despliegue que falla al aplicar políticas debe leerse igual que un fallo en caliente
- [x] **Paso 8: Verificar** — una petición que falla deja una sola línea con su `traceId`, y ese `traceId` es el que devolvió la respuesta
- [x] **Paso 9: Commit** — `feat: registro unificado con traceId y redacción de datos personales`

---

## Tarea 9: Integración continua

Sin CI, las tres guardias anteriores (pruebas, arquitectura, políticas) solo se ejecutan cuando alguien se acuerda.

**Ficheros:**
- Crear: `.github/workflows/ci.yml`

**Interfaces:**
- Consume: los scripts `typecheck`, `test` y `db:policies`.
- Produce: verificación automática en cada push.

- [x] **Paso 1: Escribir el workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: langopia
          POSTGRES_PASSWORD: langopia
          POSTGRES_DB: langopia
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5

    env:
      DATABASE_URL: postgres://langopia:langopia@localhost:5432/langopia
      DATABASE_URL_APP: postgres://langopia_app:cambiame@localhost:5432/langopia

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build --workspace @langopia/db
      - run: npm run typecheck

      - name: Esquema y políticas de aislamiento
        run: |
          npm run db:migrate
          npm run db:policies

      # El seed comprueba el aislamiento entre escuelas y sale con error si falla.
      - name: Seed y verificación de aislamiento
        run: npm run db:seed

      - name: Pruebas
        run: npm run test --workspace @langopia/api

      - run: npm run api:build
```

- [x] **Paso 2: Comprobarlo en local**

```bash
npm ci && npm run build --workspace @langopia/db && npm run typecheck \
  && npm run db:migrate && npm run db:policies && npm run db:seed \
  && npm run test --workspace @langopia/api && npm run api:build
```

Esperado: toda la cadena en verde.

- [x] **Paso 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: integración continua con aislamiento, pruebas y arquitectura"
```

---

---

## Tarea 10: Despliegue a producción

Sin esto no puedes poner un cliente real encima, y el criterio de «listo» de la ola 1 exige una escuela piloto usándolo de verdad.

**Ficheros:**
- Crear: `railway.json`
- Crear: `apps/api/Dockerfile`
- Crear: `docs/RUNBOOK.md`
- Modificar: `.github/workflows/ci.yml` (añadir el trabajo de despliegue)

**Interfaces:**
- Consume: el CI de la Tarea 9.
- Produce: API desplegada con dominio propio; despliegue automático desde `main`.

- [x] **Paso 1: Escribir el Dockerfile**

```dockerfile
# apps/api/Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
RUN npm ci
COPY . .
RUN npm run build --workspace @langopia/db && npm run build --workspace @langopia/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/db/dist packages/db/dist
# Las migraciones y las políticas viajan con la imagen: se aplican al arrancar.
COPY --from=build /app/packages/db/drizzle packages/db/drizzle
COPY packages/db/src/policies.sql packages/db/src/policies.sql
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

- [x] **Paso 2: Añadir el arranque con migraciones**

En `apps/api/package.json`:

```json
"start:prod": "npm run db:deploy --workspace @langopia/db && node dist/main.js"
```

Las migraciones y las políticas se aplican **antes** de aceptar tráfico. Una versión nueva del código contra un esquema viejo es peor que un minuto de indisponibilidad.

- [x] **Paso 3: Crear el rol de aplicación en producción**

La contraseña de `langopia_app` en `policies.sql` es `cambiame` — para desarrollo. En producción:

```sql
ALTER ROLE langopia_app WITH PASSWORD '<secreto del gestor de secretos>';
```

Y en `policies.sql`, cambiar el bloque de creación para que **no** fije contraseña si el rol ya existe (ya lo hace: el `IF NOT EXISTS` lo cubre).

- [x] **Paso 4: Añadir el trabajo de despliegue al CI**

```yaml
  desplegar:
    needs: verificar
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/cli@v3
        with:
          command: up --service api --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

- [x] **Paso 5: Comprobar la sonda de salud**

Añadir en `apps/api/src/contexts/shared/infrastructure/http/health.controller.ts`:

```typescript
import { Controller, Get } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { Public } from "../../../iam/infrastructure/http/roles.decorator.js";
import { DrizzleService } from "../persistence/drizzle.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Comprueba que la base de datos responde, no solo que el proceso vive.
   * Un proceso arriba con la base caída es peor que un proceso caído: el
   * balanceador le sigue mandando tráfico.
   */
  @Public()
  @Get()
  async check() {
    await this.drizzle.connection.execute(sql`SELECT 1`);
    return { status: "ok", at: new Date().toISOString() };
  }
}
```

- [x] **Paso 6: Verificar el despliegue completo**

```bash
curl -s https://api.langopia.app/api/v1/health
```

Esperado: `{"status":"ok",...}`

- [x] **Paso 7: Commit**

```bash
git add apps/api/Dockerfile railway.json .github/workflows/ci.yml apps/api/src/contexts/shared/infrastructure/http/health.controller.ts
git commit -m "chore: despliegue a producción con migraciones al arranque"
```

---

## Tarea 11: Copias de seguridad y monitorización

La pregunta que importa no es si se va a caer, sino si te vas a enterar y si podrás recuperar los datos de una academia.

**Ficheros:**
- Crear: `docs/RUNBOOK.md`
- Modificar: `apps/api/src/main.ts` (registro estructurado)

**Interfaces:**
- Produce: copias verificadas, alertas y un procedimiento escrito de recuperación.

- [x] **Paso 1: Activar copias automáticas del Postgres gestionado**

Diarias, retención 30 días, en la misma región que los datos (UE, por el RGPD).

- [x] **Paso 2: Probar la restauración, que es lo único que demuestra que la copia sirve**

```bash
# Restaurar la copia de ayer en una base de datos temporal
pg_restore -d "$URL_TEMPORAL" copia-de-ayer.dump
psql "$URL_TEMPORAL" -c "SELECT count(*) FROM schools; SELECT count(*) FROM student_profiles;"
```

Esperado: los mismos números que en producción. **Una copia que nunca se ha restaurado no es una copia: es una suposición.**

- [x] **Paso 3: Registro estructurado**

En `main.ts`, sustituir el logger por uno JSON en producción, con `request-id` por petición para poder seguir un error de extremo a extremo.

- [x] **Paso 4: Alertas mínimas**

| Alerta | Umbral | Por qué |
|---|---|---|
| Sonda de salud caída | 2 fallos seguidos | El servicio no responde |
| Errores 5xx | > 1 % en 5 minutos | Algo se rompió al desplegar |
| Latencia p95 | > 2 s en 10 minutos | La base de datos se está ahogando |
| Fallo de cobro en Stripe | cualquiera | Es dinero que no entra |
| Trabajo de purga fallido | cualquiera | Retención de datos incumplida |

- [x] **Paso 5: Escribir el manual de operación**

`docs/RUNBOOK.md` con: cómo desplegar, cómo revertir, cómo restaurar una copia, cómo rotar el secreto de `langopia_app`, y qué hacer ante una sospecha de fuga entre escuelas (el incidente que no admite improvisación).

- [x] **Paso 6: Commit**

```bash
git add docs/RUNBOOK.md apps/api/src/main.ts
git commit -m "chore: copias verificadas, registro estructurado y alertas"
```

---

## Tarea 12: Purga de datos vencidos (RGPD)

`schools.data_retention_days` y `transcripts.retention_until` ya están en el esquema y hoy no los mira nadie. Un dato que debía borrarse y sigue ahí es un incumplimiento, no un descuido.

**Ficheros:**
- Crear: `apps/api/src/contexts/classroom/application/jobs/purge-expired-recordings.job.ts` y su `.spec.ts`

**Interfaces:**
- Produce: trabajo diario que borra grabaciones y transcripciones vencidas.

- [x] **Paso 1: Escribir la prueba**

```typescript
// Casos que debe cubrir:
//  · una transcripción con retention_until en el pasado se borra
//  · una con retention_until futuro se conserva
//  · una sin retention_until (bloqueada por falta de consentimiento) se conserva:
//    no hay nada que borrar, y su registro es la prueba de que no se grabó
//  · el borrado elimina también el fichero de almacenamiento, no solo la fila
//  · el trabajo deja constancia en audit_logs con actor_kind = 'system'
```

- [x] **Paso 2: Ejecutar y comprobar que falla**
- [x] **Paso 3: Implementar el trabajo con `@nestjs/schedule`, diario a las 03:00**
- [x] **Paso 4: Verificar contra el seed** — adelantar `retention_until` de una transcripción y comprobar que desaparece
- [x] **Paso 5: Commit** — `feat: purga diaria de grabaciones y transcripciones vencidas`

## Criterio de «listo» de la ola 0

- [ ] `npm run test --workspace @langopia/api` pasa, con la guardia de arquitectura incluida.
- [ ] `npm run db:seed` termina con «Aislamiento verificado» y código de salida 0.
- [ ] Una petición con `x-school-id` inventado devuelve **403**, no datos.
- [ ] Los errores salen traducidos según `Accept-Language`, **interpolados** y sin marcadores sueltos.
- [ ] Los **13 códigos** de error del dominio tienen mensaje en los **cinco** idiomas, y la prueba de cobertura lo garantiza.
- [ ] **Los cuatro tipos de error** —dominio, validación, Postgres y desconocido— devuelven la **misma estructura**, con `code` y `traceId`.
- [ ] Un error desconocido no filtra su mensaje al cliente, y aun así queda entero en el registro.
- [ ] El `traceId` de una respuesta fallida encuentra la línea del fallo en el registro.
- [ ] La guardia falla si alguien escribe un `catch` vacío o un `.catch(() => null)`.
- [ ] Ningún registro contiene un correo, un teléfono ni una fecha de nacimiento.
- [ ] CI en verde sobre una base de datos limpia, partiendo de migraciones.
- [ ] Better Auth **validado sobre Nest** o decisión alternativa tomada y documentada.
- [ ] API desplegada en producción con dominio propio y sonda de salud verde.
- [ ] Una copia de seguridad **restaurada con éxito**, no solo programada.
- [x] El trabajo de purga borra lo vencido y lo deja registrado en la auditoría.

---

## Autorrevisión

**Cobertura del spec.** Cubiertos: pruebas (T1-T3), migraciones (T4), identidad y OAuth (T5-T7), multiidioma de interfaz (T8), contrato de errores (T8b), registro (T8c), CI (T9). El multiidioma **de datos** (tablas `*_translations`) ya está en el esquema y se ejercita en la ola 1, al construir el catálogo. La validación de Better Auth, que el spec marca como riesgo abierto, es la T5 y va antes que todo lo que dependa de ella.

**Placeholders.** Ninguno: todos los pasos llevan el código o el comando exacto. La única bifurcación abierta es deliberada —el paso 8 de la T5 dice qué hacer si Better Auth no encaja, porque esa decisión no se puede tomar por adelantado.

**Consistencia de tipos.** `MembershipRow` se define en el puerto de T6 y lo consumen su repositorio y su interceptor. `Locale`, `resolveLocale` y `translateError` se definen en T8 y los consume el filtro de T8b. `SessionStatus`, `CancelingParty` y `RoomProvider` se definen en T2 paso 0, se usan en las pruebas de T2 y los verifica contra Postgres la prueba de T3 paso 1b. `CLS_SCHOOL_ID`, `CLS_MEMBERSHIP_ID` y `CLS_ROLES` son los que ya exporta `cls-tenant-context.ts`; el `traceId` de T8c se guarda junto a ellos. `Roles` y `Public` se definen en T7 y se aplican en T7. Sin discrepancias.

**Orden forzoso.** T8 antes que T8b: el filtro traduce con `translateError`. T8b antes que T8c solo por comodidad —el filtro es quien más registra—, pero son independientes. T2 paso 0 antes que T3 paso 1b: no se puede comparar con la base de datos un conjunto que aún no existe.
