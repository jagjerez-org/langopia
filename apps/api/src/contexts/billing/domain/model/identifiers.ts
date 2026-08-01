import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class InvoiceId extends Uuid {
  private constructor(value: string) {
    super(value, "factura");
  }
  static of(value: string): InvoiceId {
    return new InvoiceId(value);
  }
}

export class PaymentId extends Uuid {
  private constructor(value: string) {
    super(value, "cobro");
  }
  static of(value: string): PaymentId {
    return new PaymentId(value);
  }
}

export class RefundId extends Uuid {
  private constructor(value: string) {
    super(value, "devolución");
  }
  static of(value: string): RefundId {
    return new RefundId(value);
  }
}

/**
 * Copia propia del identificador de alumno, igual que hace `catalog` con el
 * suyo (`domain/model/identifiers.ts`): billing no importa el `StudentId` de
 * `people` ni el de `scheduling`, para no atarse a un cambio en otro contexto.
 */
export class StudentId extends Uuid {
  private constructor(value: string) {
    super(value, "alumno");
  }
  static of(value: string): StudentId {
    return new StudentId(value);
  }
}
