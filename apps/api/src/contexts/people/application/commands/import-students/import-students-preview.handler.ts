import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { analyzeStudentsCsv } from "./analyze-students-csv.js";
import {
  ImportStudentsPreviewCommand,
  type ImportStudentsPreviewResult,
} from "./import-students-preview.command.js";

/**
 * Previsualización de la importación de alumnado.
 *
 * No abre ninguna unidad de trabajo ni toca un repositorio: solo analiza el
 * CSV con la misma función que usará la confirmación (`analyzeStudentsCsv`),
 * así que lo que aquí se ve es, fila por fila, exactamente lo que pasaría al
 * confirmar. Importar 200 alumnos y descubrir el error en el 150 es peor que
 * no importar — por eso esta fase existe y no escribe nada.
 */
@CommandHandler(ImportStudentsPreviewCommand)
export class ImportStudentsPreviewHandler implements ICommandHandler<ImportStudentsPreviewCommand> {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async execute(command: ImportStudentsPreviewCommand): Promise<ImportStudentsPreviewResult> {
    const report = analyzeStudentsCsv(command.props.csv, this.clock.now());

    return {
      totalRows: report.totalRows,
      validCount: report.validCount,
      invalidCount: report.invalidCount,
      rows: report.rows,
    };
  }
}
