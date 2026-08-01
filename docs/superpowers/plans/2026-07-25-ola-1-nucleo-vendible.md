# Ola 1 — Núcleo vendible · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que una academia sustituya su hoja de cálculo y su carpeta de facturas, y pague por ello.

**Arquitectura:** cuatro contextos nuevos (`people`, `catalog`, `classroom`, `billing` completo) siguiendo el patrón de `scheduling`: dominio puro, aplicación CQRS, infraestructura con persistencia, HTTP, capa anticorrupción y servicios externos.

**Stack:** el de la ola 0, más Stripe (Billing + Connect) y LiveKit.

**Requisito previo:** la ola 0 debe estar terminada. Este plan asume sesión real, guardias de rol, i18n y CI en verde.

## Restricciones globales

Las mismas de la ola 0, más:

- **Ningún importe se calcula en el controlador.** Los euros son céntimos enteros; nada de coma flotante.
- La comisión de plataforma se **congela** en la factura al emitirla. Cambiar `application_fee_bps` de la escuela no altera el histórico.
- Un menor no puede firmar su propio consentimiento. Lo comprueba el dominio, no la interfaz.
- Antes de grabar o transcribir, **todos** los participantes deben tener consentimiento. Si falta uno, no se graba la clase entera.
- Stripe: importes en la moneda de la escuela; los identificadores externos siempre se guardan (`stripe_*_id`).

## Estado de partida: el módulo 3 ya está construido

**No lo rehagas.** Tu módulo 3 —calendario, alta, replanificación y cancelación de clases— está implementado, desplegado y verificado contra Postgres. Aparece aquí como tarea 0 con las casillas marcadas para que el plan documente el estado real y nadie duplique el trabajo.

Sirve además de **plantilla**: es el contexto completo de referencia, de dominio a HTTP. Cuando una tarea de este plan diga «sigue el patrón de `scheduling`», se refiere a esto.

---

### Tarea 0: `scheduling` — clases y calendario ✅ COMPLETADA

**Ficheros:** 28 en `apps/api/src/contexts/scheduling/`

**Interfaces que produce, y que las demás tareas consumen:**
- `ClassSession` con `schedule()`, `cancel()`, `rescheduleTo()`, `start()`, `complete()`
- `TimeSlot`, `Room`, `Cancellation`, `CancellationPolicy`
- `SessionId`, `GroupId`, `TeacherId`, `StudentId`
- Eventos: `ClassSessionScheduled`, `ClassSessionCanceled`, `ClassSessionRescheduled`, `ClassSessionCompleted`
- Puertos: `ClassSessionRepository`, `TeacherAvailabilityPort`, `SchoolSchedulingPolicyPort`
- `SchedulingReadModel` con `agendaBetween()` y `teacherOccupancyBetween()`

- [x] **Dominio** — agregado con su máquina de estados, objetos de valor y política de cancelación
- [x] **Aplicación** — 3 comandos (programar, cancelar, replanificar) y 2 consultas (agenda, ocupación)
- [x] **Infraestructura** — repositorio Drizzle con mapeador, modelo de lectura, 2 adaptadores anticorrupción, controlador con 5 endpoints
- [x] **Verificado contra Postgres real**

**Reglas de negocio que ya se cumplen** (no volver a implementarlas):

| Regla | Comprobado |
|---|---|
| El alumno tiene devolución si avisa con ≥ 24 h | `refundDue: true`, 69,62 h de antelación |
| El alumno NO la tiene si avisa tarde | `refundDue: false`, 2,62 h |
| La escuela cancela → **siempre** hay devolución | `refundDue: true` con 2,62 h |
| Una clase no se cancela dos veces | HTTP 409 `session_already_closed` |
| No se programa en el pasado | HTTP 409 `cannot_schedule_in_the_past` |
| Una clase dura entre 15 y 240 minutos | HTTP 400 en el DTO |
| Zoom, Meet y Teams exigen ID de reunión | HTTP 400 `invalid_room` |
| Una clase de otra escuela no existe | HTTP 404, aunque se pase su UUID |
| El motivo de cancelación tiene ≥ 3 caracteres | HTTP 400 en el DTO |

**La distinción entre 400 y 409 importa** y conviene tenerla clara antes de
escribir pruebas: un **400** viene del DTO —la forma del dato es inválida y la
petición no llega al dominio— y un **409** viene del agregado —el dato es
válido pero rompe una regla de negocio—. Una prueba que envía un motivo de un
carácter esperando el 409 de «ya está cancelada» recibirá un 400 de validación
y parecerá que la regla no funciona.

**Cómo verificar que sigue funcionando** antes de construir encima:

```bash
npm run db:reset && npm run api:dev
# En otra terminal, con el rango de la semana en curso:
curl -s -H "x-school-id: $ATL" -H "x-membership-id: $MARTA" \
  "http://localhost:3000/api/v1/scheduling/teacher-occupancy?from=$LUNES&to=$LUNES_SIGUIENTE"
```

Debe devolver la ocupación del profesorado del seed: Carla 92 %, Dan 83 %, Sofia 75 %, Yuki 46 %, Marc 38 % —los mismos números del mockup del panel.

**Lo que sí queda pendiente de este contexto**, y está en este plan:
- La **asistencia** es la tarea 5: es su propio agregado, no parte de `ClassSession`.
- La **creación de la sala** en cada proveedor es la tarea 6, en el contexto `classroom`.
- Las **pantallas** del calendario son la tarea 9 del plan del panel web.

---

## Orden y por qué

`people` → `catalog` → asistencia → `classroom` → `billing` → portales.

No es arbitrario: no hay grupos sin alumnos, ni asistencia sin grupos, ni facturas sin matrículas. `billing` va al final porque es el que más depende de todo lo anterior y el que más se beneficia de que el resto ya esté asentado.

---

## Tarea 1: Contexto `people` — el alumno y la minoría de edad

La regla de negocio más delicada de la ola: un menor necesita tutor, y su consentimiento lo firma otra persona.

**Ficheros:**
- Crear: `apps/api/src/contexts/people/domain/model/student.aggregate.ts`
- Crear: `apps/api/src/contexts/people/domain/model/date-of-birth.vo.ts`
- Crear: `apps/api/src/contexts/people/domain/model/consent.vo.ts`
- Crear: `apps/api/src/contexts/people/domain/model/identifiers.ts`
- Crear: `apps/api/src/contexts/people/domain/errors/people.errors.ts`
- Crear: `apps/api/src/contexts/people/domain/events/student.events.ts`
- Crear: `apps/api/src/contexts/people/domain/model/student.spec.ts`

**Interfaces:**
- Consume: `AggregateRoot`, `Uuid`, `SchoolId`, `MembershipId`, `Clock` (de `shared`).
- Produce: `Student` con `enrol()`, `addGuardian()`, `grantConsent()`, `pause()`, `leave()`; `StudentId`, `GuardianId`; eventos `StudentEnrolled`, `StudentLeft`, `ConsentGranted`, `ConsentDenied`.

- [x] **Paso 1: Escribir las pruebas del objeto de valor de la fecha de nacimiento**

```typescript
// apps/api/src/contexts/people/domain/model/date-of-birth.spec.ts
import { describe, expect, it } from "vitest";
import { DateOfBirth } from "./date-of-birth.vo.js";

const HOY = new Date("2026-07-25T12:00:00Z");

describe("DateOfBirth", () => {
  it("calcula la edad", () => {
    expect(DateOfBirth.of("2000-01-15").ageAt(HOY)).toBe(26);
  });

  it("no suma el año si aún no ha cumplido", () => {
    expect(DateOfBirth.of("2000-12-15").ageAt(HOY)).toBe(25);
  });

  it("considera menor a quien tiene 17", () => {
    expect(DateOfBirth.of("2009-01-01").isMinorAt(HOY)).toBe(true);
  });

  it("considera adulto a quien cumple 18 hoy", () => {
    expect(DateOfBirth.of("2008-07-25").isMinorAt(HOY)).toBe(false);
  });

  it("rechaza una fecha futura", () => {
    expect(() => DateOfBirth.of("2030-01-01").ageAt(HOY)).toThrow(/futuro/);
  });

  it("rechaza una edad imposible", () => {
    expect(() => DateOfBirth.of("1850-01-01").ageAt(HOY)).toThrow(/no es plausible/);
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que falla**

Comando: `npm run test --workspace @langopia/api -- date-of-birth`
Esperado: FALLA — el módulo no existe.

- [x] **Paso 3: Implementar**

```typescript
// apps/api/src/contexts/people/domain/model/date-of-birth.vo.ts
import { SingleValueObject } from "../../../shared/domain/primitives/value-object.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

class InvalidDateOfBirthError extends DomainError {
  readonly code = "invalid_date_of_birth";
  readonly kind = "invalid_input" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export const MAJORITY_AGE = 18;

/**
 * Fecha de nacimiento.
 *
 * La minoría de edad NO se guarda: se calcula. Guardarla como booleano
 * significaría que un alumno sigue siendo menor el día después de cumplir 18,
 * hasta que alguien se acuerde de actualizar la fila.
 */
export class DateOfBirth extends SingleValueObject<string> {
  private constructor(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new InvalidDateOfBirthError("La fecha de nacimiento debe tener formato AAAA-MM-DD.", {
        value,
      });
    }
    super(value);
  }

  static of(value: string): DateOfBirth {
    return new DateOfBirth(value);
  }

  ageAt(instant: Date): number {
    const nacimiento = new Date(`${this.value}T00:00:00Z`);
    if (nacimiento > instant) {
      throw new InvalidDateOfBirthError("La fecha de nacimiento está en el futuro.", {
        value: this.value,
      });
    }
    let edad = instant.getUTCFullYear() - nacimiento.getUTCFullYear();
    const mes = instant.getUTCMonth() - nacimiento.getUTCMonth();
    if (mes < 0 || (mes === 0 && instant.getUTCDate() < nacimiento.getUTCDate())) edad--;
    if (edad > 120) {
      throw new InvalidDateOfBirthError("Esa edad no es plausible: revisa la fecha.", {
        value: this.value,
        edad,
      });
    }
    return edad;
  }

