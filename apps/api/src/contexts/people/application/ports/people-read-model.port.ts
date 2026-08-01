/**
 * Modelo de lectura de alumnado.
 *
 * Igual que `SchedulingReadModel`: vive en la capa de APLICACIÓN, no carga
 * agregados ni aplica reglas de negocio, y devuelve estructuras planas listas
 * para pintar una tabla. Cargar un `Student` completo por cada fila del
 * listado invocaría invariantes que una pantalla de lectura no necesita.
 */

export type StudentListItem = {
  studentId: string;
  /**
   * Membresía propia del alumno (Tarea 7 del panel web). El listado ya la
   * tenía disponible por el `JOIN` con `memberships` pero no la exponía: la
   * ficha del alumno necesita este id —no el de `studentId`— para pedir
   * `GET /people/:membershipId/export` (Tarea 15, RGPD), que es de donde
   * salen las pestañas de asistencia, consentimientos, facturas y
   * valoraciones sin duplicar ningún modelo de lectura ya construido.
   */
  membershipId: string;
  name: string;
  email: string;
  status: string;
  dateOfBirth: string;
  guardianRequired: boolean;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string | null;
  joinedAt: string;
};

/** Franja de disponibilidad semanal, igual forma que `WeeklyAvailability`. */
export type TeacherAvailabilitySlot = { weekday: number; startMinute: number; endMinute: number };

/**
 * Fila de `GET /teachers` (Tarea 8 del panel web).
 *
 * Incluye la disponibilidad completa en vez de exigir una segunda llamada
 * por profesor: son, como mucho, unas pocas franjas por persona (el seed
 * declara 5 como mucho), y la ficha de profesorado (Tarea 8, Paso 1) la
 * necesita en la cuadrícula editable. Mismo patrón que `StudentListItem`
 * (Tarea 7): sin endpoint de detalle propio, la ficha reutiliza esta misma
 * fila por `teacherId`.
 */
export type TeacherListItem = {
  teacherId: string;
  membershipId: string;
  name: string;
  email: string;
  tier: string;
  hourlyRateCents: number;
  currency: string;
  contractedHoursWeek: number;
  status: string;
  bio: string | null;
  languages: string[];
  certifications: string[];
  isNativeSpeaker: boolean;
  hiredAt: string;
  leftReason: string | null;
  availability: TeacherAvailabilitySlot[];
};

export type LeadFunnelItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  interestedLanguage: string | null;
  declaredLevel: string | null;
  placementLevel: string | null;
  placementScore: number | null;
  sourcePage: string | null;
  sourceCampaign: string | null;
  createdAt: string;
  lastContactedAt: string | null;
};

export interface PeopleReadModel {
  /** Alumnado de la escuela activa, el que resuelve RLS. */
  listStudents(): Promise<StudentListItem[]>;

  /**
   * El alumno con este correo en la escuela activa, si ya existe.
   *
   * Lo usa la confirmación de la importación por CSV (Tarea 14) para decidir
   * si una fila da de alta a alguien nuevo o pone al día una ficha que ya
   * existe: un correo que ya está en la escuela se actualiza, nunca se
   * duplica.
   */
  findStudentIdByEmail(email: string): Promise<string | null>;

  /**
   * Profesorado de la escuela activa, el que resuelve RLS (Tarea 8 del panel
   * web: `GET /teachers` no existía — la Tarea 7 tuvo que quedarse sin
   * selector de profesorado por eso). Si la misma persona da clase en dos
   * escuelas a la vez (caso del seed: Dan Whitfield en Atlántico y en
   * Paulista), cada escuela tiene su propia fila — son dos `teacher_profiles`
   * con `membership_id` distinto — y esta consulta solo ve la de la escuela
   * activa, sin filtrar nada a mano: RLS ya deja invisible la otra.
   */
  listTeachers(): Promise<TeacherListItem[]>;

  /** Candidatos de captación de la escuela activa, ya listos para pintar el embudo. */
  listLeads(): Promise<LeadFunnelItem[]>;
}

export const PEOPLE_READ_MODEL = Symbol("PeopleReadModel");
