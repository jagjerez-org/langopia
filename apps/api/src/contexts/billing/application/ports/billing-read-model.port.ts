/**
 * Modelo de lectura de facturación.
 *
 * Igual que `SchedulingReadModel` (Tarea 9 del panel): vive en la capa de
 * APLICACIÓN, no en el dominio, porque estas consultas no cargan agregados ni
 * aplican reglas de negocio — van a la base de datos y proyectan lo que la
 * pantalla necesita. `InvoiceRepository` (dominio) sigue siendo quien carga el
 * agregado `Invoice` para comandos y para el detalle de una factura (Paso 2):
 * este puerto solo cubre lo que ese agregado no tiene sentido que sepa —el
 * nombre de a quién se factura, el listado completo de cobros y devoluciones,
 * el total facturado en un rango, el estado del comerciante— sin duplicar ni
 * un céntimo de la aritmética que ya vive en `Invoice`/`Money`/`PlatformFee`.
 *
 * Los tipos que devuelve viven en `@langopia/contracts` (Tarea 2 del panel):
 * la misma forma que consume `apps/app`.
 */

export type {
  InvoiceListItem,
  InvoiceMonthlyTotal,
  MerchantAccountStatus,
  PaymentView,
  RefundView,
} from "@langopia/contracts";
import type {
  InvoiceListItem,
  InvoiceMonthlyTotal,
  MerchantAccountStatus,
  PaymentView,
  RefundView,
} from "@langopia/contracts";

export interface BillingReadModel {
  /** Todas las facturas de la escuela activa, opcionalmente filtradas por estado. */
  listInvoices(params: { status?: string }): Promise<InvoiceListItem[]>;

  /** Total facturado (`school_to_student`, con impuestos) entre `from` (incl.) y `to` (excl.). */
  monthlyTotal(params: { from: Date; to: Date }): Promise<InvoiceMonthlyTotal>;

  /** Nombre de quien recibe la factura. `null` si `membershipId` es `null` (facturas `platform_to_school`). */
  billedToName(membershipId: string | null): Promise<string | null>;

  /** Todos los cobros de una factura, del más antiguo al más reciente. */
  paymentsForInvoice(invoiceId: string): Promise<PaymentView[]>;

  /** Todas las devoluciones de una factura (a través de sus cobros), del más antiguo al más reciente. */
  refundsForInvoice(invoiceId: string): Promise<RefundView[]>;

  /** Estado del comerciante y comisión vigente de la escuela activa (Tarea 10, Paso 4). */
  merchantStatus(): Promise<MerchantAccountStatus>;
}

export const BILLING_READ_MODEL = Symbol("BillingReadModel");
