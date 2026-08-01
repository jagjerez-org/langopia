import { Inject } from "@nestjs/common";
import { CommandBus, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import { PEOPLE_READ_MODEL, type PeopleReadModel } from "../../ports/people-read-model.port.js";
import { EnrolStudentCommand } from "../enrol-student/enrol-student.command.js";
import { UpdateStudentCommand } from "../update-student/update-student.command.js";
import { analyzeStudentsCsv } from "./analyze-students-csv.js";
import {
  ImportStudentsCommitCommand,
  type ImportCommitRowResult,
  type ImportStudentsCommitResult,
} from "./import-students-commit.command.js";

/**
 * Confirmación de la importación de alumnado desde CSV.
 *
 * Reanaliza el mismo fichero que ya vio la previsualización — no hay ningún
 * estado compartido entre las dos llamadas, el análisis es una función pura
 * y determinista sobre el mismo contenido — y solo intenta escribir las
 * filas que salieron válidas; las inválidas se devuelven señaladas, tal cual
 * las vio la previsualización.
 *
 * Cada fila válida se confirma reutilizando `EnrolStudentCommand` (alta) o
 * `UpdateStudentCommand` (edición), el mismo comando que usaría un
 * administrador desde el panel: la transacción de cada uno es la suya
 * propia. Así una fila que falla de verdad al escribir —una carrera con otra
 * alta simultánea del mismo correo, por ejemplo— no deshace las filas ya
 * guardadas: "una fila mala no tumba las buenas" se cumple también en la
 * confirmación, no solo en la validación previa.
 *
 * Idempotente por fichero: antes de dar de alta busca si el correo de la
 * fila YA tiene un alumno en la escuela (`PeopleReadModel.findStudentIdByEmail`).
 * Si lo tiene, actualiza esa ficha en vez de crear una nueva — reenviar el
 * mismo CSV nunca duplica, se limita a volver a aplicar los mismos datos.
 */
@CommandHandler(ImportStudentsCommitCommand)
export class ImportStudentsCommitHandler implements ICommandHandler<ImportStudentsCommitCommand> {
  constructor(
    private readonly commands: CommandBus,
    @Inject(PEOPLE_READ_MODEL) private readonly people: PeopleReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ImportStudentsCommitCommand): Promise<ImportStudentsCommitResult> {
    const report = analyzeStudentsCsv(command.props.csv, this.clock.now());

    let createdCount = 0;
    let updatedCount = 0;
    const rows: ImportCommitRowResult[] = [];

    for (const row of report.rows) {
      if (row.status === "invalid") {
        rows.push({ row: row.row, status: "invalid", errors: row.errors });
        continue;
      }

      try {
        const existingStudentId = await this.people.findStudentIdByEmail(row.data.email);

        if (existingStudentId) {
          await this.commands.execute(
            new UpdateStudentCommand({
              studentId: existingStudentId,
              dateOfBirth: row.data.dateOfBirth,
              currentLevel: row.data.currentLevel,
            }),
          );
          updatedCount++;
          rows.push({ row: row.row, status: "updated", studentId: existingStudentId });
        } else {
          const enrolled = await this.commands.execute(
            new EnrolStudentCommand({
              name: row.data.name,
              email: row.data.email,
              dateOfBirth: row.data.dateOfBirth,
              nativeLanguage: row.data.nativeLanguage,
              targetLanguage: row.data.targetLanguage,
              currentLevel: row.data.currentLevel,
              guardian: row.data.guardian,
            }),
          );
          createdCount++;
          rows.push({ row: row.row, status: "created", studentId: enrolled.studentId });
        }
      } catch (error) {
        // Solo un `DomainError` es un rechazo de NEGOCIO de esta fila
        // concreta (el ejemplo real: la fila pasó la previsualización pero,
        // entre medias, alguien dio de alta el mismo correo a mano). Un
        // fallo cualquier otro —de infraestructura, no de negocio— no se
        // silencia: se propaga y detiene la petición, porque eso no es "una
        // fila mala", es que algo está roto.
        if (!(error instanceof DomainError)) throw error;
        rows.push({
          row: row.row,
          status: "invalid",
          errors: [{ code: error.code, message: error.message, details: error.details }],
        });
      }
    }

    return {
      totalRows: report.totalRows,
      validCount: report.validCount,
      invalidCount: report.invalidCount,
      createdCount,
      updatedCount,
      rows,
    };
  }
}
