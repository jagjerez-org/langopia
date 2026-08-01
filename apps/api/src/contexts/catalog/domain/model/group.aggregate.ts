import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { GroupAlreadyStartedError, GroupFullError, NegativeAgreedPriceError, StudentNotActiveError } from "../errors/catalog.errors.js";
import { GroupFull, GroupStarted, StudentEnrolledInGroup } from "../events/group.events.js";
import { Enrollment } from "./enrollment.entity.js";
import { EnrollmentStatus } from "./enrollment-status.js";
import { GroupStatus } from "./group-status.js";
import { CourseId, EnrollmentId, GroupId, StudentId, TeacherId } from "./identifiers.js";

/**
 * Grupo: la instancia concreta de un curso que se imparte en unas fechas con
 * un profesor.
 *
 * Es la raíz del agregado: sus matrículas viven dentro porque su invariante
 * central —no admitir más alumnos que `capacity`— solo se puede comprobar
 * con todas ellas a la vista a la vez. Un curso privado no es un caso
 * especial de esta regla: es la misma regla con `capacity = 1`, forzada al
 * crear el grupo (`CreateGroupHandler`, a partir de `Course.maxStudents`).
 */
export class Group extends AggregateRoot<GroupId> {
  private constructor(
    id: GroupId,
    private readonly _schoolId: SchoolId,
    private readonly _courseId: CourseId,
    private _teacherId: TeacherId | null,
    private readonly _name: string,
    private readonly _capacity: number,
    private readonly _startsOn: Date,
    private _endsOn: Date | null,
    private _status: GroupStatus,
    private readonly _enrollments: Enrollment[],
  ) {
    super(id);
  }

  static create(params: {
    id: GroupId;
    schoolId: SchoolId;
    courseId: CourseId;
    teacherId: TeacherId | null;
    name: string;
    capacity: number;
    startsOn: Date;
    endsOn?: Date | null;
  }): Group {
    return new Group(
      params.id,
      params.schoolId,
      params.courseId,
      params.teacherId,
      params.name,
      params.capacity,
      params.startsOn,
      params.endsOn ?? null,
      GroupStatus.Planned,
      [],
    );
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: GroupId;
    schoolId: SchoolId;
    courseId: CourseId;
    teacherId: TeacherId | null;
    name: string;
    capacity: number;
    startsOn: Date;
    endsOn: Date | null;
    status: GroupStatus;
    enrollments: Enrollment[];
  }): Group {
    return new Group(
      props.id,
      props.schoolId,
      props.courseId,
      props.teacherId,
      props.name,
      props.capacity,
      props.startsOn,
      props.endsOn,
      props.status,
      props.enrollments,
    );
  }

  /**
   * Matricula a un alumno.
   *
   * `studentActive` llega ya resuelto: comprobar si un alumno está de baja
   * significa preguntarle a `people` a través de `StudentStatusPort`, y un
   * agregado no hace consultas (`ARCHITECTURE.md`). Quien llama —el
   * manejador del comando— pregunta al puerto y trae aquí solo el hecho.
   */
  enrol(params: {
    enrollmentId: EnrollmentId;
    studentId: StudentId;
    studentActive: boolean;
    agreedPriceCents: number | null;
    now: Date;
  }): Enrollment {
    if (!params.studentActive) {
      throw new StudentNotActiveError(params.studentId.value);
    }
    if (params.agreedPriceCents !== null && params.agreedPriceCents < 0) {
      throw new NegativeAgreedPriceError(params.agreedPriceCents);
    }

    const activeCount = this.activeEnrollments.length;
    if (activeCount >= this._capacity) {
      throw new GroupFullError(this.id.value, this._capacity);
    }

    const enrollment = Enrollment.create({
      id: params.enrollmentId,
      groupId: this.id,
      studentId: params.studentId,
      agreedPriceCents: params.agreedPriceCents,
      now: params.now,
    });
    this._enrollments.push(enrollment);

    this.record(
      new StudentEnrolledInGroup({
        groupId: this.id.value,
        schoolId: this._schoolId.value,
        enrollmentId: enrollment.id.value,
        studentId: params.studentId.value,
      }),
    );

    // Justo la matrícula que agota la capacidad, no una comprobación aparte:
    // así el evento siempre corresponde a un cambio real de "hay hueco" a
    // "no hay hueco".
    if (activeCount + 1 === this._capacity) {
      this.record(
        new GroupFull({ groupId: this.id.value, schoolId: this._schoolId.value, capacity: this._capacity }),
      );
    }

    return enrollment;
  }

  /** Empieza a impartirse. Solo desde `planned`, y solo una vez. */
  start(now: Date): void {
    if (this._status !== GroupStatus.Planned) {
      throw new GroupAlreadyStartedError(this.id.value, this._status);
    }
    this._status = GroupStatus.Running;
    this.record(new GroupStarted({ groupId: this.id.value, schoolId: this._schoolId.value, startedAt: now }));
  }

  private get activeEnrollments(): Enrollment[] {
    return this._enrollments.filter((e) => e.status === EnrollmentStatus.Active);
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get courseId(): CourseId {
    return this._courseId;
  }
  get teacherId(): TeacherId | null {
    return this._teacherId;
  }
  get name(): string {
    return this._name;
  }
  get capacity(): number {
    return this._capacity;
  }
  get startsOn(): Date {
    return this._startsOn;
  }
  get endsOn(): Date | null {
    return this._endsOn;
  }
  get status(): GroupStatus {
    return this._status;
  }
  get enrollments(): readonly Enrollment[] {
    return this._enrollments;
  }
}
