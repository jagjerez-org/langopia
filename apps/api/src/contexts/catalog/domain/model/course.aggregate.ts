import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { MissingDefaultTranslationError } from "../errors/catalog.errors.js";
import { CourseModality } from "./course-modality.js";
import { CourseId } from "./identifiers.js";

export type CourseTranslation = { locale: string; name: string; description: string | null };

/**
 * Curso: el programa formativo que vende la escuela.
 *
 * No conoce sus grupos ni sus matrículas — eso vive en `Group` — porque
 * cambiar el precio de catálogo de un curso no tiene por qué cargar todos
 * los grupos que lo imparten.
 */
export class Course extends AggregateRoot<CourseId> {
  private constructor(
    id: CourseId,
    private readonly _schoolId: SchoolId,
    private readonly _code: string,
    private readonly _language: string,
    private readonly _level: CefrLevel,
    private readonly _modality: CourseModality,
    private readonly _totalSessions: number,
    private readonly _sessionMinutes: number,
    private readonly _maxStudents: number,
    private readonly _priceCents: number,
    private readonly _currency: string,
    private _isActive: boolean,
    private readonly _translations: Map<string, CourseTranslation>,
  ) {
    super(id);
  }

  /**
   * Da de alta un curso nuevo.
   *
   * Dos invariantes: un curso privado es 1 a 1 —se fuerza aquí, no se
   * confía en que quien lo pida lo recuerde—, y el nombre tiene que existir
   * al menos en el idioma por defecto de la escuela, porque es el que se
   * enseña cuando nadie pidió otro.
   */
  static create(params: {
    id: CourseId;
    schoolId: SchoolId;
    code: string;
    language: string;
    level: CefrLevel;
    modality: CourseModality;
    totalSessions: number;
    sessionMinutes: number;
    maxStudents: number;
    priceCents: number;
    currency: string;
    translations: CourseTranslation[];
    schoolDefaultLocale: string;
  }): Course {
    if (!params.translations.some((t) => t.locale === params.schoolDefaultLocale)) {
      throw new MissingDefaultTranslationError(params.schoolDefaultLocale);
    }

    const maxStudents = params.modality === CourseModality.Private ? 1 : params.maxStudents;

    return new Course(
      params.id,
      params.schoolId,
      params.code,
      params.language,
      params.level,
      params.modality,
      params.totalSessions,
      params.sessionMinutes,
      maxStudents,
      params.priceCents,
      params.currency,
      true,
      new Map(params.translations.map((t) => [t.locale, t])),
    );
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: CourseId;
    schoolId: SchoolId;
    code: string;
    language: string;
    level: CefrLevel;
    modality: CourseModality;
    totalSessions: number;
    sessionMinutes: number;
    maxStudents: number;
    priceCents: number;
    currency: string;
    isActive: boolean;
    translations: CourseTranslation[];
  }): Course {
    return new Course(
      props.id,
      props.schoolId,
      props.code,
      props.language,
      props.level,
      props.modality,
      props.totalSessions,
      props.sessionMinutes,
      props.maxStudents,
      props.priceCents,
      props.currency,
      props.isActive,
      new Map(props.translations.map((t) => [t.locale, t])),
    );
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get code(): string {
    return this._code;
  }
  get language(): string {
    return this._language;
  }
  get level(): CefrLevel {
    return this._level;
  }
  get modality(): CourseModality {
    return this._modality;
  }
  get totalSessions(): number {
    return this._totalSessions;
  }
  get sessionMinutes(): number {
    return this._sessionMinutes;
  }
  get maxStudents(): number {
    return this._maxStudents;
  }
  get priceCents(): number {
    return this._priceCents;
  }
  get currency(): string {
    return this._currency;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get translations(): readonly CourseTranslation[] {
    return [...this._translations.values()];
  }
}
