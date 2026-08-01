import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  InvalidInvoiceLineError,
  InvalidInvoiceStateError,
  PaymentExceedsInvoiceTotalError,
  PlatformFeeNotAllowedError,
  RefundExceedsPaymentError,
} from "../errors/billing.errors.js";
import {
  InvoiceIssued,
  InvoicePaymentRecorded,
  InvoiceRefunded,
  PaymentFailed,
} from "../events/invoice.events.js";
import type { InvoiceDirection } from "./invoice-direction.js";
import { InvoiceStatus } from "./invoice-status.js";
import { InvoiceLine } from "./invoice-line.entity.js";
import type { InvoiceId, StudentId } from "./identifiers.js";
import { Money } from "./money.vo.js";
import { PlatformFee } from "./platform-fee.vo.js";

/**
 * Factura.
 *
 * Es la raíz del agregado de facturación. Sus líneas viven dentro porque el
 * total —lo único que de verdad importa aquí— solo existe mirándolas todas a
 * la vez, igual que la capacidad de `Group` solo existe mirando todas sus
 * matrículas (`catalog/domain/model/group.aggregate.ts`).
 *
 * Lo que NO está en este agregado, y por qué:
 *
 *   · `Payment` y `Refund` NO son entidades de este agregado. Son hechos que
 *     ocurren en el proveedor de pago y se registran como filas propias
 *     (`payments`, `refunds`); lo único que `Invoice` necesita para sus
 *     invariantes —no cobrar de más, no devolver de más— son dos contadores
 *     (`amountPaidCents`, `amountRefundedCents`), no la lista completa.
 *
 *   · La comisión NUNCA se recalcula. `issue()` recibe la configuración de
 *     comisión de la escuela EN ESE INSTANTE (quien llama la lee justo antes,
 *     por un puerto) y la convierte una única vez en `PlatformFee`, cuyo
 *     resultado copia a sus propios campos. Ningún método posterior vuelve a
 *     preguntar por la escuela — por eso cambiar la comisión pactada después
 *     no puede alcanzar a una factura ya emitida: no hay ningún camino de
 *     código que vuelva a leerla.
 */
export class Invoice extends AggregateRoot<InvoiceId> {
  private constructor(
    id: InvoiceId,
    private readonly _schoolId: SchoolId,
    private readonly _direction: InvoiceDirection,
    private readonly _studentId: StudentId | null,
    private readonly _billToMembershipId: MembershipId | null,
    private readonly _number: string,
    private _status: InvoiceStatus,
    private readonly _currency: string,
    private readonly _locale: string,
    private readonly _lines: InvoiceLine[],
    private readonly _taxRateBps: number,
    private readonly _subtotalCents: number,
    private readonly _taxCents: number,
    private readonly _totalCents: number,
    private readonly _applicationFeeBps: number,
    private readonly _applicationFeeCents: number,
    private readonly _issuedOn: Date,
    private readonly _dueOn: Date,
    private _paidAt: Date | null,
    private _amountPaidCents: number,
    private _amountRefundedCents: number,
    private _amountRefundPendingCents: number,
  ) {
    super(id);
  }

