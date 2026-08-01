import { InvalidInvoiceLineError } from "../errors/billing.errors.js";

/**
 * Línea de una factura.
 *
 * No es una raíz de agregado propia —no tiene sentido pedirle nada por
 * separado de la factura que la contiene—, así que no lleva su propia clase
 * de identificador ni extiende `Entity`: es un dato inmutable con la validación
 * mínima que protege el total (`Invoice` la usa para calcular el subtotal, así
 * que una cantidad o un precio absurdos corromperían esa suma).
 */
export class InvoiceLine {
  private constructor(
    readonly id: string,
    readonly description: string,
    readonly quantity: number,
    readonly unitCents: number,
    readonly courseId: string | null,
    readonly sessionId: string | null,
    readonly position: number,
  ) {}

  static create(params: {
    id: string;
    description: string;
    quantity: number;
    unitCents: number;
    courseId?: string | null;
    sessionId?: string | null;
    position: number;
  }): InvoiceLine {
    if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
      throw new InvalidInvoiceLineError("la cantidad debe ser un entero positivo", {
        quantity: params.quantity,
      });
    }
    if (!Number.isInteger(params.unitCents) || params.unitCents < 0) {
      throw new InvalidInvoiceLineError(
        "el precio unitario debe ser un entero no negativo, en céntimos",
        { unitCents: params.unitCents },
      );
    }
    return new InvoiceLine(
      params.id,
      params.description,
      params.quantity,
      params.unitCents,
      params.courseId ?? null,
      params.sessionId ?? null,
      params.position,
    );
  }

  /** Total de la línea, en céntimos enteros: `quantity * unitCents`. */
  get totalCents(): number {
    return this.quantity * this.unitCents;
  }
}
