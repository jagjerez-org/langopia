import type { ExamKind } from "../../../domain/model/exam.aggregate.js";

export class GenerateExamCommand {
  constructor(
    readonly props: {
      kind: ExamKind;
      /** Alumnado del grupo: el mismo examen generado una vez se administra a todos ellos. */
      studentProfileIds: string[];
      title: string;
      language: string;
      level: string;
      sourceContentUnitIds: string[];
      /** Porcentaje por destreza, suma 100. Por defecto, a partes iguales entre las cuatro destrezas oficiales. */
      skillDistribution?: Record<string, number>;
      durationMinutes: number;
      /** Obligatorio si `kind` es `mock_official`. */
      mockFramework?: string | null;
      scheduledFor?: string | null;
    },
  ) {}
}