  isMinorAt(instant: Date): boolean {
    return this.ageAt(instant) < MAJORITY_AGE;
  }
}
```

- [x] **Paso 4: Ejecutar**

Comando: `npm run test --workspace @langopia/api -- date-of-birth`
Esperado: 6 en verde.

- [x] **Paso 5: Escribir las pruebas del agregado**

```typescript
// apps/api/src/contexts/people/domain/model/student.spec.ts
import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "./date-of-birth.vo.js";
import { GuardianId, StudentId } from "./identifiers.js";
import { Student } from "./student.aggregate.js";

const AHORA = new Date("2026-07-25T12:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const MIEMBRO = MembershipId.of("22222222-2222-4222-8222-222222222222");
const TUTOR = MembershipId.of("33333333-3333-4333-8333-333333333333");

function alumno(edad: number) {
  const anio = 2026 - edad;
  return Student.enrol({
    id: StudentId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    membershipId: MIEMBRO,
    dateOfBirth: DateOfBirth.of(`${anio}-01-01`),
    nativeLanguage: "es",
    targetLanguage: "en",
    now: AHORA,
  });
}

describe("Student", () => {
  it("un adulto puede firmar su propio consentimiento", () => {
    const a = alumno(30);
    a.grantConsent({ kind: "recording", grantedBy: MIEMBRO, now: AHORA });
    expect(a.hasConsent("recording")).toBe(true);
  });

  it("un menor NO puede firmar su propio consentimiento", () => {
    const a = alumno(12);
    a.addGuardian({ id: GuardianId.of("55555555-5555-4555-8555-555555555555"), membershipId: TUTOR, relationship: "mother", canGiveConsent: true });
    expect(() => a.grantConsent({ kind: "recording", grantedBy: MIEMBRO, now: AHORA })).toThrow(
      /tutor legal/i,
    );
  });

  it("el consentimiento de un menor lo firma su tutor", () => {
    const a = alumno(12);
    a.addGuardian({ id: GuardianId.of("55555555-5555-4555-8555-555555555555"), membershipId: TUTOR, relationship: "mother", canGiveConsent: true });
    a.grantConsent({ kind: "recording", grantedBy: TUTOR, now: AHORA });
    expect(a.hasConsent("recording")).toBe(true);
  });

  it("un menor sin tutor no puede tener consentimientos", () => {
    const a = alumno(12);
    expect(() => a.grantConsent({ kind: "recording", grantedBy: TUTOR, now: AHORA })).toThrow(
      /no consta como tutor/i,
    );
  });

  it("retirar el consentimiento lo deja sin efecto", () => {
    const a = alumno(30);
    a.grantConsent({ kind: "recording", grantedBy: MIEMBRO, now: AHORA });
    a.withdrawConsent({ kind: "recording", now: AHORA });
    expect(a.hasConsent("recording")).toBe(false);
  });

  it("dar de baja registra el motivo y emite el evento", () => {
    const a = alumno(30);
    a.pullDomainEvents();
    a.leave({ reason: "Cambio de horario laboral", now: AHORA });
    expect(a.status).toBe("left");
    expect(a.pullDomainEvents()[0]!.eventName).toBe("people.student.left");
  });

  it("no se puede dar de baja dos veces", () => {
    const a = alumno(30);
    a.leave({ reason: "x", now: AHORA });
    expect(() => a.leave({ reason: "y", now: AHORA })).toThrow(/ya está de baja/i);
  });

  it("un alumno pausado puede reactivarse", () => {
    const a = alumno(30);
    a.pause({ until: new Date("2026-09-01T00:00:00Z"), now: AHORA });
    expect(a.status).toBe("paused");
    a.resume({ now: AHORA });
    expect(a.status).toBe("active");
  });

  it("marca que necesita tutor si es menor", () => {
    expect(alumno(12).guardianRequired).toBe(true);
    expect(alumno(30).guardianRequired).toBe(false);
  });
});
```

- [x] **Paso 6: Ejecutar y comprobar que falla**

Comando: `npm run test --workspace @langopia/api -- student`
Esperado: FALLA.

- [x] **Paso 7: Implementar los identificadores y errores**

```typescript
// apps/api/src/contexts/people/domain/model/identifiers.ts
import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class StudentId extends Uuid {
  private constructor(v: string) { super(v, "alumno"); }
  static of(v: string): StudentId { return new StudentId(v); }
}

export class TeacherId extends Uuid {
  private constructor(v: string) { super(v, "profesor"); }
  static of(v: string): TeacherId { return new TeacherId(v); }
}

export class GuardianId extends Uuid {
  private constructor(v: string) { super(v, "tutor"); }
  static of(v: string): GuardianId { return new GuardianId(v); }
}
```

```typescript
// apps/api/src/contexts/people/domain/errors/people.errors.ts
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class MinorCannotSelfConsentError extends DomainError {
  readonly code = "minor_cannot_self_consent";
  readonly kind = "invariant_violation" as const;
  constructor(studentId: string) {
    super(
      "Un alumno menor de edad no puede firmar su propio consentimiento: debe hacerlo su tutor legal.",
      { studentId },
    );
  }
}

export class NotAGuardianError extends DomainError {
  readonly code = "not_a_guardian";
  readonly kind = "forbidden" as const;
  constructor(membershipId: string, studentId: string) {
    super("Quien firma no consta como tutor legal de este alumno.", { membershipId, studentId });
  }
}

export class StudentAlreadyLeftError extends DomainError {
  readonly code = "student_already_left";
  readonly kind = "invariant_violation" as const;
  constructor(studentId: string) {
    super("Este alumno ya está de baja.", { studentId });
  }
}
```

- [x] **Paso 8: Implementar el agregado**

```typescript
// apps/api/src/contexts/people/domain/model/student.aggregate.ts
import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  MinorCannotSelfConsentError,
  NotAGuardianError,
  StudentAlreadyLeftError,
} from "../errors/people.errors.js";
import { ConsentGranted, StudentEnrolled, StudentLeft } from "../events/student.events.js";
import type { DateOfBirth } from "./date-of-birth.vo.js";
import { GuardianId, StudentId } from "./identifiers.js";

export const CONSENT_KINDS = [
  "data_processing",
  "recording",
  "transcription",
  "ai_processing",
  "marketing",
  "image_rights",
] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export type StudentStatus = "active" | "paused" | "left";

export type Guardian = {
  id: GuardianId;
  membershipId: MembershipId;
  relationship: "mother" | "father" | "legal_guardian" | "other";
  canGiveConsent: boolean;
};

type ConsentState = { granted: boolean; grantedBy: MembershipId | null; at: Date | null };

/**
 * Alumno.
 *
 * Concentra la regla que el producto no puede permitirse fallar: quién puede
 * consentir qué. Está aquí y no en el formulario porque la misma pregunta
 * llega desde el panel, desde el portal del alumno y desde el módulo de
 * grabación.
 */
export class Student extends AggregateRoot<StudentId> {
  private constructor(
    id: StudentId,
    private readonly _schoolId: SchoolId,
    private readonly _membershipId: MembershipId,
    private readonly _dateOfBirth: DateOfBirth,
    private _status: StudentStatus,
    private readonly _guardians: Guardian[],
    private readonly _consents: Map<ConsentKind, ConsentState>,
    private _pausedUntil: Date | null,
    private _leftReason: string | null,
    readonly nativeLanguage: string,
    readonly targetLanguage: string,
    private readonly _now: Date,
  ) {
    super(id);
  }

  static enrol(params: {
    id: StudentId;
    schoolId: SchoolId;
    membershipId: MembershipId;
    dateOfBirth: DateOfBirth;
    nativeLanguage: string;
    targetLanguage: string;
    now: Date;
  }): Student {
    const student = new Student(
      params.id,
      params.schoolId,
      params.membershipId,
      params.dateOfBirth,
      "active",
      [],
      new Map(),
      null,
      null,
      params.nativeLanguage,
      params.targetLanguage,
      params.now,
    );
    student.record(
      new StudentEnrolled({
        studentId: params.id.value,
        schoolId: params.schoolId.value,
        isMinor: params.dateOfBirth.isMinorAt(params.now),
      }),
    );
    return student;
  }

  get guardianRequired(): boolean {
    return this._dateOfBirth.isMinorAt(this._now);
  }

  get status(): StudentStatus {
    return this._status;
  }

  get guardians(): readonly Guardian[] {
    return this._guardians;
  }

  addGuardian(guardian: Guardian): void {
    if (this._guardians.some((g) => g.membershipId.equals(guardian.membershipId))) return;
    this._guardians.push(guardian);
  }

  /**
   * Otorga un consentimiento.
   *
   * Si el alumno es menor, quien firma tiene que ser un tutor con
   * `canGiveConsent`. Que el propio menor firme es la vía por la que una
   * escuela acabaría grabando a un niño sin permiso de su familia.
   */
  grantConsent(params: { kind: ConsentKind; grantedBy: MembershipId; now: Date }): void {
    if (this.guardianRequired) {
      if (params.grantedBy.equals(this._membershipId)) {
        throw new MinorCannotSelfConsentError(this.id.value);
      }
      const tutor = this._guardians.find(
        (g) => g.membershipId.equals(params.grantedBy) && g.canGiveConsent,
      );
      if (!tutor) throw new NotAGuardianError(params.grantedBy.value, this.id.value);
    }

    this._consents.set(params.kind, {
      granted: true,
      grantedBy: params.grantedBy,
      at: params.now,
    });
    this.record(
      new ConsentGranted({
        studentId: this.id.value,
        schoolId: this._schoolId.value,
        kind: params.kind,
        grantedByMembershipId: params.grantedBy.value,
      }),
    );
  }

  withdrawConsent(params: { kind: ConsentKind; now: Date }): void {
    this._consents.set(params.kind, { granted: false, grantedBy: null, at: params.now });
  }

  hasConsent(kind: ConsentKind): boolean {
    return this._consents.get(kind)?.granted ?? false;
  }

  pause(params: { until: Date; now: Date }): void {
    this.assertNotLeft();
    this._status = "paused";
    this._pausedUntil = params.until;
  }

