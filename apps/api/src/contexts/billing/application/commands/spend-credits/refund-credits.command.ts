import { Command } from "@nestjs/cqrs";

/**
 * Devuelve créditos ya gastados. La otra mitad de `SpendCreditsCommand`
 * (mismo directorio): confirma, después de generar, que el coste real fue
 * MENOR que lo reservado —se devuelve la diferencia— o que la generación
 * falló entera —se devuelve todo—. «El cliente no paga por lo que no
 * recibió» (brief), y nunca se rechaza por `ai_hard_limit`: ese tope protege
 * de gastar de más, no de recuperar una reserva.
 */
export class RefundCreditsCommand extends Command<{ balanceAfter: number }> {
  constructor(
    readonly props: {
      /** Entero positivo: los créditos reservados de más, o la reserva entera de una generación fallida. */
      credits: number;
      note: string;
      aiGenerationId?: string | null;
    },
  ) {
    super();
  }
}
