import type { SrsCard } from "../model/srs-card.aggregate.js";
import type { ExerciseId } from "../model/identifiers.js";

/**
 * Repositorio de `SrsCard`.
 *
 * El índice único real es `(studentProfileId, exerciseId)`
 * (`srs_cards_student_exercise_uq`): un alumno tiene como mucho una tarjeta
 * por ejercicio, así que `findByStudentAndExercise` es la única forma de
 * localizar una tarjeta concreta — nadie conoce su propio id hasta que
 * `save()` la crea la primera vez.
 */
export interface SrsCardRepository {
  /** `null` si el alumno nunca falló este ejercicio (o RLS la oculta). */
  findByStudentAndExercise(studentProfileId: string, exerciseId: ExerciseId): Promise<SrsCard | null>;

  /** Inserta o actualiza la tarjeta completa. */
  save(card: SrsCard): Promise<void>;

  createVocabularyCardsForParticipants(params: {
    schoolId: string;
    transcriptId: string;
    participantMembershipIds: readonly string[];
    vocabulary: ReadonlyArray<{ term: string; lemma?: string; level?: string; count: number }>;
    dueOn: string;
    now: Date;
  }): Promise<number>;

  /**
   * Tarjetas de un alumno que ya tocan hoy o antes (`dueOn <= onOrBefore`),
   * de la más vencida a la menos, y como mucho `limit`.
   *
   * El tope existe por el alumno que desaparece un mes y vuelve: una lista
   * de trescientas tarjetas vencidas desanima más de lo que ayuda, así que
   * el repaso de un día cualquiera siempre es abarcable y el resto del
   * atraso drena en los días siguientes, empezando por lo más antiguo.
   */
  findDueForStudent(params: {
    studentProfileId: string;
    onOrBefore: string;
    limit: number;
  }): Promise<SrsCard[]>;
}

export const SRS_CARD_REPOSITORY = Symbol("SrsCardRepository");
