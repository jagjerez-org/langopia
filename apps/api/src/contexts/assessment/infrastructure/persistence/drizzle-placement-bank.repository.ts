import { Injectable } from "@nestjs/common";
import { and, asc, eq, notInArray, type SQL } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import type { PlacementBankItem, PlacementBankPort } from "../../domain/ports/placement-bank.port.js";

/**
 * Implementación del banco de nivelación sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que las
 * políticas RLS lo filtran todo por debajo — cada escuela ve solo su propio
 * banco (seed: 60 ítems por idioma en `atlantico`, tarea 8 de la ola 2).
 */
@Injectable()
export class DrizzlePlacementBankRepository implements PlacementBankPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async listSkills(language: string): Promise<string[]> {
    const rows = await this.drizzle.db
      .selectDistinct({ skill: schema.placementItems.skill })
      .from(schema.placementItems)
      .where(and(eq(schema.placementItems.language, language), eq(schema.placementItems.isActive, true)));
    return rows.map((r) => r.skill).sort();
  }

  async get(itemId: string): Promise<PlacementBankItem | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.placementItems)
      .where(eq(schema.placementItems.id, itemId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      language: row.language,
      level: row.level,
      skill: row.skill,
      prompt: row.prompt,
      solution: row.solution,
    };
  }

  async pickNext(criteria: {
    language: string;
    level: CefrLevel;
    skill: string;
    excludeItemIds: readonly string[];
  }): Promise<PlacementBankItem | null> {
    const exclude = [...criteria.excludeItemIds];

    // De más a menos estricto: nivel+destreza exactos, luego solo destreza,
    // luego solo nivel, y por último cualquier ítem del idioma. Cada nivel
    // relaja UN criterio del anterior —nunca los dos a la vez—, así que el
    // primero que encuentre algo es el más parecido a lo pedido. Hace falta
    // por lo poco profundo que es el banco (solo tres ítems por nivel y
    // destreza): una prueba larga puede agotar la combinación exacta antes
    // de llegar a las treinta preguntas.
    const tiers: SQL[] = [
      and(
        eq(schema.placementItems.language, criteria.language),
        eq(schema.placementItems.level, criteria.level),
        eq(schema.placementItems.skill, criteria.skill),
      )!,
      and(eq(schema.placementItems.language, criteria.language), eq(schema.placementItems.skill, criteria.skill))!,
      and(eq(schema.placementItems.language, criteria.language), eq(schema.placementItems.level, criteria.level))!,
      eq(schema.placementItems.language, criteria.language),
    ];

    for (const tier of tiers) {
      const found = await this.query(tier, exclude);
      if (found) return found;
    }
    // El banco no tiene NINGÚN ítem activo sin usar de este idioma: se
    // permite repetir uno ya visto antes que dejar la prueba sin siguiente
    // pregunta (`PlacementBankExhaustedError` es el último recurso, no
    // este).
    return this.query(eq(schema.placementItems.language, criteria.language), []);
  }

  private async query(where: SQL, excludeItemIds: readonly string[]): Promise<PlacementBankItem | null> {
    const conditions = [where, eq(schema.placementItems.isActive, true)];
    if (excludeItemIds.length > 0) {
      conditions.push(notInArray(schema.placementItems.id, [...excludeItemIds]));
    }

    const rows = await this.drizzle.db
      .select()
      .from(schema.placementItems)
      .where(and(...conditions))
      // Menos usado primero: reparte el desgaste entre los tres ítems de
      // cada nivel y destreza en vez de agotar siempre el mismo.
      .orderBy(asc(schema.placementItems.timesUsed))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      language: row.language,
      level: row.level,
      skill: row.skill,
      prompt: row.prompt,
      solution: row.solution,
    };
  }
}
