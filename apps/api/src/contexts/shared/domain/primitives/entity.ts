import type { DomainEvent } from "../events/domain-event.js";

/**
 * Entidad: se identifica por su identidad, no por sus atributos. Dos alumnos
 * llamados igual son alumnos distintos.
 */
export abstract class Entity<TId extends { equals(other: TId): boolean }> {
  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  equals(other?: Entity<TId>): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return this._id.equals(other._id);
  }
}

/**
 * Raíz de agregado: la única entidad del agregado con la que se habla desde
 * fuera. Garantiza sus invariantes y es la unidad de persistencia — un
 * repositorio por raíz, nunca por entidad interna.
 *
 * Acumula eventos de dominio que la capa de aplicación publica DESPUÉS de
 * confirmar la transacción. Publicarlos antes haría que otros contextos
 * reaccionaran a algo que quizá se deshaga.
 */
export abstract class AggregateRoot<
  TId extends { equals(other: TId): boolean },
> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  get hasUncommittedEvents(): boolean {
    return this._domainEvents.length > 0;
  }
}