  resume(_params: { now: Date }): void {
    this.assertNotLeft();
    this._status = "active";
    this._pausedUntil = null;
  }

  leave(params: { reason: string; now: Date }): void {
    this.assertNotLeft();
    this._status = "left";
    this._leftReason = params.reason;
    this.record(
      new StudentLeft({
        studentId: this.id.value,
        schoolId: this._schoolId.value,
        reason: params.reason,
      }),
    );
  }

  private assertNotLeft(): void {
    if (this._status === "left") throw new StudentAlreadyLeftError(this.id.value);
  }

  get pausedUntil(): Date | null {
    return this._pausedUntil;
  }
  get leftReason(): string | null {
    return this._leftReason;
  }
  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get membershipId(): MembershipId {
    return this._membershipId;
  }
  get dateOfBirth(): DateOfBirth {
    return this._dateOfBirth;
  }
}
```

- [x] **Paso 9: Implementar los eventos**

```typescript
// apps/api/src/contexts/people/domain/events/student.events.ts
import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

export class StudentEnrolled extends DomainEvent {
  readonly eventName = "people.student.enrolled";
  constructor(private readonly data: { studentId: string; schoolId: string; isMinor: boolean }) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return { studentId: this.data.studentId, isMinor: this.data.isMinor };
  }
}

export class StudentLeft extends DomainEvent {
  readonly eventName = "people.student.left";
  constructor(private readonly data: { studentId: string; schoolId: string; reason: string }) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return { studentId: this.data.studentId, reason: this.data.reason };
  }
}

export class ConsentGranted extends DomainEvent {
  readonly eventName = "people.consent.granted";
  constructor(
    private readonly data: {
      studentId: string;
      schoolId: string;
      kind: string;
      grantedByMembershipId: string;
    },
  ) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return {
      studentId: this.data.studentId,
      kind: this.data.kind,
      grantedByMembershipId: this.data.grantedByMembershipId,
    };
  }
}
```

- [x] **Paso 10: Ejecutar**

Comando: `npm run test --workspace @langopia/api -- student`
Esperado: 9 en verde.

- [x] **Paso 11: Commit**

```bash
git add apps/api/src/contexts/people
git commit -m "feat(people): agregado Student con tutores legales y consentimientos"
```

---

## Tarea 2: `people` — persistencia, comandos y endpoints

Convierte el dominio de la tarea anterior en algo que la escuela pueda usar.

**Ficheros:**
- Crear: `apps/api/src/contexts/people/domain/ports/student.repository.port.ts`
- Crear: `apps/api/src/contexts/people/application/commands/enrol-student/` (comando + manejador)
- Crear: `apps/api/src/contexts/people/application/commands/leave-student/` (comando + manejador)
- Crear: `apps/api/src/contexts/people/application/commands/grant-consent/` (comando + manejador)
- Crear: `apps/api/src/contexts/people/application/ports/people-read-model.port.ts`
- Crear: `apps/api/src/contexts/people/application/queries/list-students/list-students.handler.ts`
- Crear: `apps/api/src/contexts/people/infrastructure/persistence/student.mapper.ts`
- Crear: `apps/api/src/contexts/people/infrastructure/persistence/drizzle-student.repository.ts`
- Crear: `apps/api/src/contexts/people/infrastructure/persistence/drizzle-people-read-model.ts`
- Crear: `apps/api/src/contexts/people/infrastructure/http/students.controller.ts`
- Crear: `apps/api/src/contexts/people/infrastructure/http/dto/students.dto.ts`
- Crear: `apps/api/src/contexts/people/people.module.ts`
- Modificar: `apps/api/src/app.module.ts`

**Interfaces:**
- Consume: `Student`, `StudentId`, `DateOfBirth` (Tarea 1); `UnitOfWork`, `EventPublisher`, `TenantContext`, `Clock`, `IdGenerator` (`shared`).
- Produce: `POST /api/v1/students`, `POST /api/v1/students/:id/leave`, `POST /api/v1/students/:id/consents`, `GET /api/v1/students`.

- [x] **Paso 1: Declarar el puerto del repositorio**

```typescript
// apps/api/src/contexts/people/domain/ports/student.repository.port.ts
import type { Student } from "../model/student.aggregate.js";
import type { StudentId } from "../model/identifiers.js";

export interface StudentRepository {
  find(id: StudentId): Promise<Student | null>;
  findOrFail(id: StudentId): Promise<Student>;
  save(student: Student): Promise<void>;
  /** Alumnos activos de la escuela. Para comprobar el límite del plan. */
  countActive(): Promise<number>;
}

export const STUDENT_REPOSITORY = Symbol("StudentRepository");
```

- [x] **Paso 2: Escribir el comando de alta**

```typescript
// apps/api/src/contexts/people/application/commands/enrol-student/enrol-student.command.ts
import { Command } from "@nestjs/cqrs";

export class EnrolStudentCommand extends Command<{ studentId: string; guardianRequired: boolean }> {
  constructor(
    readonly props: {
      name: string;
      email: string;
      dateOfBirth: string;
      nativeLanguage: string;
      targetLanguage: string;
      locale?: string | null;
      currentLevel?: string | null;
      guardian?: {
        name: string;
        email: string;
        relationship: "mother" | "father" | "legal_guardian" | "other";
      } | null;
    },
  ) {
    super();
  }
}
```

- [x] **Paso 3: Implementar el manejador**

```typescript
// apps/api/src/contexts/people/application/commands/enrol-student/enrol-student.handler.ts
import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "../../../domain/model/date-of-birth.vo.js";
import { GuardianId, StudentId } from "../../../domain/model/identifiers.js";
import { Student } from "../../../domain/model/student.aggregate.js";
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from "../../../domain/ports/student.repository.port.js";
import {
  MEMBERSHIP_PROVISIONING_PORT,
  type MembershipProvisioningPort,
} from "../../../domain/ports/membership-provisioning.port.js";
import { EnrolStudentCommand } from "./enrol-student.command.js";

class GuardianRequiredError extends DomainError {
  readonly code = "guardian_required";
  readonly kind = "invariant_violation" as const;
  constructor() {
    super("Un alumno menor de edad necesita al menos un tutor legal para darse de alta.");
  }
}

@CommandHandler(EnrolStudentCommand)
export class EnrolStudentHandler implements ICommandHandler<EnrolStudentCommand> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(MEMBERSHIP_PROVISIONING_PORT) private readonly members: MembershipProvisioningPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: EnrolStudentCommand) {
    const { props } = command;
    const now = this.clock.now();
    const dateOfBirth = DateOfBirth.of(props.dateOfBirth);
    const esMenor = dateOfBirth.isMinorAt(now);

    if (esMenor && !props.guardian) throw new GuardianRequiredError();

    const student = await this.uow.execute(async () => {
      const membershipId = await this.members.provisionStudent({
        name: props.name,
        email: props.email,
        locale: props.locale ?? null,
      });

      const creado = Student.enrol({
        id: StudentId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        membershipId: MembershipId.of(membershipId),
        dateOfBirth,
        nativeLanguage: props.nativeLanguage,
        targetLanguage: props.targetLanguage,
        now,
      });

      if (props.guardian) {
        const guardianMembershipId = await this.members.provisionGuardian({
          name: props.guardian.name,
          email: props.guardian.email,
          locale: props.locale ?? null,
        });
        creado.addGuardian({
          id: GuardianId.of(this.ids.generate()),
          membershipId: MembershipId.of(guardianMembershipId),
          relationship: props.guardian.relationship,
          canGiveConsent: true,
        });
      }

      await this.students.save(creado);
      return creado;
    });

    await this.events.publish(student.pullDomainEvents());
    return { studentId: student.id.value, guardianRequired: student.guardianRequired };
  }
}
```

- [x] **Paso 4: Declarar el puerto de aprovisionamiento de membresías**

Es la capa anticorrupción hacia `iam`: `people` no crea usuarios, los pide.

```typescript
// apps/api/src/contexts/people/domain/ports/membership-provisioning.port.ts
/**
 * Lo que `people` necesita de `iam`, y nada más.
 *
 * Crear un usuario global y su membresía es competencia de identidad. Aquí
 * solo se pide «dame el id de membresía de esta persona en esta escuela, y
 * créala si hace falta».
 */
export interface MembershipProvisioningPort {
  provisionStudent(params: {
    name: string;
    email: string;
    locale: string | null;
  }): Promise<string>;

  provisionGuardian(params: {
    name: string;
    email: string;
    locale: string | null;
  }): Promise<string>;
}

export const MEMBERSHIP_PROVISIONING_PORT = Symbol("MembershipProvisioningPort");
```

- [x] **Paso 5: Implementar el adaptador anticorrupción**

El adaptador **no escribe SQL**: delega en el repositorio de membresías, que es quien conoce las tablas. Y no abre transacción propia — se ejecuta dentro del `uow.execute()` del manejador que lo llamó, para que el alta del alumno y su membresía se confirmen o se deshagan juntas.

Los dos roles que este puerto puede aprovisionar son un conjunto cerrado, así que se declaran una vez:

```typescript
// apps/api/src/contexts/people/domain/ports/membership-provisioning.port.ts
export const ProvisionedRole = {
  Student: "student",
  Guardian: "guardian",
} as const;

export type ProvisionedRole = (typeof ProvisionedRole)[keyof typeof ProvisionedRole];
```

Es un subconjunto de `membershipRole` a propósito: por aquí no se crea un `owner` ni un `admin`. La prueba de coherencia de la ola 0 comprueba que ambos valores existen en la columna.

```typescript
// apps/api/src/contexts/people/infrastructure/acl/iam-membership-provisioning.adapter.ts
import { Inject, Injectable } from "@nestjs/common";
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepository,
} from "../persistence/membership.repository.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import type { MembershipProvisioningPort } from "../../domain/ports/membership-provisioning.port.js";

@Injectable()
export class IamMembershipProvisioningAdapter implements MembershipProvisioningPort {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  provisionStudent(params: { name: string; email: string; locale: string | null }) {
    return this.provision(params, ProvisionedRole.Student);
  }

