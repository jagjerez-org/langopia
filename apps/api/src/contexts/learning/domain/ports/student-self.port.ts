/**
 * Lo que `learning` necesita saber del alumnado para el repaso diario
 * (tarea 12 de la ola 2: panel y portal — hacer ejercicios), y nada más.
 *
 * Igual que `StudentMinorPort` de `assessment` hacia `people`
 * (`isSelfOrGuardian`): es un puerto de salida hacia OTRO contexto, escrito
 * en el lenguaje de `learning`, que no importa el agregado `Student` ni
 * ningún fichero de `contexts/people/`. `GET /learning/students/:studentId/
 * due-cards` enseña las tarjetas de repetición espaciada de un alumno
 * concreto — un dato que ata a un menor de edad con lo que ha fallado—, así
 * que solo su propia membresía o la de su tutor legal pueden pedirlo.
 *
 * `learning` no reutiliza el `StudentMinorPort` de `assessment`
 * (`ARCHITECTURE.md`, «un contexto solo importa los eventos de otro»): este
 * puerto es una copia deliberada, mismo criterio que ya documentaron las
 * tareas 7 y 9 para `ExerciseSourcePort`/`SchoolCalendarPort` frente a sus
 * equivalentes en contextos vecinos.
 */
export interface StudentSelfPort {
  /** Si esta membresía es la titular de esta ficha de alumno, o su tutor legal. */
  isSelfOrGuardian(membershipId: string, studentProfileId: string): Promise<boolean>;
}

export const STUDENT_SELF_PORT = Symbol("StudentSelfPort");
