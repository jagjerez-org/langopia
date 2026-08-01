export class SubmitExamCommand {
  constructor(
    readonly props: {
      examId: string;
      /** Respuesta de cada ítem, indexada por su `id`. */
      responses: Record<string, Record<string, unknown>>;
    },
  ) {}
}