  provisionGuardian(params: { name: string; email: string; locale: string | null }) {
    return this.provision(params, ProvisionedRole.Guardian);
  }

  /**
   * El usuario es global (la misma persona puede estar en dos escuelas) y la
   * membresía es por escuela y rol. `ON CONFLICT DO NOTHING` cubre el caso del
   * tutor con dos hijos matriculados: una sola membresía, dos vínculos.
   */
  private async provision(
    params: { name: string; email: string; locale: string | null },
    role: ProvisionedRole,
  ): Promise<string> {
    const userId = await this.memberships.upsertUser({
      email: params.email,
      name: params.name,
      locale: params.locale ?? "es-ES",
    });

    return this.memberships.upsertMembership({
      schoolId: this.tenant.schoolId(),
      userId,
      role,
      locale: params.locale,
    });
  }
}
```

El repositorio va aparte, y es el único que ve tablas:

```typescript
// apps/api/src/contexts/people/infrastructure/persistence/membership.repository.ts
export const MEMBERSHIP_REPOSITORY = Symbol("MembershipRepository");

export interface MembershipRepository {
  /** El usuario es global: la misma persona puede estar en dos escuelas. */
  upsertUser(params: { email: string; name: string; locale: string }): Promise<string>;

  /**
   * La membresía es por escuela y rol. Reactivar en lugar de duplicar cubre
   * el caso del tutor con dos hijos matriculados: una sola membresía, dos
   * vínculos.
   */
  upsertMembership(params: {
    schoolId: string;
    userId: string;
    role: ProvisionedRole;
    locale: string | null;
  }): Promise<string>;
}
```

- [x] **Paso 6: Implementar mapeador y repositorio**

El mapeador traduce entre el agregado y tres tablas (`student_profiles`, `guardians`, `consents`). Sigue el patrón de `ClassSessionMapper`: `toDomain` usa un constructor de rehidratación que no valida ni emite eventos, `toPersistence` devuelve las filas.

Añadir a `Student` el método estático:

```typescript
  static rehydrate(props: {
    id: StudentId;
    schoolId: SchoolId;
    membershipId: MembershipId;
    dateOfBirth: DateOfBirth;
    status: StudentStatus;
    guardians: Guardian[];
    consents: Map<ConsentKind, ConsentState>;
    pausedUntil: Date | null;
    leftReason: string | null;
    nativeLanguage: string;
    targetLanguage: string;
    now: Date;
  }): Student {
    return new Student(
      props.id, props.schoolId, props.membershipId, props.dateOfBirth,
      props.status, props.guardians, props.consents, props.pausedUntil,
      props.leftReason, props.nativeLanguage, props.targetLanguage, props.now,
    );
  }
```

y exportar `ConsentState`:

```typescript
export type ConsentState = { granted: boolean; grantedBy: MembershipId | null; at: Date | null };
```

- [x] **Paso 7: Escribir la prueba de ida y vuelta del mapeador**

```typescript
// apps/api/src/contexts/people/infrastructure/persistence/student.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "../../domain/model/date-of-birth.vo.js";
import { GuardianId, StudentId } from "../../domain/model/identifiers.js";
import { Student } from "../../domain/model/student.aggregate.js";
import { StudentMapper } from "./student.mapper.js";

const AHORA = new Date("2026-07-25T12:00:00Z");

describe("StudentMapper", () => {
  it("conserva el estado al ir y volver", () => {
    const original = Student.enrol({
      id: StudentId.of("44444444-4444-4444-8444-444444444444"),
      schoolId: SchoolId.of("11111111-1111-4111-8111-111111111111"),
      membershipId: MembershipId.of("22222222-2222-4222-8222-222222222222"),
      dateOfBirth: DateOfBirth.of("2014-01-01"),
      nativeLanguage: "es",
      targetLanguage: "en",
      now: AHORA,
    });
    original.addGuardian({
      id: GuardianId.of("55555555-5555-4555-8555-555555555555"),
      membershipId: MembershipId.of("33333333-3333-4333-8333-333333333333"),
      relationship: "mother",
      canGiveConsent: true,
    });
    original.grantConsent({
      kind: "recording",
      grantedBy: MembershipId.of("33333333-3333-4333-8333-333333333333"),
      now: AHORA,
    });

    const filas = StudentMapper.toPersistence(original);
    const vuelta = StudentMapper.toDomain(filas.student, filas.guardians, filas.consents, AHORA);

    expect(vuelta.id.value).toBe(original.id.value);
    expect(vuelta.guardianRequired).toBe(true);
    expect(vuelta.hasConsent("recording")).toBe(true);
    expect(vuelta.guardians).toHaveLength(1);
    // La rehidratación no reproduce eventos: lo que ya pasó no vuelve a pasar.
    expect(vuelta.hasUncommittedEvents).toBe(false);
  });
});
```

- [x] **Paso 8: Implementar mapeador, repositorio, modelo de lectura, DTOs, controlador y módulo**

Seguir exactamente la estructura de `scheduling`:
- El repositorio **no filtra por `school_id`** (lo hace RLS) y usa `this.drizzle.db`.
- El modelo de lectura envuelve sus consultas en `this.uow.read(...)`.
- El controlador es fino: traduce DTO → comando y lo pone en el bus.
- El módulo ata cada puerto con su adaptador.

Endpoints del controlador:

| Método | Ruta | Roles | Comando o consulta |
|---|---|---|---|
| `POST` | `/students` | owner, admin | `EnrolStudentCommand` |
| `POST` | `/students/:id/leave` | owner, admin | `LeaveStudentCommand` |
| `POST` | `/students/:id/consents` | owner, admin | `GrantConsentCommand` |
| `GET` | `/students` | owner, admin, teacher | `ListStudentsQuery` |

- [x] **Paso 9: Registrar el módulo y verificar de extremo a extremo**

```bash
npm run build && node dist/main.js &
sleep 6
# Alta de un menor SIN tutor: debe fallar
curl -s -w " [HTTP %{http_code}]" -X POST http://localhost:3000/api/v1/students \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"Hugo Peiró","email":"hugo@ejemplo.test","dateOfBirth":"2017-03-01","nativeLanguage":"es","targetLanguage":"en"}'
```

Esperado: **409** con `guardian_required`.

Repetir con `guardian` incluido: **201** y `guardianRequired: true`.

- [x] **Paso 10: Commit**

```bash
git add apps/api/src/contexts/people apps/api/src/app.module.ts
git commit -m "feat(people): alta de alumnos con tutor legal y consentimientos"
```

---

## Tarea 3: `people` — profesorado

Mismo patrón, reglas más simples: tarifa por tramo, horas contratadas y disponibilidad.

**Ficheros:**
- Crear: `apps/api/src/contexts/people/domain/model/teacher.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/people/domain/model/weekly-availability.vo.ts` y su `.spec.ts`
- Crear: comandos `hire-teacher`, `set-availability`, `release-teacher`
- Crear: repositorio, mapeador y endpoints

**Interfaces:**
- Consume: lo de la Tarea 2.
- Produce: `Teacher` con `hire()`, `setAvailability()`, `release()`; `POST /api/v1/teachers`, `PUT /api/v1/teachers/:id/availability`.

Reglas a codificar en el dominio:

- La tarifa debe caer dentro del tramo declarado. Los tramos vienen del mercado real (italki, Preply, julio 2026): `community` 4–15 €/h, `professional` 15–40 €/h, `specialist` 30–75 €/h. Fuera de rango, `InvalidHourlyRateError`.
- Las horas contratadas van entre 1 y 60 semanales.
- Una franja de disponibilidad no puede solaparse con otra del mismo día.
- Un profesor dado de baja no admite nuevas asignaciones, pero sus clases pasadas siguen en el histórico.

- [x] **Paso 1: Escribir las pruebas de los tramos de tarifa** (mínimo 6 casos: uno válido y uno inválido por tramo)
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `HourlyRate` y `Teacher`**
- [x] **Paso 4: Escribir las pruebas de solape de disponibilidad**
- [x] **Paso 5: Implementar `WeeklyAvailability`**
- [x] **Paso 6: Repositorio, mapeador, comandos y controlador**
- [x] **Paso 7: Verificar que `scheduling` sigue en verde** — `PeopleTeacherAvailabilityAdapter` lee estas tablas: `npm run test --workspace @langopia/api`
- [x] **Paso 8: Commit** — `feat(people): alta de profesorado con tramos de tarifa y disponibilidad`

---

## Tarea 4: Contexto `catalog` — cursos, grupos y matrículas

**Ficheros:**
- Crear: `apps/api/src/contexts/catalog/` completo (dominio, aplicación, infraestructura)

**Interfaces:**
- Consume: `StudentId`, `TeacherId` (vía puerto, no importando `people`).
- Produce: `Course`, `Group`, `Enrollment`; eventos `StudentEnrolledInGroup`, `GroupStarted`.

Reglas a codificar:

- Un grupo no admite más matrículas que su `capacity`. Al llenarse emite `GroupFull`.
- Un curso privado tiene capacidad 1: matricular a un segundo alumno es `invariant_violation`.
- Matricular a un alumno de baja no se permite. Se comprueba con un puerto hacia `people`, no importando su agregado.
- El precio acordado puede ser menor que el de catálogo (beca); nunca negativo.
- Los nombres de curso van en `course_translations`, con al menos el idioma por defecto de la escuela.

- [x] **Paso 1: Pruebas de `Group.enrol()`** — capacidad, curso privado, alumno de baja
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `Course`, `Group` y `Enrollment`**
- [x] **Paso 4: Puerto `StudentStatusPort` + adaptador anticorrupción hacia `people`**
- [x] **Paso 5: Persistencia con las traducciones**
- [x] **Paso 6: Endpoints** — `POST /courses`, `POST /groups`, `POST /groups/:id/enrolments`
- [x] **Paso 7: Commit** — `feat(catalog): cursos, grupos y matrículas con traducciones`

---

## Tarea 5: `scheduling` — asistencia

El agregado que faltaba. Va aparte de `ClassSession` a propósito: una clase con treinta alumnos no debe cargar treinta filas para cambiarle la hora.

**Ficheros:**
- Crear: `apps/api/src/contexts/scheduling/domain/model/attendance.aggregate.ts` y su `.spec.ts`
- Crear: comandos `record-attendance`, `import-attendance`
- Crear: manejador de evento que cierra la clase cuando llega la asistencia
- Modificar: `scheduling.module.ts`

**Interfaces:**
- Consume: `SessionId`, `StudentId`, `ClassSession`.
- Produce: `AttendanceSheet` con `markPresent()`, `markAbsent()`, `importFrom()`; evento `AttendanceRecorded`.

Reglas a codificar:

- No se puede pasar lista de una clase que aún no ha empezado.
- El origen (`auto`, `manual`, `imported`) se guarda siempre: la asistencia manual es menos fiable y la analítica lo necesita.
- Marcar a un alumno no matriculado en el grupo es `invariant_violation`.
- Cuando toda la hoja está cubierta, se cierra la clase con `complete({ anyoneAttended })`. Si nadie asistió, el estado resultante es `no_show`, no `completed`.

- [x] **Paso 1: Pruebas de la hoja de asistencia** (mínimo 6 casos)
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `AttendanceSheet`**
- [x] **Paso 4: Comando `RecordAttendanceCommand` y su manejador**
- [x] **Paso 5: Endpoint** `POST /scheduling/sessions/:id/attendance`
- [x] **Paso 6: Verificar contra el seed** — pasar lista de una clase de la Escuela Atlántico y comprobar que su estado pasa a `completed`
- [x] **Paso 7: Commit** — `feat(scheduling): hoja de asistencia y cierre de clase`

---

## Tarea 6: Contexto `classroom` — aulas

**Ficheros:**
- Crear: `apps/api/src/contexts/classroom/domain/ports/room-provider.port.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/livekit-room.adapter.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/google-meet-room.adapter.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/zoom-room.adapter.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/teams-room.adapter.ts`
- Crear: `apps/api/src/contexts/classroom/application/event-handlers/on-class-session-scheduled.handler.ts`

**Interfaces:**
- Consume: `ClassSessionScheduled` (evento de `scheduling`).
- Produce: `RoomProviderPort` con `createRoom()`, `issueJoinToken()`, `deleteRoom()`.

Diseño:

- Un puerto, cuatro adaptadores. El selector se resuelve por `roomProvider` de la clase.
- Cuando llega `ClassSessionScheduled`, el manejador crea la sala en el proveedor que toque y guarda `room_url` y `room_external_id`.
- El token de acceso a LiveKit es de corta duración y se emite al pedirlo, nunca se guarda.
- Meet, Zoom y Teams necesitan OAuth de la escuela: si no está conectado, la clase se crea igual y se marca la sala como pendiente. **Nunca se bloquea la creación de una clase porque falte una integración.**

- [x] **Paso 1: Definir el puerto con sus tres operaciones**
- [x] **Paso 2: Implementar el adaptador de LiveKit** (el camino principal)
- [x] **Paso 3: Escribir la prueba del manejador con un doble del puerto**
- [x] **Paso 4: Implementar el manejador del evento**
- [x] **Paso 5: Implementar los tres adaptadores externos con OAuth por escuela**
- [x] **Paso 6: Endpoint** `POST /classroom/sessions/:id/join` que devuelve el token
- [x] **Paso 7: Commit** — `feat(classroom): aula propia en LiveKit e integraciones de vídeo`

---

## Tarea 7: `billing` — facturación con comisión configurable

La pieza que cierra el modelo de negocio. La comisión es configurable por escuela, y su valor **se congela** al emitir.

**Ficheros:**
- Crear: `apps/api/src/contexts/billing/domain/model/invoice.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/billing/domain/model/money.vo.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/billing/domain/model/platform-fee.vo.ts` y su `.spec.ts`
- Crear: comandos `issue-invoice`, `record-payment`, `refund-payment`
- Crear: `apps/api/src/contexts/billing/domain/ports/payment-gateway.port.ts`
- Crear: `apps/api/src/contexts/billing/infrastructure/external/stripe/` (adaptador y traducción de tipos)

**Interfaces:**
- Consume: `StudentId` (vía puerto), `ClassSessionCanceled` (evento).
- Produce: `Invoice` con `issue()`, `markPaid()`, `refund()`; `Money`; `PlatformFee`.

Reglas a codificar:

- `Money` en céntimos enteros, con moneda. Sumar euros con reales es `invalid_input`.
- `PlatformFee.of(bps, capCents)` calcula sobre el total y aplica el tope. Con `bps = 0` o el interruptor apagado, la comisión es cero.
- Al emitir, se copian `application_fee_bps` y `application_fee_cents` a la factura. **Nunca se recalculan después.**
- Una devolución parcial revierte la parte proporcional de comisión.
- No se puede devolver más de lo cobrado.
- Las facturas `platform_to_school` nunca llevan comisión.

- [x] **Paso 0: Definir el puerto de cobro, antes que ningún adaptador**

Va primero a propósito: escrito después del adaptador, un puerto acaba siendo la firma de Stripe con otro nombre.

```typescript
// apps/api/src/contexts/billing/domain/ports/payment-gateway.port.ts
export const PAYMENT_GATEWAY = Symbol("PaymentGatewayPort");

