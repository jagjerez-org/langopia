/**
 * Lo que `learning` necesita saber del catálogo para publicar una unidad a
 * grupos (tarea 11 del panel, Paso 4), y nada más: de qué curso es cada
 * grupo, y de qué nivel es ese curso.
 *
 * Puerto de salida hacia OTRO contexto (`catalog`), escrito en el lenguaje de
 * `learning`, igual que `CreditLedgerPort` hacia `billing` o `StudentSelfPort`
 * hacia `people`: no importa el agregado `Group` ni ningún fichero de
 * `contexts/catalog/`.
 *
 * Devuelve solo los grupos que EXISTEN en la escuela activa (RLS): pedir el
 * grupo de otra escuela no devuelve nada, y quien llama lo trata como un
 * grupo que no está.
 */
export type GroupCourse = {
  groupId: string;
  courseId: string;
  /** Nivel MCER del curso, para que la unidad pueda comprobar que le encaja. */
  level: string;
};

export interface GroupCoursePort {
  coursesOfGroups(groupIds: readonly string[]): Promise<GroupCourse[]>;
}

export const GROUP_COURSE_PORT = Symbol("GroupCoursePort");
