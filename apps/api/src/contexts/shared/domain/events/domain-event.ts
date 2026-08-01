/**
 * Evento de dominio: algo que YA ha pasado, en pasado y en el lenguaje del
 * negocio («la clase se canceló»), no una orden («cancelar clase»).
 *
 * Es la vía por la que un contexto entera a los demás sin conocerlos. El que
 * lo emite no sabe quién escucha; el que escucha no puede impedir que ocurra.
 */
export abstract class DomainEvent {
  /** Nombre estable en el bus: `<contexto>.<agregado>.<hecho>`. */
  abstract readonly eventName: string;

  readonly occurredOn: Date;
  readonly aggregateId: string;
  /** La escuela en cuyo nombre ocurrió. Todo evento es de un tenant. */
  readonly schoolId: string;

  protected constructor(params: { aggregateId: string; schoolId: string; occurredOn?: Date }) {
    this.aggregateId = params.aggregateId;
    this.schoolId = params.schoolId;
    this.occurredOn = params.occurredOn ?? new Date();
  }

  /** Carga útil serializable. Nunca objetos de dominio: solo primitivos. */
  abstract payload(): Record<string, unknown>;
}
