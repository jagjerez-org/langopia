import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { SchoolSlug } from "./school-slug.vo.js";

export type SchoolStatus = "trial" | "active" | "past_due" | "canceled";

/** Días de prueba al registrarse. No es un parámetro de alta: es el único valor posible. */
const TRIAL_DAYS = 14;

/**
 * Plan con el que nace toda escuela autoservicio. No es un parámetro de alta
 * —`register()` no lo recibe— precisamente para que no pueda ser otro: el
 * catálogo de planes (`packages/db/src/seed/reference.ts`) lo confirma como
 * el más barato, el candidato natural a periodo de prueba.
 */
export const INITIAL_PLAN_CODE = "starter";

/**
 * Escuela = tenant. Raíz de todo lo demás (`ARCHITECTURE.md`).
 *
 * `register()` es la única puerta de alta: nace siempre en `trial`, con el
 * plan Inicial y la comisión de plataforma desactivada. Ninguno de esos tres
 * hechos es negociable por quien llama, así que ni siquiera aparecen como
 * parámetros — la forma de la firma es la que impide que se cuele un plan de
 * pago o una comisión activa el primer día.
 *
 * `ownerUserId` viaja con el agregado aunque `schools` no tenga esa columna
 * —el dueño se persiste en `memberships`, en la misma transacción, por un
 * repositorio distinto—: es la manera de que «una escuela sin dueño no puede
 * existir» sea una firma, no una promesa del manejador que la llama.
 */
export class School extends AggregateRoot<SchoolId> {
  private constructor(
    id: SchoolId,
    private readonly _slug: SchoolSlug,
    private readonly _name: string,
    private readonly _status: SchoolStatus,
    private readonly _trialEndsAt: Date,
    private readonly _ownerUserId: string,
  ) {
    super(id);
  }

  static register(props: {
    id: SchoolId;
    slug: SchoolSlug;
    name: string;
    ownerUserId: string;
    now: Date;
  }): School {
    const trialEndsAt = new Date(props.now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    return new School(props.id, props.slug, props.name, "trial", trialEndsAt, props.ownerUserId);
  }

  get slug(): SchoolSlug {
    return this._slug;
  }

  get name(): string {
    return this._name;
  }

  get status(): SchoolStatus {
    return this._status;
  }

  get trialEndsAt(): Date {
    return this._trialEndsAt;
  }

  get ownerUserId(): string {
    return this._ownerUserId;
  }
}
