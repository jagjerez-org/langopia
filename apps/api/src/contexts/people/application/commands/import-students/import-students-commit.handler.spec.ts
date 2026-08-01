import type { CommandBus } from "@nestjs/cqrs";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import { GuardianRequiredError } from "../../../domain/errors/people.errors.js";
import type {
  PeopleReadModel,
  StudentListItem,
  TeacherListItem,
} from "../../ports/people-read-model.port.js";
import { EnrolStudentCommand } from "../enrol-student/enrol-student.command.js";
import { UpdateStudentCommand } from "../update-student/update-student.command.js";
import { ImportStudentsCommitCommand } from "./import-students-commit.command.js";
import { ImportStudentsCommitHandler } from "./import-students-commit.handler.js";

const AHORA = new Date("2026-07-27T12:00:00Z");
const CABECERA =
  "nombre,email,fecha_nacimiento,idioma_nativo,idioma_objetivo,nivel,tutor_nombre,tutor_email,tutor_parentesco";

function fakeClock(): Clock {
  return { now: () => AHORA };
}

/**
 * Sustituye al `CommandBus` real: enruta `EnrolStudentCommand` y
 * `UpdateStudentCommand` a manejadores en memoria, sin NestJS ni base de
 * datos. Cada alta genera un id determinista y lo recuerda, para que las
 * comprobaciones de idempotencia puedan reutilizarlo.
 */
function fakeCommandBus(options: {
  onEnrol?: (command: EnrolStudentCommand) => void;
  onUpdate?: (command: UpdateStudentCommand) => void;
  failEnrolFor?: string;
} = {}) {
  const enrolled: EnrolStudentCommand[] = [];
  const updated: UpdateStudentCommand[] = [];
  let counter = 0;

  const bus = {
    execute: async (command: unknown) => {
      if (command instanceof EnrolStudentCommand) {
        if (options.failEnrolFor && command.props.email === options.failEnrolFor) {
          throw new GuardianRequiredError();
        }
        options.onEnrol?.(command);
        enrolled.push(command);
        counter++;
        return { studentId: `student-${counter}`, guardianRequired: false };
      }
      if (command instanceof UpdateStudentCommand) {
        options.onUpdate?.(command);
        updated.push(command);
        return { studentId: command.props.studentId, guardianRequired: false, currentLevel: null };
      }
      throw new Error(`comando inesperado en el test: ${(command as object).constructor.name}`);
    },
  };

  return { bus: bus as unknown as CommandBus, enrolled, updated };
}

function fakePeopleReadModel(byEmail: Record<string, string> = {}): PeopleReadModel {
  return {
    listStudents: async (): Promise<StudentListItem[]> => [],
    findStudentIdByEmail: async (email: string) => byEmail[email.toLowerCase()] ?? null,
    listTeachers: async (): Promise<TeacherListItem[]> => [],
    listLeads: async () => [],
  };
}

describe("ImportStudentsCommitHandler (Tarea 14)", () => {
  it("da de alta las filas válidas con correos nuevos, reutilizando EnrolStudentCommand", async () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,1990-01-01,es,en,B1,,,`;
    const { bus, enrolled } = fakeCommandBus();
    const handler = new ImportStudentsCommitHandler(bus, fakePeopleReadModel(), fakeClock());

    const result = await handler.execute(new ImportStudentsCommitCommand({ csv }));

    expect(result.createdCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]!.props.email).toBe("ana@example.com");
    expect(result.rows).toEqual([{ row: 2, status: "created", studentId: "student-1" }]);
  });

  it("si el correo ya tiene alumno en la escuela, actualiza en vez de duplicar", async () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,1990-06-15,es,en,B2,,,`;
    const { bus, enrolled, updated } = fakeCommandBus();
    const people = fakePeopleReadModel({ "ana@example.com": "student-existente" });
    const handler = new ImportStudentsCommitHandler(bus, people, fakeClock());

    const result = await handler.execute(new ImportStudentsCommitCommand({ csv }));

    expect(result.createdCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(enrolled).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.props).toMatchObject({
      studentId: "student-existente",
      dateOfBirth: "1990-06-15",
      currentLevel: "B2",
    });
    expect(result.rows).toEqual([{ row: 2, status: "updated", studentId: "student-existente" }]);
  });

  it("una fila inválida se reporta y no llega a intentar escribirse", async () => {
    const csv =
      `${CABECERA}\n` +
      "Ana Pérez,ana@example.com,fecha-mal-formada,es,en,,,,\n" +
      "Berta López,berta@example.com,1990-01-01,es,en,,,,";
    const { bus, enrolled } = fakeCommandBus();
    const handler = new ImportStudentsCommitHandler(bus, fakePeopleReadModel(), fakeClock());

    const result = await handler.execute(new ImportStudentsCommitCommand({ csv }));

    expect(result.invalidCount).toBe(1);
    expect(result.createdCount).toBe(1);
    // Solo se intentó escribir la fila buena: la mala nunca llegó al bus de comandos.
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]!.props.email).toBe("berta@example.com");
    const filaInvalida = result.rows.find((r) => r.row === 2)!;
    expect(filaInvalida.status).toBe("invalid");
  });

  it("un rechazo de negocio al escribir una fila no detiene las siguientes", async () => {
    const csv =
      `${CABECERA}\n` +
      "Ana Pérez,ana@example.com,1990-01-01,es,en,,,,\n" +
      "Berta López,berta@example.com,1990-01-01,es,en,,,,";
    const { bus, enrolled } = fakeCommandBus({ failEnrolFor: "ana@example.com" });
    const handler = new ImportStudentsCommitHandler(bus, fakePeopleReadModel(), fakeClock());

    const result = await handler.execute(new ImportStudentsCommitCommand({ csv }));

    expect(result.createdCount).toBe(1);
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]!.props.email).toBe("berta@example.com");
    const filaFallida = result.rows.find((r) => r.row === 2)!;
    expect(filaFallida).toMatchObject({ row: 2, status: "invalid" });
    if (filaFallida.status === "invalid") {
      expect(filaFallida.errors[0]!.code).toBe("guardian_required");
    }
    const filaBuena = result.rows.find((r) => r.row === 3)!;
    expect(filaBuena.status).toBe("created");
  });

  it("es idempotente por fichero: reenviar el mismo CSV pone al día en vez de duplicar", async () => {
    const csv = `${CABECERA}\nAna Pérez,ana@example.com,1990-01-01,es,en,B1,,,`;
    const byEmail: Record<string, string> = {};
    const { bus, enrolled } = fakeCommandBus({
      onEnrol: (command) => {
        byEmail[command.props.email.toLowerCase()] = "student-1";
      },
    });
    const people = fakePeopleReadModel(byEmail);
    const handler = new ImportStudentsCommitHandler(bus, people, fakeClock());

    const primero = await handler.execute(new ImportStudentsCommitCommand({ csv }));
    expect(primero.createdCount).toBe(1);
    expect(primero.updatedCount).toBe(0);

    const segundo = await handler.execute(new ImportStudentsCommitCommand({ csv }));
    expect(segundo.createdCount).toBe(0);
    expect(segundo.updatedCount).toBe(1);
    // Solo se dio de alta una vez en las dos ejecuciones juntas.
    expect(enrolled).toHaveLength(1);
  });
});