  /**
   * Emite una factura nueva, ya abierta.
   *
   * `fee` llega calculada por quien llama —normalmente `PlatformFee.of()`
   * con la configuración vigente de la escuela, leída a través de un puerto—
   * porque un agregado no hace consultas. Aquí solo se copia y se congela.
   */
  static issue(params: {
    id: InvoiceId;
    schoolId: SchoolId;
    direction: InvoiceDirection;
    studentId?: StudentId | null;
    billToMembershipId?: MembershipId | null;
    currency: string;
    locale: string;
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      unitCents: number;
      courseId?: string | null;
      sessionId?: string | null;
    }>;
    /** En puntos básicos. 2100 = 21%, el IVA español estándar. */
    taxRateBps: number;
    /**
     * Configuración de comisión de la escuela, leída por quien llama EN ESTE
     * INSTANTE (normalmente vía un puerto hacia `schools`). Se pasa cruda,
     * no ya convertida en `PlatformFee`, porque la comisión se calcula sobre
     * el TOTAL con impuestos — y ese total solo existe una vez sumadas las
     * líneas, un paso que solo puede dar esta función. Pedirle al llamador
     * que sumara las líneas él mismo para poder construir el `PlatformFee`
     * antes de llamar aquí sería duplicar esta misma cuenta fuera del sitio
     * que la define.
     *
     * Ignorada en `platform_to_school`: esas facturas nunca llevan comisión.
     */
    feeBps: number;
    feeCapCents?: number | null;
    feeEnabled?: boolean;
    number: string;
    issuedOn: Date;
    dueOn: Date;
  }): Invoice {
    if (params.lines.length === 0) {
      throw new InvalidInvoiceLineError("una factura necesita al menos una línea");
    }

    const lines = params.lines.map((line, index) =>
      InvoiceLine.create({ ...line, position: index + 1 }),
    );
    const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
    const taxCents = Math.round((subtotalCents * params.taxRateBps) / 10_000);
    const totalCents = subtotalCents + taxCents;

    // «Las facturas platform_to_school nunca llevan comisión»: no se
    // reescribe en silencio a cero, se rechaza — si esto se dispara es que
    // quien llama pasó una comisión que no debía pasar.
    if (params.direction === "platform_to_school" && (params.feeBps ?? 0) !== 0) {
      throw new PlatformFeeNotAllowedError(params.id.value);
    }

    const fee =
      params.direction === "platform_to_school"
        ? PlatformFee.zero()
        : PlatformFee.of({
            amount: Money.of(totalCents, params.currency),
            bps: params.feeBps,
            capCents: params.feeCapCents ?? null,
            enabled: params.feeEnabled ?? true,
          });

    const invoice = new Invoice(
      params.id,
      params.schoolId,
      params.direction,
      params.studentId ?? null,
      params.billToMembershipId ?? null,
      params.number,
      InvoiceStatus.Open,
      params.currency,
      params.locale,
      lines,
      params.taxRateBps,
      subtotalCents,
      taxCents,
      totalCents,
      fee.bps,
      fee.cents,
      params.issuedOn,
      params.dueOn,
      null,
      0,
      0,
      0,
    );

    invoice.record(
      new InvoiceIssued({
        invoiceId: params.id.value,
        schoolId: params.schoolId.value,
        direction: params.direction,
        number: params.number,
        totalCents,
        currency: params.currency,
        applicationFeeBps: fee.bps,
        applicationFeeCents: fee.cents,
      }),
    );

    return invoice;
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: InvoiceId;
    schoolId: SchoolId;
    direction: InvoiceDirection;
    studentId: StudentId | null;
    billToMembershipId: MembershipId | null;
    number: string;
    status: InvoiceStatus;
    currency: string;
    locale: string;
    lines: InvoiceLine[];
    taxRateBps: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    applicationFeeBps: number;
    applicationFeeCents: number;
    issuedOn: Date;
    dueOn: Date;
    paidAt: Date | null;
    amountPaidCents: number;
    amountRefundedCents: number;
    /**
     * Lo pedido al proveedor y todavía sin confirmar. Cuenta contra el tope de
     * lo devolvible aunque no sea firme: ver `refundableBalance`.
     */
    amountRefundPendingCents: number;
  }): Invoice {
    return new Invoice(
      props.id,
      props.schoolId,
      props.direction,
      props.studentId,
      props.billToMembershipId,
      props.number,
      props.status,
      props.currency,
      props.locale,
      props.lines,
      props.taxRateBps,
      props.subtotalCents,
      props.taxCents,
      props.totalCents,
      props.applicationFeeBps,
      props.applicationFeeCents,
      props.issuedOn,
      props.dueOn,
      props.paidAt,
      props.amountPaidCents,
      props.amountRefundedCents,
      props.amountRefundPendingCents,
    );
  }

  /**
   * ¿Procede cobrar `amount` de esta factura? Lanza si no, sin registrar nada
   * ni tocar un solo campo.
   *
   * Es el MISMO juego de reglas que aplica `markPaid()` —de hecho `markPaid()`
   * empieza llamando aquí—, expuesto aparte porque quien cobra necesita
   * saberlo ANTES de pedirle dinero de verdad a nadie: un cobro al proveedor
   * de pago no se deshace con un `ROLLBACK`. Que sea una consulta y no una
   * copia mutada es deliberado: validar mutando obliga a clonar el agregado
   * para no contaminar la fase de escritura, y ese clon es justo el tipo de
   * detalle que se olvida.
   */
  assertCanBePaid(amount: Money): void {
    if (this._status !== InvoiceStatus.Open && this._status !== InvoiceStatus.PastDue) {
      throw new InvalidInvoiceStateError(this.id.value, this._status, "registrar un cobro en");
    }

    const paidSoFar = Money.of(this._amountPaidCents, this._currency);
    const total = Money.of(this._totalCents, this._currency);
    const newAmountPaid = paidSoFar.add(amount); // lanza si la moneda no coincide

    if (newAmountPaid.isGreaterThan(total)) {
      throw new PaymentExceedsInvoiceTotalError(
        this.id.value,
        amount.cents,
        total.cents - paidSoFar.cents,
      );
    }
  }

  /**
   * Registra un cobro, total o parcial.
   *
   * No sabe nada del proveedor de pago: quien llama ya cobró (o ya recibió
   * la confirmación del webhook) y trae aquí el hecho consumado.
   */
  markPaid(params: { amount: Money; method: string; providerRef: string; now: Date }): void {
    this.assertCanBePaid(params.amount);

    const paidSoFar = Money.of(this._amountPaidCents, this._currency);
    const total = Money.of(this._totalCents, this._currency);
    const newAmountPaid = paidSoFar.add(params.amount);

    this._amountPaidCents = newAmountPaid.cents;
    if (newAmountPaid.cents === total.cents) {
      this._status = InvoiceStatus.Paid;
      this._paidAt = params.now;
    }

    this.record(
      new InvoicePaymentRecorded({
        invoiceId: this.id.value,
        schoolId: this._schoolId.value,
        amountCents: params.amount.cents,
        currency: this._currency,
        method: params.method,
        providerRef: params.providerRef,
        resultingStatus: this._status,
      }),
    );
  }

  /**
   * Registra que un intento de cobro falló, sin cambiar ningún campo de la
   * factura: sigue exactamente en el mismo estado que antes de intentarlo.
   * Solo existe para que `PaymentFailed` tenga un sitio del que salir —quien
   * llama (`RecordPaymentHandler`) ya sabe que falló por `ChargeResult`, y
   * este método es la única puerta por la que un evento puede salir de este
   * agregado (`record()` es `protected`).
   */
  recordPaymentFailure(params: {
    amountCents: number;
    failureCode: string | null;
    failureMessage: string | null;
  }): void {
    this.record(
      new PaymentFailed({
        invoiceId: this.id.value,
        schoolId: this._schoolId.value,
        amountCents: params.amountCents,
        currency: this._currency,
        failureCode: params.failureCode,
        failureMessage: params.failureMessage,
      }),
    );
  }

  /**
   * La parte de la comisión CONGELADA que corresponde a `amount` sobre el
   * total de la factura: `applicationFeeCents * amount / totalCents`.
   *
   * La usan tanto `refund()` (para revertir la parte proporcional) como quien
   * llama a `markPaid()` (para saber cuánta comisión pedirle al proveedor de
   * pago que retenga en ESTE cobro concreto, cuando la factura se paga en
   * varias veces). Es la misma regla de tres que usa el seed
   * (`SchoolBuilder.studentInvoice`), expuesta una sola vez.
   */
  proportionalFee(amount: Money): PlatformFee {
    return PlatformFee.exact(
      this._applicationFeeBps,
      this.feeSliceFrom(this._amountPaidCents, amount.cents),
    );
  }

  /**
   * El trozo de comisión que le toca a un importe que se suma a `appliedCents`
   * ya aplicados: la comisión acumulada hasta el nuevo total, menos la
   * acumulada hasta el anterior. UN SOLO redondeo, sobre el acumulado.
   *
   * Redondear cada trozo por su cuenta —`round(feeCents * amount / total)`,
   * que era lo que había— redondea DOS veces: la comisión congelada ya venía
   * redondeada al emitir. Con 1000 de total al 2,5 % (25 de comisión) y dos
   * cobros de 500, cada mitad salía a `round(12,5) = 13` y se cobraban 26
   * céntimos de una comisión de 25: un céntimo inventado. Con tres cobros de
   * 333/333/334 pasaba lo contrario, se perdía uno. Repartir sobre el
   * acumulado hace que los trozos sumen siempre exactamente la comisión
   * congelada.
   */
  private feeSliceFrom(appliedCents: number, amountCents: number): number {
    return this.feeUpTo(appliedCents + amountCents) - this.feeUpTo(appliedCents);
  }

  /** Comisión acumulada al llegar a `cumulativeCents` del total. */
  private feeUpTo(cumulativeCents: number): number {
    if (this._totalCents === 0) return 0;
    const capped = Math.min(Math.max(cumulativeCents, 0), this._totalCents);
    return Math.round((this._applicationFeeCents * capped) / this._totalCents);
  }

  /**
   * Lo que de verdad se cobró por la línea de esta sesión: su parte del total
   * CON impuestos.
   *
   * No es `InvoiceLine.totalCents`, que es ANTES de impuestos. Con una clase
   * de 100 € y un 21 % de IVA, quien paga desembolsó 121 €: devolverle 100 al
   * cancelarla es quedarse con el IVA de un servicio que no se prestó.
   *
   * Se reparte el total en proporción al subtotal de la línea en vez de
   * sumarle su IVA por separado: un único redondeo, y la suma de todas las
   * líneas vuelve a dar exactamente el total de la factura.
   *
   * `null` si esta factura no tiene ninguna línea de esa sesión.
   */
  grossAmountForSession(sessionId: string): Money | null {
    const lines = this._lines.filter((line) => line.sessionId === sessionId);
    if (lines.length === 0) return null;

    const lineCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
    if (lineCents === 0 || this._subtotalCents === 0) return Money.zero(this._currency);

    return Money.of(
      Math.round((this._totalCents * lineCents) / this._subtotalCents),
      this._currency,
    );
  }

  /**
   * ¿Procede ABRIR una devolución de `amount`? Lanza si no, sin registrar
   * nada.
   *
   * Mide contra `refundableBalance`, que descuenta también lo pedido y
   * todavía sin confirmar: una devolución `pending` es dinero ya comprometido
   * con el proveedor. Sin este descuento se podían emitir DOS devoluciones por
   * el importe total del mismo cobro —la primera se quedaba `pending`, no
   * contaba, y la segunda pasaba el tope como si nada— y devolver el doble de
   * lo cobrado.
   */
  /**
   * La parte de la comisión congelada que corresponde revertir al devolver
   * `amount`, sin registrar nada. Quien abre la devolución la necesita ANTES
   * de llamar al proveedor, para pedirle que revierta exactamente esa parte;
   * `refund()` calcula la misma cifra cuando la confirma.
   */
  refundFeeFor(amount: Money): PlatformFee {
    // Sobre lo ya devuelto, no sobre lo ya cobrado: es el mismo reparto por
    // acumulado que `proportionalFee()`, recorriendo la otra dirección del
    // dinero. Devolverlo todo a trozos revierte exactamente la comisión
    // congelada, ni un céntimo más ni uno menos.
    return PlatformFee.exact(
      this._applicationFeeBps,
      this.feeSliceFrom(this._amountRefundedCents, amount.cents),
    );
  }

  assertCanBeRefunded(amount: Money): void {
    const refundable = this.refundableBalance;
    if (amount.isGreaterThan(refundable)) {
      throw new RefundExceedsPaymentError(this.id.value, amount.cents, refundable.cents);
    }
  }

  /**
   * Devuelve, total o parcialmente, lo cobrado.
   *
   * Calcula y devuelve la parte proporcional de comisión que corresponde
   * revertir, vía `proportionalFee()`. Quien llama la usa para pedirle al
   * proveedor de pago que revierta exactamente esa parte, ni un céntimo más.
   */
  refund(params: { amount: Money; reason: string; now: Date }): { feeReversedCents: number } {
    // Contra lo FIRME (cobrado menos ya devuelto), no contra
    // `refundableBalance`: este método CONFIRMA una devolución cuyo importe ya
    // pasó por `assertCanBeRefunded()` al abrirla, y que muy probablemente
    // está contada en `_amountRefundPendingCents` (así llega desde el webhook
    // de reconciliación). Descontarla otra vez rechazaría su propia
    // confirmación.
    const alreadyRefunded = Money.of(this._amountRefundedCents, this._currency);
    const paid = Money.of(this._amountPaidCents, this._currency);
    const settledRefundable = paid.subtract(alreadyRefunded);

    if (params.amount.isGreaterThan(settledRefundable)) {
      throw new RefundExceedsPaymentError(
        this.id.value,
        params.amount.cents,
        settledRefundable.cents,
      );
    }

    const feeReversedCents = this.refundFeeFor(params.amount).cents;

    this._amountRefundedCents = alreadyRefunded.add(params.amount).cents;
    // Lo que se confirma deja de estar en el aire: si venía reservado como
    // pendiente, sale de la reserva en vez de contarse dos veces.
    this._amountRefundPendingCents = Math.max(
      0,
      this._amountRefundPendingCents - params.amount.cents,
    );

    this.record(
      new InvoiceRefunded({
        invoiceId: this.id.value,
        schoolId: this._schoolId.value,
        amountCents: params.amount.cents,
        feeReversedCents,
        currency: this._currency,
        reason: params.reason,
      }),
    );

    return { feeReversedCents };
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get direction(): InvoiceDirection {
    return this._direction;
  }
  get studentId(): StudentId | null {
    return this._studentId;
  }
  get billToMembershipId(): MembershipId | null {
    return this._billToMembershipId;
  }
  get number(): string {
    return this._number;
  }
  get status(): InvoiceStatus {
    return this._status;
  }
  get currency(): string {
    return this._currency;
  }
  get locale(): string {
    return this._locale;
  }
  get lines(): readonly InvoiceLine[] {
    return this._lines;
  }
  get taxRateBps(): number {
    return this._taxRateBps;
  }
  get subtotalCents(): number {
    return this._subtotalCents;
  }
  get taxCents(): number {
    return this._taxCents;
  }
  get totalCents(): number {
    return this._totalCents;
  }
  /** Congelada al emitir. Nunca se recalcula. */
  get applicationFeeBps(): number {
    return this._applicationFeeBps;
  }
  /** Congelada al emitir. Nunca se recalcula. */
  get applicationFeeCents(): number {
    return this._applicationFeeCents;
  }
  get issuedOn(): Date {
    return this._issuedOn;
  }
  get dueOn(): Date {
    return this._dueOn;
  }
  get paidAt(): Date | null {
    return this._paidAt;
  }
  get amountPaidCents(): number {
    return this._amountPaidCents;
  }
  get amountRefundedCents(): number {
    return this._amountRefundedCents;
  }
  /** Devoluciones pedidas al proveedor y todavía sin confirmar. */
  get amountRefundPendingCents(): number {
    return this._amountRefundPendingCents;
  }

  /**
   * Cuánto se puede devolver todavía: lo cobrado, menos lo ya devuelto, menos
   * lo pedido y sin confirmar. Nunca negativo.
   */
  get refundableBalance(): Money {
    const committed = this._amountRefundedCents + this._amountRefundPendingCents;
    const paid = this._amountPaidCents;
    return Money.of(committed >= paid ? 0 : paid - committed, this._currency);
  }

  /**
   * Cuánto queda pendiente de cobro, en la moneda de la factura.
   *
   * Vive aquí, y no como una resta suelta en el manejador del comando, por la
   * misma razón que `proportionalFee()`: es una cuenta sobre importes de
   * dinero, y esas se hacen en el dominio o no se hacen. Nunca es negativo:
   * `markPaid()` ya impide que `amountPaidCents` supere `totalCents`.
   */
  get remainingBalance(): Money {
    return Money.of(this._totalCents, this._currency).subtract(
      Money.of(this._amountPaidCents, this._currency),
    );
  }
}
