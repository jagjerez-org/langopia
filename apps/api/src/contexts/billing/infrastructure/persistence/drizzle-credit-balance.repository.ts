import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { CreditBalance } from "../../domain/model/credit-balance.aggregate.js";
import type { CreditBalanceRepository } from "../../domain/ports/credit-balance.repository.port.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * `findForUpdate()` es la mitad que de verdad importa de esta tarea: el
 * `.for("update")` sobre la única fila de `schools` que RLS deja ver dentro
 * de esta transacción bloquea esa fila hasta que la transacción termine. Dos
 * `SpendCreditsCommand` concurrentes para la misma escuela llegan aquí a la
 * vez; el segundo espera a que el primero confirme (o deshaga) y solo
 * entonces lee el saldo — nunca los dos ven el saldo «antes de gastar». Sin
 * este bloqueo, un `SELECT` normal seguido de un `UPDATE` dentro de la misma
 * transacción no basta: los dos leerían el mismo saldo y las dos
 * generaciones pasarían la comprobación con crédito para una sola.
 */
@Injectable()
export class DrizzleCreditBalanceRepository implements CreditBalanceRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findForUpdate(): Promise<CreditBalance> {
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

    return CreditBalance.rehydrate({
      schoolId: SchoolId.of(row.id),
      balance: row.balance,
      hardLimit: row.hardLimit,
    });
  }

  async save(balance: CreditBalance): Promise<void> {
    await this.drizzle.db
      .update(schema.schools)
      .set({ aiCreditsBalance: balance.balance })
      .where(eq(schema.schools.id, balance.schoolId.value));

    for (const movement of balance.pullMovements()) {
      await this.drizzle.db.insert(schema.creditLedger).values({
        schoolId: balance.schoolId.value,
        delta: movement.delta,
        balanceAfter: movement.balanceAfter,
        reason: movement.reason,
        costCents: movement.costCents,
        aiGenerationId: movement.aiGenerationId,
        note: movement.note,
        createdAt: movement.now,
      });
    }
  }
}
