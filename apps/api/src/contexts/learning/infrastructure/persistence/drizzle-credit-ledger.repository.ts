import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import {
  InsufficientCreditsError,
  InvalidCreditAmountError,
} from "../../domain/errors/learning.errors.js";

/**
 * Acceso a datos del saldo de créditos de IA que necesita `learning` para
 * generar contenido. Vive aquí, y no en `infrastructure/acl/`, porque el
 * acceso a datos vive en un repositorio (`ARCHITECTURE.md`):
 * `BillingCreditLedgerAdapter` delega en esta clase en lugar de escribir SQL
 * él mismo.
 *
 * `.for("update")` sobre la única fila de `schools` que RLS deja ver dentro
 * de esta transacción es lo que de verdad impide que dos generaciones
 * simultáneas de la misma escuela, con saldo para una sola, pasen las dos: la
 * segunda transacción que llegue aquí espera a que la primera confirme (o
 * deshaga) antes de leer el saldo. Mismo mecanismo, misma razón, que
 * `DrizzleCreditBalanceRepository` (`billing`, tarea 5) — no se reutiliza esa
 * clase porque hacerlo cruzaría la frontera entre contextos.
 */
@Injectable()
export class DrizzleCreditLedgerRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async spend(params: {
    credits: number;
    costCents?: number;
    note: string;
    aiGenerationId?: string | null;
  }): Promise<void> {
    this.assertPositiveAmount(params.credits);

    const row = await this.lockSchoolRow();
    const newBalance = row.balance - params.credits;
    if (row.hardLimit && newBalance < 0) {
      throw new InsufficientCreditsError(row.id, params.credits, row.balance);
    }

    await this.applyMovement({
      schoolId: row.id,
      newBalance,
      delta: -params.credits,
      reason: "generation",
      costCents: params.costCents ?? 0,
      note: params.note,
      aiGenerationId: params.aiGenerationId ?? null,
    });
  }

  async refund(params: { credits: number; note: string; aiGenerationId?: string | null }): Promise<void> {
    this.assertPositiveAmount(params.credits);

    const row = await this.lockSchoolRow();
    const newBalance = row.balance + params.credits;

    await this.applyMovement({
      schoolId: row.id,
      newBalance,
      delta: params.credits,
      reason: "refund",
      costCents: 0,
      note: params.note,
      aiGenerationId: params.aiGenerationId ?? null,
    });
  }

  private async lockSchoolRow(): Promise<{ id: string; balance: number; hardLimit: boolean }> {
    const rows = await this.drizzle.db
      .select({
        id: schema.schools.id,
        balance: schema.schools.aiCreditsBalance,
        hardLimit: schema.schools.aiHardLimit,
      })
      .from(schema.schools)
      .limit(1)
      .for("update");

    const row = rows[0];
    if (!row) throw new NotFoundError("la escuela", "activa");
    return row;
  }

  private async applyMovement(params: {
    schoolId: string;
    newBalance: number;
    delta: number;
    reason: (typeof schema.creditReason.enumValues)[number];
    costCents: number;
    note: string;
    aiGenerationId: string | null;
  }): Promise<void> {
    await this.drizzle.db
      .update(schema.schools)
      .set({ aiCreditsBalance: params.newBalance })
      .where(eq(schema.schools.id, params.schoolId));

    await this.drizzle.db.insert(schema.creditLedger).values({
      schoolId: params.schoolId,
      delta: params.delta,
      balanceAfter: params.newBalance,
      reason: params.reason,
      costCents: params.costCents,
      aiGenerationId: params.aiGenerationId,
      note: params.note,
    });
  }

  private assertPositiveAmount(credits: number): void {
    if (!Number.isInteger(credits) || credits <= 0) {
      throw new InvalidCreditAmountError(credits);
    }
  }
}
