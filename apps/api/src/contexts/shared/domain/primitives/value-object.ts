/**
 * Objeto de valor.
 *
 * Se identifica por lo que vale, no por quién es: dos objetos con los mismos
 * atributos son el mismo objeto. Es inmutable y se valida al construirse, de
 * modo que si existe una instancia, es válida — no hace falta comprobarlo
 * después en ningún sitio.
 */
export abstract class ValueObject<T> {
  protected constructor(protected readonly props: T) {
    Object.freeze(this);
  }

  equals(other?: ValueObject<T>): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

/**
 * Objeto de valor de un solo atributo. La mayoría lo son.
 */
export abstract class SingleValueObject<T> extends ValueObject<{ value: T }> {
  protected constructor(value: T) {
    super({ value });
  }

  get value(): T {
    return this.props.value;
  }

  override toString(): string {
    return String(this.props.value);
  }

  toJSON(): T {
    return this.props.value;
  }
}
