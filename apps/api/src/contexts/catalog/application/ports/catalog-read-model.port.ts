/**
 * Modelo de lectura de catálogo.
 *
 * Igual que `PeopleReadModel` y `SchedulingReadModel`: vive en la capa de
 * APLICACIÓN, no carga agregados ni aplica reglas de negocio, y devuelve
 * estructuras planas listas para pintar (Tarea 8 del panel web: no existía
 * ningún `GET` en `CatalogController`, solo altas).
 */

export type CourseTranslationItem = { locale: string; name: string; description: string | null };

/**
 * Grupo dentro de la lista de un curso. Sin recuento de matriculados: el
 * padrón completo (con nombre) ya lo da `GET /scheduling/groups/:id/roster`
 * (Tarea 9), y la ficha del grupo (`GroupDetail` de abajo) compara su
 * longitud con `capacity` — no hace falta duplicar ese conteo aquí.
 */
export type CourseGroupSummary = {
  groupId: string;
  name: string;
  teacherId: string | null;
  teacherName: string | null;
  capacity: number;
  startsOn: string;
  endsOn: string | null;
  status: string;
};

export type CourseListItem = {
  courseId: string;
  code: string;
  language: string;
  level: string;
  modality: string;
  totalSessions: number;
  sessionMinutes: number;
  maxStudents: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  translations: CourseTranslationItem[];
  groups: CourseGroupSummary[];
};

/**
 * Ficha de un grupo (`/grupos/:id`, Tarea 8, Paso 3). Lleva las traducciones
 * del curso —no solo su nombre en un idioma fijo— porque quien mira la ficha
 * puede tener un idioma de sesión distinto al que uso el curso al crearse;
 * resolver cuál mostrar es lo mismo que ya hace `CourseListItem` en
 * `/cursos`, no una decisión nueva.
 */
export type GroupDetail = {
  groupId: string;
  courseId: string;
  courseCode: string;
  courseLanguage: string;
  courseLevel: string;
  courseTranslations: CourseTranslationItem[];
  teacherId: string | null;
  teacherName: string | null;
  name: string;
  capacity: number;
  startsOn: string;
  endsOn: string | null;
  status: string;
};

export interface CatalogReadModel {
  /** Catálogo de la escuela activa, con sus grupos, el que resuelve RLS. */
  listCourses(): Promise<CourseListItem[]>;

  /** Como un `find`, pero lanza `NotFoundError` si no existe en esta escuela. */
  getGroupOrFail(groupId: string): Promise<GroupDetail>;
}

export const CATALOG_READ_MODEL = Symbol("CatalogReadModel");
