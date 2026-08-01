import { Command } from "@nestjs/cqrs";

/**
 * Gasta créditos de IA de la escuela activa.
 *
 * Es el comando que se llama ANTES de generar (brief de la Tarea 5,
 * paso 4; Tarea 6, pasos 1-2): reserva los créditos ESTIMADOS y, con
 * `ai_hard_limit`, rechaza la generación entera si no alcanza — nunca se
 * llama al modelo si esto lanza. Si el coste real resulta menor que la
 * reserva, `RefundCreditsCommand` (mismo directorio) devuelve la diferencia;
 * si la generación falla, devuelve la reserva completa.
 */
export class SpendCreditsCommand extends Command<{ balanceAfter: number; overdrawn: boolean }> {
  constructor(
    readonly props: {
      /** Entero positivo: los créditos que esta generación va a consumir (o su estimación). */
      credits: number;
      /** Coste real en céntimos, si ya se conoce. Por defecto 0 — la reserva previa no lo conoce todavía. */
      costCents?: number;
      note: string;
      /** La generación a la que corresponde este gasto, si ya existe su fila en `ai_generations`. */
      aiGenerationId?: string | null;
    },
  ) {
    super();
  }
}
