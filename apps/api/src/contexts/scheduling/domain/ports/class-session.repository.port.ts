import type { ClassSession } from "../model/class-session.aggregate.js";
import type { GroupId, SessionId, TeacherId } from "../model/identifiers.js";
import type { TimeSlot } from "../model/time-slot.vo.js";

/**
 * Repositorio de la raíz de agregado.
 *
 * Habla en objetos de dominio, no en filas. El dominio define esta interfaz y
 * la infraestructura la implementa; si mañana se cambia Drizzle por otra
 * cosa, este fichero no se toca.
 *
 * No hay método `update`: se carga el agregado, se le pide que haga algo, y
 * se guarda. El repositorio no expone modificaciones parciales porque eso
 * permitiría saltarse las invariantes.
 */
export interface ClassSessionRepository {
  find(id: SessionId): Promise<ClassSession | null>;

  /** Como `find`, pero lanza `NotFoundError` si no existe. */
  findOrFail(id: SessionId): Promise<ClassSession>;

  save(session: ClassSession): Promise<void>;

  saveMany(sessions: ClassSession[]): Promise<void>;

  /**
   * Clases del profesor que se solapan con la franja. Lo usa el manejador
   * del comando para no permitir dobles reservas.
   *
   * `excluding` evita que una clase se detecte a sí misma al replanificarla.
   */
  findOverlappingForTeacher(params: {
    teacherId: TeacherId;
    slot: TimeSlot;
    excluding?: SessionId;
  }): Promise<ClassSession[]>;

  findByGroupBetween(params: {
    groupId: GroupId;
    from: Date;
    to: Date;
  }): Promise<ClassSession[]>;
}

export const CLASS_SESSION_REPOSITORY = Symbol("ClassSessionRepository");
