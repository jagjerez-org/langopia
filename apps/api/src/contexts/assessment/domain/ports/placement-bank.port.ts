import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";

/**
 * Lo que `PlacementTest` (o, mejor dicho, quien lo orquesta) necesita de un
 * ítem del banco de nivelación ya calibrado (`placement_items`, seed de la
 * ola 2 — 120 ítems entre las dos escuelas del seed). Este puerto NO genera
 * ítems con IA: el banco ya existe, calibrado, y esta tarea lo usa tal cual
 * —"no inventes otros" es la instrucción explícita del encargo—, así que
 * `pickNext` es una consulta de lectura, no una llamada a un modelo.
 */
export interface PlacementBankItem {
  readonly id: string;
  readonly language: string;
  readonly level: CefrLevel;
  readonly skill: string;
  readonly prompt: Record<string, unknown>;
  readonly solution: Record<string, unknown>;
}

export interface PlacementBankPort {
  /**
   * Las destrezas con ítems activos para este idioma, en un orden estable
   * (alfabético) — es la rotación con la que `PlacementTest.start()` abre la
   * prueba. Vacío si no hay banco para ese idioma en esta escuela.
   */
  listSkills(language: string): Promise<string[]>;

  /**
   * El ítem que de verdad se sirvió antes, por su id — hace falta para
   * corregir la respuesta (`solution`) y para saber la destreza/nivel reales
   * que `PlacementTest.answer()` necesita. `null` si no existe en esta
   * escuela (RLS lo oculta igual que a cualquier otra fila ajena).
   */
  get(itemId: string): Promise<PlacementBankItem | null>;

  /**
   * El siguiente ítem para el nivel y destreza pedidos, evitando repetir uno
   * ya usado en esta prueba (`excludeItemIds`). Con solo tres ítems por
   * nivel y destreza (seed), una prueba larga puede agotar la combinación
   * exacta antes de terminar: el adaptador relaja el criterio (misma
   * destreza en otro nivel, mismo nivel en otra destreza, cualquiera del
   * idioma) antes de rendirse. `null` solo si de verdad no queda ningún
   * ítem activo de ese idioma sin usar.
   */
  pickNext(criteria: {
    language: string;
    level: CefrLevel;
    skill: string;
    excludeItemIds: readonly string[];
  }): Promise<PlacementBankItem | null>;
}

export const PLACEMENT_BANK_PORT = Symbol("PlacementBankPort");
