/**
 * Modelo de lectura de programación.
 *
 * Este puerto vive en la capa de APLICACIÓN, no en el dominio, y es
 * deliberado: las consultas no cargan agregados ni aplican reglas de negocio.
 * Van a la base de datos, proyectan lo que la pantalla necesita y devuelven
 * estructuras planas.
 *
 * Es la mitad «Q» de CQRS. Cargar cincuenta agregados `ClassSession` para
 * pintar un calendario sería correcto y sería absurdo: se instancian objetos
 * con invariantes para no invocar ni una sola de ellas.
 *
 * Los tipos que devuelve son de lectura: no tienen comportamiento y nadie los
 * guarda. `AgendaEntry` y `TeacherOccupancy` viven en `@langopia/contracts`
 * (Tarea 2 del panel): es la misma forma que consume `apps/app`, así que un
 * campo que cambie aquí y no allí deja de tipar en los dos lados.
 */

export type { AgendaEntry, GroupRosterMember, TeacherOccupancy } from "@langopia/contracts";
import type { AgendaEntry, GroupRosterMember, TeacherOccupancy } from "@langopia/contracts";

export interface SchedulingReadModel {
  agendaBetween(params: {
    from: Date;
    to: Date;
    teacherId?: string;
    groupId?: string;
  }): Promise<AgendaEntry[]>;

  /** Alimenta el panel de dirección: quién va sobrado y quién va vacío. */
  teacherOccupancyBetween(params: { from: Date; to: Date }): Promise<TeacherOccupancy[]>;

  /**
   * Alumnado con matrícula activa en el grupo, con su nombre — el padrón que
   * el calendario necesita para pasar lista (Tarea 9 del panel, Paso 6).
   * Distinto de `GroupEnrollmentPort.activeStudentIds` (usado por
   * `RecordAttendanceHandler`): ese puerto solo da identificadores, porque el
   * dominio no necesita nombres para aplicar sus invariantes; esta consulta sí
   * los da, porque es exactamente lo que la pantalla necesita pintar.
   */
  rosterForGroup(groupId: string): Promise<GroupRosterMember[]>;
}

export const SCHEDULING_READ_MODEL = Symbol("SchedulingReadModel");