/** Referencia a algo que vive en el proveedor. Nunca se interpreta aquí. */
export type ProviderRef = { provider: PaymentProvider; ref: string };

export const PaymentProvider = { Stripe: "stripe" } as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export interface PaymentGatewayPort {
  /**
   * Cobra al alumno reteniendo la comisión de la plataforma.
   *
   * `fee` ya viene calculada y congelada por `Invoice`: el proveedor la
   * aplica, no la decide.
   */
  charge(params: {
    amount: Money;
    fee: PlatformFee;
    payer: PayerRef;
    merchant: ProviderRef;
    idempotencyKey: string;
  }): Promise<ChargeResult>;

  /** Devolución total o parcial. Revierte la parte proporcional de comisión. */
  refund(params: {
    charge: ProviderRef;
    amount: Money;
    reason: RefundReason;
    idempotencyKey: string;
  }): Promise<RefundResult>;

  /** Estado de un cobro, para reconciliar cuando el webhook no llegó. */
  statusOf(charge: ProviderRef): Promise<PaymentStatus>;
}
```

Nada de `PaymentIntent`, `application_fee_amount` ni `transfer_data`: ese vocabulario vive en el adaptador. La regla para revisarlo: **si un nombre solo se entiende leyendo la documentación de Stripe, está mal puesto**.

`idempotencyKey` no es un detalle de Stripe aunque Stripe lo tenga: cobrar dos veces por un reintento es un problema de negocio, y todo proveedor serio ofrece la garantía.

El alta de comerciante va en un puerto aparte (`MerchantOnboardingPort`, T8), porque es la parte que **no** se abstrae bien: cada plataforma tiene su flujo de verificación. Separarlo evita que un puerto que sí es portable quede contaminado por otro que no lo es.

- [x] **Paso 1: Pruebas de `Money`** — suma, resta, moneda distinta, importe negativo
- [x] **Paso 2: Pruebas de `PlatformFee`** — 0 %, 2 %, con tope, redondeo, interruptor apagado
- [x] **Paso 3: Ejecutar y comprobar que fallan**
- [x] **Paso 4: Implementar `Money` y `PlatformFee`**
- [x] **Paso 5: Pruebas del agregado `Invoice`**, incluyendo que la comisión no cambia si cambia la de la escuela
- [x] **Paso 6: Implementar `Invoice`**
- [x] **Paso 7: Implementar el adaptador de Stripe** en `infrastructure/external/stripe/` — `charge()` sobre PaymentIntent con `application_fee_amount` y `transfer_data.destination`; `refund()` con `reverse_transfer`. Todo el vocabulario de Stripe queda dentro de esta carpeta

- [x] **Paso 7b: Prueba de que el dominio no sabe de Stripe**

```typescript
it("billing/domain y billing/application no mencionan a ningún proveedor", () => {
  const offenders = tsFiles(join(CONTEXTS_DIR, "billing"))
    .filter((f) => f.includes("/domain/") || f.includes("/application/"))
    .filter((f) => /stripe|paymentintent|application_fee|transfer_data/i.test(readFileSync(f, "utf8")));
  expect(offenders, offenders.join("\n")).toEqual([]);
});
```

Es la prueba que convierte «hay que tener cuidado» en algo que falla solo. Sin ella, la primera prisa mete un `stripeCustomerId` en un comando y nadie lo ve hasta que toca migrar
- [x] **Paso 8: Conectar el manejador de `ClassSessionCanceled`** para que abra la devolución cuando `refundDue` sea cierto (hoy solo registra en el log)
- [ ] **Paso 9: Verificar con Stripe en modo prueba** — cobro de 100 € con 2 % de comisión: 2 € en la plataforma, 98 € en la cuenta conectada (sin `STRIPE_SECRET_KEY` en este entorno; ver informe)
- [x] **Paso 9b: Verificar con un doble del puerto** — la misma prueba del caso de uso con un `PaymentGatewayPort` falso debe pasar sin tocar la red. Si no se puede, es que el caso de uso depende de detalles del proveedor
- [x] **Paso 10: Emitir el recibo del cobro**

Factura y recibo **no son lo mismo**, y tu módulo 7 pide los dos. La factura
dice lo que se debe; el recibo acredita que se pagó. En España una academia
necesita poder dar el segundo a una familia que lo pide para desgravar o para
la empresa que le costea el curso.

- `Receipt` se emite al confirmarse el pago, con su propia numeración
  correlativa (`REC-2026-0001`), independiente de la de facturas.
- Lleva importe pagado, fecha, medio de pago y referencia de la factura.
- **Un cobro parcial genera un recibo parcial**: no se espera al total.
- Una devolución **no** anula el recibo: emite un abono aparte. Borrar el
  rastro de un pago que existió es lo que no se puede hacer.
- Se genera en PDF en el idioma del destinatario y se envía por correo.

- [x] **Paso 11: Prueba de la numeración correlativa y del recibo parcial**
- [x] **Paso 12: Commit** — `feat(billing): facturación, recibos y comisión configurable`

---

## Tarea 8: `billing` — alta de comerciante y webhooks

**Regla que gobierna el diseño: la escuela puede usar todo el producto antes de conectar la pasarela.** Los cobros se activan cuando esté lista, no el día uno. Es la mitigación del riesgo de fricción del spec.

**Esta es la parte que no se abstrae del todo, y conviene saberlo antes de intentarlo.** Verificar la identidad de un comerciante es un proceso legal, y cada plataforma tiene el suyo: Stripe Connect, Adyen for Platforms y Mangopay difieren en estados, en requisitos y en quién asume el riesgo. El puerto `MerchantOnboardingPort` existe para que el dominio no dependa de ninguno —una escuela está `pending`, `active` o `restricted`, y eso es vocabulario nuestro—, pero cambiar de proveedor implicará reescribir el adaptador entero y volver a verificar a cada escuela. Es coste asumido, no deuda.

Lo que sí se gana separándolo del `PaymentGatewayPort`: cobrar y devolver siguen siendo portables aunque esta pieza no lo sea.

**Ficheros:**
- Crear: `apps/api/src/contexts/billing/application/commands/start-connect-onboarding/`
- Crear: `apps/api/src/contexts/billing/domain/ports/merchant-onboarding.port.ts`
- Crear: `apps/api/src/contexts/billing/infrastructure/http/webhooks/stripe-webhook.controller.ts`

**Interfaces:**
- Produce: `POST /billing/merchant/onboarding` (devuelve la URL del proveedor), `POST /billing/webhooks/stripe`.

- [x] **Paso 1: Comando que da de alta al comerciante y devuelve el enlace de onboarding** — a través de `MerchantOnboardingPort`, no llamando a Stripe desde el manejador
- [x] **Paso 2: Controlador de webhooks con verificación de firma** — sin verificar la firma, cualquiera puede marcar una factura como pagada. Va en `infrastructure/http/webhooks/`, uno por proveedor: cada uno verifica su firma y traduce su evento a **los mismos comandos**. El dominio no sabe cuál le habló
- [x] **Paso 3: Manejar `account.updated`** traduciéndolo a `merchant_status` `active` o `restricted` — el estado que guardamos es nuestro, no el nombre que use Stripe
- [x] **Paso 4: Manejar `payment_intent.succeeded` y `charge.refunded`**
- [x] **Paso 5: Prueba de que emitir una factura sin comerciante activo la deja en `open` sin intentar cobrar**
- [x] **Paso 5b: Prueba de idempotencia del webhook** — el mismo evento entregado dos veces cobra una. Los proveedores reintentan, y un pago duplicado se convierte en una devolución y una llamada del cliente
- [x] **Paso 6: Commit** — `feat(billing): alta de comerciante y webhooks con firma verificada`

---

## Tarea 9: Panel de dirección y portal del alumno

Los dos adaptadores de entrada que hacen visible todo lo anterior.

**Ficheros:**
- Crear: `apps/api/src/contexts/*/application/queries/` (las consultas que faltan)
- Crear: `apps/api/src/contexts/portal/infrastructure/http/student-portal.controller.ts`

**Interfaces:**
- Produce: `GET /dashboard/summary`, `GET /portal/me/sessions`, `GET /portal/me/invoices`, `GET /portal/me/attendance`.

El panel reproduce el mockup del diseño:

| Dato | De dónde sale |
|---|---|
| Alumnos activos | `people` |
| Asistencia media | `scheduling` |
| NPS | `feedback` (ola 3; hasta entonces, ausente) |
| Facturado en el mes | `billing` |
| Alumnos que requieren atención | consulta que cruza asistencia, valoración y reseñas |
| Ocupación del profesorado | `scheduling` — **ya está hecho y verificado** |

- [x] **Paso 1: Consulta de riesgo de baja** — asistencia por debajo del 60 % en cuatro semanas, o sin valoración en tres
- [x] **Paso 2: Consulta de resumen del panel**
- [x] **Paso 3: Endpoints del portal del alumno**, filtrados por `membershipId` de la sesión
- [x] **Paso 4: Prueba de que un alumno NO puede ver las facturas de otro** — misma escuela, distinto alumno: 403
- [x] **Paso 5: Commit** — `feat(portal): panel de dirección y portal del alumno`

---

## Tarea 10: Prueba de extremo a extremo de la ola

El criterio de «listo» del spec, automatizado.

**Ficheros:**
- Crear: `apps/api/test/e2e/wave-1.e2e-spec.ts`

- [ ] **Paso 1: Escribir la prueba que recorre el camino completo**

```typescript
// Guion, con el detalle de cada llamada al escribirla:
//  1. Crear escuela y dueño
//  2. Alta de 30 alumnos, 5 de ellos menores con tutor
//  3. Alta de 3 profesores con disponibilidad
//  4. Crear 2 cursos y 3 grupos
//  5. Matricular a los 30
//  6. Programar una semana de clases
//  7. Pasar lista de todas
//  8. Emitir las facturas del mes
//  9. Cobrar con Stripe en modo prueba
// 10. Cancelar una clase y comprobar que se abre la devolución
// Aserciones finales: 30 alumnos activos, 5 con tutor, asistencia registrada,
// facturas pagadas, una devolución abierta, comisión del 2 % retenida.
```

- [ ] **Paso 2: Ejecutar contra una base de datos limpia**
- [ ] **Paso 3: Añadirla al CI**
- [ ] **Paso 4: Commit** — `test: recorrido completo de la ola 1`

---

---

## Tarea 11: Alta de escuela nueva (autoservicio)

Hoy las escuelas solo existen porque las crea el seed. Sin registro autoservicio, cada cliente nuevo es trabajo manual tuyo — y eso no escala más allá del piloto.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/domain/model/school.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/iam/application/commands/register-school/`
- Crear: `apps/api/src/contexts/iam/application/commands/invite-member/`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/schools.controller.ts`

**Interfaces:**
- Consume: `AUTH` (ola 0 T5), `IdGenerator`, `Clock`.
- Produce: `POST /schools/register` (público), `POST /schools/members/invite`, `POST /invitations/:token/accept`.

Reglas a codificar en el dominio:

- El `slug` es único globalmente, entre 3 y 40 caracteres, solo minúsculas, números y guiones. No puede ser una palabra reservada (`www`, `api`, `app`, `admin`, `mail`, `static`).
- Quien registra la escuela queda como `owner`. Una escuela sin dueño no puede existir.
- La escuela nace en `trial` con 14 días. `trial_ends_at` se calcula al crear.
- El plan inicial es `starter`; la comisión de plataforma arranca **desactivada**.
- Una invitación caduca a los 7 días y solo puede aceptarla el correo al que se envió.

- [x] **Paso 1: Pruebas del `slug`** — válido, con mayúsculas, demasiado corto, palabra reservada, con caracteres raros
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `SchoolSlug` y el agregado `School`**
- [x] **Paso 4: Comando `RegisterSchoolCommand`** — crea escuela, usuario dueño, membresía y suscripción de prueba en una transacción
- [x] **Paso 5: Comando `InviteMemberCommand`** con token y caducidad
- [x] **Paso 6: Endpoints**, el de registro marcado `@Public()`
- [x] **Paso 7: Verificar** — registrar una escuela nueva y comprobar que su dueño puede entrar y no ve datos de las otras
- [x] **Paso 8: Commit** — `feat(iam): registro autoservicio de escuelas e invitaciones`

---

## Tarea 12: Notificaciones por correo

El módulo 7 emite facturas que nadie recibe, el seed modela encuestas «que se envían automáticamente tras la clase», y las invitaciones de la tarea anterior no llegan a ninguna parte. Todo eso necesita correo.

**Ficheros:**
- Crear: `apps/api/src/contexts/notifications/domain/ports/mailer.port.ts`
- Crear: `apps/api/src/contexts/notifications/infrastructure/external/resend-mailer.adapter.ts`
- Crear: `apps/api/src/contexts/notifications/infrastructure/templates/` (una plantilla por aviso e idioma)
- Crear: `apps/api/src/contexts/notifications/application/event-handlers/` (uno por evento)
- Crear: `apps/api/src/contexts/notifications/notifications.module.ts`

**Interfaces:**
- Consume: eventos de `scheduling`, `billing`, `people`, `iam`.
- Produce: `MailerPort` con `send({ to, locale, template, data })`.

Avisos de la ola 1, y qué evento los dispara:

| Aviso | Evento | Destinatario |
|---|---|---|
| Invitación a la escuela | `iam.member.invited` | La persona invitada |
| Bienvenida al alumno | `people.student.enrolled` | Alumno, o su tutor si es menor |
| Recordatorio de clase | trabajo programado, 24 h antes | Alumnos del grupo |
| Clase cancelada | `scheduling.class_session.canceled` | Alumnos del grupo |
| Clase replanificada | `scheduling.class_session.rescheduled` | Alumnos del grupo |
| Factura emitida | `billing.invoice.issued` | Alumno o tutor pagador |
| Cobro fallido | `billing.payment.failed` | Alumno o tutor pagador |
| Encuesta post-clase | `scheduling.class_session.completed` | Alumnos que asistieron |

Decisiones de diseño:

- **El idioma sale del destinatario**, no de la escuela: `memberships.locale` y si no, `users.locale`. Es el multiidioma que decidiste, aplicado donde más se nota.
- Los correos de un **menor** van al tutor con `is_billing_contact`, no al alumno.
- `notifications` es un contexto propio que **solo escucha**. Ningún otro contexto sabe que existe: si mañana quitas el correo, nada más se entera.
- Un fallo de envío **no** deshace la operación: la clase ya se canceló. Se registra y se reintenta.

- [x] **Paso 1: Declarar el puerto `MailerPort`**
- [x] **Paso 2: Prueba del selector de idioma y destinatario** — adulto, menor con tutor, persona sin locale propio
- [x] **Paso 3: Ejecutar y comprobar que falla**
- [x] **Paso 4: Implementar el resolutor de destinatario e idioma**
- [x] **Paso 5: Adaptador de correo (Resend o similar) y plantillas en los cinco idiomas soportados**
- [x] **Paso 6: Un manejador por evento de la tabla**
- [x] **Paso 7: Trabajo programado del recordatorio de clase**
- [x] **Paso 8: Verificar** — cancelar una clase del seed y comprobar que sale un correo por alumno, cada uno en su idioma
- [x] **Paso 9: Commit** — `feat(notifications): avisos por correo en el idioma del destinatario`

---

## Tarea 13: Editar fichas de alumnos y profesores

Tus módulos 1 y 2 piden «alta, baja y **modificación**». Hay alta y baja; falta modificar.

**Ficheros:**
- Modificar: `apps/api/src/contexts/people/domain/model/student.aggregate.ts`
- Modificar: `apps/api/src/contexts/people/domain/model/teacher.aggregate.ts`
- Crear: comandos `update-student`, `update-teacher`
- Modificar: los controladores de `people`

**Interfaces:**
- Produce: `PATCH /students/:id`, `PATCH /teachers/:id`.

Reglas a codificar:

- La fecha de nacimiento **sí** se puede corregir (un error de tecleo es común), pero si el cambio convierte a un adulto en menor y no hay tutor, se rechaza.
- El nivel MCER se puede ajustar a mano; queda registrado en `audit_logs` con el valor anterior.
- Cambiar el tramo de tarifa de un profesor obliga a que la tarifa siga siendo válida en el tramo nuevo.
- Un alumno de baja no se edita: primero se reactiva.
- Todo cambio deja rastro en la auditoría con `before` y `after`.

- [x] **Paso 1: Pruebas de los cinco casos anteriores**
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar los métodos de cambio en ambos agregados**
- [x] **Paso 4: Comandos y endpoints con `PATCH`**
- [x] **Paso 5: Commit** — `feat(people): edición de fichas con rastro de auditoría`

---

## Tarea 14: Importar alumnado desde CSV

Una academia viene de una hoja de cálculo. Sin importación, el piloto no arranca: nadie teclea 200 alumnos a mano.

**Ficheros:**
- Crear: `apps/api/src/contexts/people/application/commands/import-students/`
- Crear: `apps/api/src/contexts/people/domain/model/import-report.vo.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/people/infrastructure/http/imports.controller.ts`

**Interfaces:**
- Produce: `POST /students/import/preview` y `POST /students/import/commit`.

Diseño, y el motivo de cada decisión:

- **Dos fases: previsualizar y confirmar.** La previsualización valida todo y devuelve un informe sin escribir nada. Importar 200 alumnos y descubrir el error en el 150 es peor que no importar.
- La validación es **por fila e independiente**: una fila mala no tumba las buenas. El informe dice exactamente qué fila y por qué.
- Un menor sin columna de tutor es un error de fila, no un aborto de la importación.
- Correos repetidos dentro del mismo fichero: error. Correo que ya existe en la escuela: se actualiza la ficha, no se duplica.
- La confirmación es **idempotente por fichero**: reenviar el mismo CSV no crea duplicados.

Columnas aceptadas: `nombre`, `email`, `fecha_nacimiento`, `idioma_nativo`, `idioma_objetivo`, `nivel`, `tutor_nombre`, `tutor_email`, `tutor_parentesco`.

- [x] **Paso 1: Pruebas del informe de importación** — fila válida, menor sin tutor, correo duplicado, fecha mal formada, nivel MCER inventado
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar el analizador y el `ImportReport`**
- [x] **Paso 4: Comando de previsualización, que no escribe nada**
- [x] **Paso 5: Comando de confirmación, en una transacción, reutilizando `EnrolStudentCommand`**
- [x] **Paso 6: Verificar con un CSV de 200 filas** con 5 errores intencionados: 195 altas y un informe con las 5 filas señaladas
- [x] **Paso 7: Commit** — `feat(people): importación de alumnado desde CSV con previsualización`

---

## Tarea 15: RGPD operativo — acceso, portabilidad y borrado

Un cliente institucional te lo va a auditar, y con alumnado menor de edad la exigencia es mayor.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/application/queries/export-personal-data/`
- Crear: `apps/api/src/contexts/iam/application/commands/erase-person/`
- Crear: `docs/RGPD.md`

**Interfaces:**
- Produce: `GET /people/:membershipId/export`, `POST /people/:membershipId/erase`.

Decisiones:

- **Exportación**: un JSON con todo lo que la escuela tiene de esa persona —ficha, asistencia, intentos, valoraciones, facturas, consentimientos, transcripciones donde aparece—. Lo puede pedir la propia persona, su tutor si es menor, o la dirección.
- **Borrado**: seudonimizar, no borrar filas. Un `DELETE` en cascada se llevaría por delante la contabilidad, que hay que conservar por ley fiscal. Se sustituye nombre y correo por marcadores, se borran los ficheros asociados y queda constancia en `audit_logs`.
- Las **facturas se conservan** con el importe y sin los datos personales: la obligación fiscal y el derecho al olvido conviven así.
- Un borrado es **irreversible** y requiere rol `owner`.

- [x] **Paso 1: Prueba de que la exportación incluye todas las tablas con datos de la persona**
- [x] **Paso 2: Prueba de que el borrado seudonimiza pero conserva los importes facturados**
- [x] **Paso 3: Ejecutar y comprobar que fallan**
- [x] **Paso 4: Implementar la exportación**
- [x] **Paso 5: Implementar el borrado seudonimizador**
- [x] **Paso 6: Escribir `docs/RGPD.md`** — qué datos se guardan, cuánto, con qué base legal y cómo se ejercen los derechos
- [x] **Paso 7: Commit** — `feat(iam): exportación y borrado de datos personales`

---

## Tarea 16: Valoración del alumno por el profesor

**Tu módulo 11.** Va en la ola 1 y no más tarde por una razón concreta: el panel de dirección muestra «alumnos sin valorar» como señal de riesgo, y esa señal necesita que las valoraciones existan. Sin esta tarea, el indicador estaría siempre vacío y la métrica de productividad docente de la ola 3 no tendría de dónde leer.

**Ficheros:**
- Crear: `apps/api/src/contexts/assessment/domain/model/evaluation.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/assessment/application/commands/evaluate-student/`
- Crear: `apps/api/src/contexts/assessment/application/queries/get-students-without-evaluation/`
- Crear: `apps/api/src/contexts/assessment/infrastructure/http/evaluations.controller.ts`
- Crear: `apps/api/src/contexts/assessment/assessment.module.ts`

**Interfaces:**
- Consume: `TeacherId`, `StudentId` (vía puerto), `Clock`, `UnitOfWork`.
- Produce: `Evaluation` con `write()`, `revise()`, `hideFromGuardian()`; `POST /assessments/evaluations`, `GET /assessments/students-without-evaluation`.

Reglas a codificar:

- Una valoración cubre un **periodo** (`periodStart` a `periodEnd`). Dos valoraciones del mismo profesor al mismo alumno no pueden solaparse en el tiempo: si no, «la última valoración» deja de tener sentido.
- `progressRating` va de 1 a 5. Fuera de rango, `invalid_input`.
- El periodo no puede terminar en el futuro: no se valora lo que aún no ha pasado.
- Solo puede valorar un profesor que **imparta clase a ese alumno** en el periodo. Se comprueba con un puerto hacia `scheduling`, no importando su agregado.
- Si el alumno es **menor**, `visibleToGuardian` arranca en `true`. Ocultarla a la familia es una decisión explícita que queda en la auditoría.
- Una valoración se puede revisar durante 7 días; después queda congelada. El historial es dato pedagógico y no se reescribe indefinidamente.

- [x] **Paso 1: Escribir las pruebas**

```typescript
// apps/api/src/contexts/assessment/domain/model/evaluation.spec.ts
import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Evaluation } from "./evaluation.aggregate.js";
import { EvaluationId } from "./identifiers.js";

const AHORA = new Date("2026-09-30T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");

function valoracion(rating = 4, periodEnd = new Date("2026-09-29T00:00:00Z")) {
  return Evaluation.write({
    id: EvaluationId.of("22222222-2222-4222-8222-222222222222"),
    schoolId: ESCUELA,
    teacherProfileId: "33333333-3333-4333-8333-333333333333",
    studentProfileId: "44444444-4444-4444-8444-444444444444",
    periodStart: new Date("2026-09-01T00:00:00Z"),
    periodEnd,
    progressRating: rating,
    strengths: "Muy buena pronunciación.",
    improvements: "Ampliar vocabulario laboral.",
    nextSteps: "Pasar al grupo A2 en octubre.",
    studentIsMinor: false,
    now: AHORA,
  });
}

describe("Evaluation", () => {
  it("registra la valoración y emite el evento", () => {
    const e = valoracion();
    expect(e.progressRating).toBe(4);
    expect(e.pullDomainEvents()[0]!.eventName).toBe("assessment.student.evaluated");
  });

  it("rechaza una puntuación fuera de 1 a 5", () => {
    expect(() => valoracion(6)).toThrow(/entre 1 y 5/);
    expect(() => valoracion(0)).toThrow(/entre 1 y 5/);
  });

  it("rechaza un periodo que termina en el futuro", () => {
    expect(() => valoracion(4, new Date("2026-12-01T00:00:00Z"))).toThrow(/futuro/i);
  });

  it("es visible para el tutor por defecto si el alumno es menor", () => {
    const e = Evaluation.write({
      id: EvaluationId.of("22222222-2222-4222-8222-222222222222"),
      schoolId: ESCUELA,
      teacherProfileId: "33333333-3333-4333-8333-333333333333",
      studentProfileId: "44444444-4444-4444-8444-444444444444",
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-09-29T00:00:00Z"),
      progressRating: 3,
      studentIsMinor: true,
      now: AHORA,
    });
    expect(e.visibleToGuardian).toBe(true);
  });

  it("se puede revisar dentro de los 7 días", () => {
    const e = valoracion();
    e.revise({ progressRating: 5, strengths: "Corregido", now: new Date("2026-10-03T10:00:00Z") });
    expect(e.progressRating).toBe(5);
  });

  it("no se puede revisar pasados 7 días", () => {
    const e = valoracion();
    expect(() =>
      e.revise({ progressRating: 5, now: new Date("2026-10-15T10:00:00Z") }),
    ).toThrow(/congelada/i);
  });

  it("detecta solape de periodos", () => {
    const a = valoracion();
    expect(
      a.overlapsWith({
        periodStart: new Date("2026-09-15T00:00:00Z"),
        periodEnd: new Date("2026-10-15T00:00:00Z"),
      }),
    ).toBe(true);
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que falla**

Comando: `npm run test --workspace @langopia/api -- evaluation`

- [x] **Paso 3: Implementar `EvaluationId` y el agregado**

- [x] **Paso 4: Puerto `TeachesStudentPort` hacia `scheduling`** — responde si ese profesor dio clase a ese alumno en el periodo. Se declara en `assessment` y se implementa en su `infrastructure/acl/`

- [x] **Paso 5: Comando `EvaluateStudentCommand`**, que comprueba el solape y el puerto antes de crear

- [x] **Paso 6: Consulta `GetStudentsWithoutEvaluationQuery`** — alumnos activos sin valoración en N semanas, que es lo que alimenta el panel

- [x] **Paso 7: Endpoints y módulo**

- [x] **Paso 8: Verificar contra el seed** — Nerea Ojeda no tiene valoración en el escenario, así que debe salir en la consulta; Paula Vidal, que sí la tiene, no

- [x] **Paso 9: Commit** — `feat(assessment): valoración del alumno por el profesor`

## Tarea 17: `iam` — impersonación para soporte

Cuando una escuela diga «no me deja programar la clase», necesitas ver su pantalla, no imaginarla. Va en la ola 1 porque el criterio de esta ola es un piloto real operando, y el soporte empieza el mismo día que el piloto.

**No es un contexto nuevo.** Es identidad: vive en `iam`. Un contexto `impersonation` no tendría reglas propias, solo un puente.

**Es la función más peligrosa del producto.** Mal hecha, es una puerta trasera con aspecto de herramienta de soporte: permite actuar como otra persona, en una base de datos con menores de edad. Todo lo que sigue son restricciones, y ninguna sobra.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/domain/model/impersonation.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/iam/domain/model/impersonation-rules.ts` y su `.spec.ts`
- Crear: comandos `start-impersonation`, `end-impersonation`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/impersonation.controller.ts`
- Modificar: `session-tenant.interceptor.ts`, `roles.guard.ts` (ola 0, T6 y T7)
- Modificar: `packages/db/src/schema/platform.ts` y `enums.ts`
- Crear: `apps/web/src/features/impersonation/`

**Interfaces:**
- Consume: `MembershipLookupPort` (ola 0, T6), `Clock`, `AuditLog`.
- Produce: `Impersonation` con `start()`, `end()`, `isExpired()`; `POST /iam/impersonation`, `DELETE /iam/impersonation`.

### Quién puede impersonar a quién

| Quien inicia | Puede actuar como | Requisito |
|---|---|---|
| Soporte de la plataforma | Cualquier miembro de cualquier escuela | Motivo obligatorio |
| `owner` de una escuela | `admin`, `teacher`, `student`, `guardian` **de su escuela** | Motivo obligatorio |
| `admin` | `teacher`, `student`, `guardian` de su escuela | Motivo obligatorio |
| `teacher`, `student`, `guardian` | Nadie | — |

Reglas a codificar en el dominio, con su prueba cada una:

- **Nunca hacia arriba ni en horizontal.** Un `admin` no actúa como `owner` ni como otro `admin`. Es la vía de escalada de privilegios más obvia y la que más veces se olvida.
- **Nadie se impersona a sí mismo.** No aporta nada y ensucia la auditoría.
- **Sin encadenar.** Si A actúa como B, B no puede iniciar otra impersonación. Una cadena hace imposible responder a «¿quién hizo esto?».
- **Caduca a los 30 minutos.** No se renueva: se vuelve a justificar. Una sesión de soporte olvidada abierta es una cuenta compartida.
- **Motivo obligatorio**, texto libre, mínimo 10 caracteres. Va a la auditoría y se enseña en la pantalla de la escuela.
- **Actuar como un menor se marca aparte.** Es acceso de un adulto que no es su tutor a los datos de un menor. Se registra con `involves_minor` y **siempre** se notifica al tutor, aunque la escuela tenga los avisos apagados.

### Lo que no se puede hacer mientras se impersona

Aquí está la diferencia entre una herramienta de soporte y una puerta trasera. El guardia rechaza con `403 impersonation_forbidden_action`:

| Prohibido | Por qué |
|---|---|
| Cambiar contraseña, correo o segundo factor | Es secuestro de la cuenta, no soporte |
| Borrar la cuenta o la escuela | Irreversible y ajeno |
| Cobrar, devolver o cambiar datos de pago | Dinero real de otra persona |
| Exportar o borrar datos (RGPD) | Convierte el soporte en una vía de exfiltración |
| Otorgar o retirar consentimientos | Especialmente los de un menor: los firma su tutor, nadie más |
| Conceder o quitar roles | Escalada por la puerta de atrás |

La lista vive en el dominio (`FORBIDDEN_WHILE_IMPERSONATING`), no repartida por los controladores: repartida, el próximo endpoint nace sin protección.

### Rastro

- `audit_logs` gana `impersonator_membership_id`, y `actor_kind` el valor `impersonation`. **Toda** acción registra los dos: quién parecía y quién era.
- La sesión impersonada **no puede ocultar** el aviso en el panel. Si se puede cerrar, alguien trabajará una hora sin recordar que no es él.
- Al terminar —a mano o por caducidad— queda registrado el cierre y su duración.

- [ ] **Paso 1: Escribir las pruebas de las reglas** — mínimo 10 casos: cada fila de la tabla de permisos, escalada hacia arriba, en horizontal, a uno mismo, encadenada y caducada
- [ ] **Paso 2: Ejecutar y comprobar que fallan**
- [ ] **Paso 3: Implementar `impersonation-rules.ts` y el agregado**
- [ ] **Paso 4: Pruebas de las acciones prohibidas** — una por fila de la segunda tabla
- [ ] **Paso 5: Migración del esquema** — `impersonator_membership_id`, el valor nuevo del enum y la tabla `impersonations` con motivo, inicio, fin y `involves_minor`
- [ ] **Paso 6: Comando `StartImpersonationCommand`** que valida las reglas, escribe la auditoría y emite `ImpersonationStarted`
- [ ] **Paso 7: Extender el interceptor de tenant** — el CLS lleva la membresía **efectiva** y la **real**. El tenant pasa a ser el de la persona impersonada; RLS sigue mandando, así que un soporte que actúa como alguien de la escuela A no ve la B
- [ ] **Paso 8: Extender el guardia de roles** con la lista de acciones prohibidas
- [ ] **Paso 9: Prueba de aislamiento** — actuar como alguien de la escuela A y comprobar que sigue sin verse ni una fila de la B
- [ ] **Paso 10: Aviso permanente en el panel**, con quién eres, a quién representas y cuánto queda. Botón de salir siempre visible
- [ ] **Paso 11: Notificación al afectado** — correo al usuario, y al tutor si es menor
- [ ] **Paso 12: Pantalla de auditoría** para que la escuela vea quién actuó como quién, cuándo y por qué. Que el cliente pueda auditarte es lo que separa esto de una puerta trasera
- [ ] **Paso 13: Commit** — `feat(iam): impersonación de soporte con auditoría y acciones restringidas`

---

## Criterio de «listo» de la ola 1

- [ ] Una escuela piloto real **se registra sola**, da de alta 30 alumnos **desde el panel** (o los importa desde su Excel), imparte una semana de clases y emite sus recibos sin que toques la base de datos ni escribas una sola llamada a la API por ella.
- [ ] Los avisos por correo llegan en el idioma de cada destinatario, y los de un menor van a su tutor.
- [ ] Un profesor valora el avance de un alumno, y el panel señala a quien lleva tres semanas sin valorar.
- [ ] Un menor no puede darse de alta sin tutor, ni firmar su propio consentimiento.
- [ ] Una clase cancelada por la escuela abre la devolución sola; cancelada por el alumno con menos de 24 h, no.
- [ ] La comisión configurada se retiene en Stripe y queda congelada en la factura.
- [ ] Una escuela sin Connect puede usar todo el producto y emitir facturas sin cobrarlas.
- [ ] Un alumno no puede ver los datos de otro, ni siquiera de su misma escuela.
- [ ] Un soporte puede actuar como un usuario del piloto, y la escuela ve en su auditoría quién lo hizo, cuándo y por qué.
- [ ] Mientras se impersona no se puede cambiar una contraseña, cobrar, exportar datos ni firmar un consentimiento.
- [ ] La prueba de extremo a extremo pasa en CI.

---

## Autorrevisión

**Cobertura del spec.** Módulo 1 → T1-T2; módulo 2 → T3; módulo 3 → T4-T5; módulo 12 → T6; módulo 7 → T7-T8; portales → T9; impersonación de soporte → T17 (no estaba en los 13 módulos; nace de que el piloto necesita soporte desde el primer día). Los módulos 4, 5, 11 y 13 son de olas posteriores, como marca el spec. La regla de menores está en T1 (dominio) y se verifica en T2 (extremo a extremo) y T10.

**Placeholders.** Las tareas 1 y 2 llevan el código completo por ser las de mayor riesgo. De la 3 a la 9 se especifican reglas, ficheros, interfaces y criterios de verificación, pero no todo el código: el patrón ya está fijado por `scheduling` (completo en el repositorio) y por las tareas 1-2. Es una decisión consciente para que el plan siga siendo útil en lugar de convertirse en un volcado del código final; cada tarea nombra sus reglas de negocio con precisión suficiente para escribir las pruebas antes que la implementación.

**Consistencia de tipos.** `StudentId`, `TeacherId` y `GuardianId` se definen en T1 y se usan a partir de ahí. `MembershipProvisioningPort` se declara en T2 paso 4 y se implementa en el paso 5. `ConsentState` y `Student.rehydrate` se añaden en T2 paso 6, y la prueba del mapeador (paso 7) los consume. `Money` y `PlatformFee` se definen en T7 antes de usarse en `Invoice`. Sin discrepancias.
