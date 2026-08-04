/**
 * Color por profesor (Paso 1 del brief): un índice estable de paleta a partir
 * del identificador, no del orden en que llegan las clases —dos peticiones a
 * la misma agenda deben pintar a cada profesor siempre igual—. La paleta en
 * sí (los colores concretos) vive en `WeekGrid.module.css`, seleccionada con
 * `data-teacher-color={index}`; este módulo solo decide el índice.
 */
export const TEACHER_COLOR_COUNT = 8;

/** `null` para una clase sin profesor asignado: no lleva color de profesor, un estilo neutro aparte. */
export function teacherColorIndex(teacherId: string | null): number | null {
  if (!teacherId) return null;
  let hash = 0;
  for (let index = 0; index < teacherId.length; index += 1) {
    hash = (hash * 31 + teacherId.charCodeAt(index)) >>> 0;
  }
  return hash % TEACHER_COLOR_COUNT;
}
