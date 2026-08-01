/** Una clase que empieza dentro de la ventana que mira el recordatorio. */
export interface UpcomingSession {
  sessionId: string;
  groupId: string;
  start: Date;
}

/**
 * Capa anticorrupción hacia `catalog` y `scheduling`: matrícula, sesión y
 * asistencia, reducidas a las cuatro preguntas que necesita este contexto
 * para saber a quién avisar de una clase.
 *
 * Deliberadamente no importa nada de `scheduling` ni de `catalog`: ni
 * `ClassSession`, ni `Group`, ni sus repositorios. El acceso a datos vive en
 * `infrastructure/persistence/`, sobre las mismas tablas que esos contextos,
 * igual que las capas anticorrupción de `scheduling` leen tablas de `people`.
 */
export interface ClassDirectoryPort {
  /** Alumnos con matrícula activa en el grupo (`enrollments.status = 'active'`). */
  activeStudentIds(groupId: string): Promise<string[]>;

  /** A qué grupo pertenece una sesión. `null` si la sesión no existe. */
  groupIdForSession(sessionId: string): Promise<string | null>;

  /** Alumnos que asistieron a la clase (presentes o con retraso, nunca ausentes ni justificados). */
  attendedStudentIds(sessionId: string): Promise<string[]>;

  /** Clases programadas (`status = 'scheduled'`) que empiezan en `[from, to)`. */
  scheduledSessionsStartingBetween(from: Date, to: Date): Promise<UpcomingSession[]>;
}

export const CLASS_DIRECTORY = Symbol("ClassDirectoryPort");
