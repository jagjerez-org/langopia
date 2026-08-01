import type {
  InvoiceDetail,
  InvoiceListItem,
  InvoiceMonthlyTotal,
  MerchantAccountStatus,
  SchoolTimezone,
} from "@langopia/contracts";
import { api } from "../../lib/api-client.js";

export type {
  InvoiceDetail,
  InvoiceLineView,
  InvoiceListItem,
  InvoiceMonthlyTotal,
  MerchantAccountStatus,
  PaymentView,
  RefundView,
} from "@langopia/contracts";

/**
 * Cliente HTTP de la Tarea 10 (Facturación), sobre el cliente compartido
 * (`apps/web/src/lib/api-client.ts`): mismo manejo de errores tipados, misma
 * cabecera `Accept-Language`, misma cabecera `x-school-slug`.
 *
 * `listInvoices`, `getBillingSummary`, `getInvoiceDetail` y `getMerchantStatus`
 * consumen los cuatro `GET` que esta misma tarea añadió a `BillingController`
 * (`apps/api/.../billing/infrastructure/http/billing.controller.ts`): antes
 * de esta tarea, el contexto de facturación no exponía NINGUNA consulta, solo
 * los tres comandos (emitir, cobrar, devolver) que ya existían.
 *
 * Sin lógica propia: cada función traduce uno a uno un endpoint ya construido
 * — ni un `+`/`*` sobre céntimos en todo este fichero.
 */

export function listInvoices(status?: string): Promise<InvoiceListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<InvoiceListItem[]>(`/billing/invoices${query}`);
}

export function getBillingSummary(): Promise<{ monthTotal: InvoiceMonthlyTotal }> {
  return api.get<{ monthTotal: InvoiceMonthlyTotal }>("/billing/invoices/summary");
}

export function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
  return api.get<InvoiceDetail>(`/billing/invoices/${invoiceId}`);
}

export function getMerchantStatus(): Promise<MerchantAccountStatus> {
  return api.get<MerchantAccountStatus>("/billing/merchant/status");
}

/**
 * Zona horaria de la escuela activa (`GET /scheduling/school-timezone`,
 * Tarea 9). `paidAt` y las fechas de cobros/devoluciones son instantes de
 * verdad (`timestamptz`), a diferencia de `issuedOn`/`dueOn`
 * (`date-only.ts`), y `OLA-1-WEB.md` exige mostrarlos en la zona de la
 * escuela, nunca la del navegador. Se pide aquí en vez de importar el `api.ts`
 * de `calendar` (Tarea 9): cada pantalla del panel declara su propio cliente
 * sobre el mismo endpoint, igual que ya hacen `dashboard` y `calendar` entre
 * sí sin importarse una a otra.
 */
export function getSchoolTimezone(): Promise<SchoolTimezone> {
  return api.get<SchoolTimezone>("/scheduling/school-timezone");
}

export type IssueInvoiceLineInput = {
  description: string;
  quantity: number;
  /** Céntimos enteros — la conversión desde el importe tecleado ocurre en el formulario, al enviar. */
  unitCents: number;
};

export type IssueInvoiceInput = {
  studentId: string;
  billToMembershipId: string;
  lines: IssueInvoiceLineInput[];
  taxRateBps: number;
  dueOn: string;
};

export type IssueInvoiceResult = {
  invoiceId: string;
  number: string;
  totalCents: number;
  currency: string;
  applicationFeeBps: number;
  applicationFeeCents: number;
};

/**
 * Emite una factura `school_to_student` (Tarea 10, Paso 3). La pantalla no
 * ofrece emitir `platform_to_school` —la suscripción de la escuela a
 * Langopia—: esa la emite la plataforma, no quien dirige una academia.
 */
export function issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
  return api.post<IssueInvoiceResult>("/billing/invoices", {
    direction: "school_to_student",
    studentId: input.studentId,
    billToMembershipId: input.billToMembershipId,
    lines: input.lines,
    taxRateBps: input.taxRateBps,
    dueOn: input.dueOn,
  });
}

export type OpenRefundInput = {
  amountCents: number;
  reason: string;
};

export type OpenRefundResult = {
  refundId: string;
  status: string;
  feeReversedCents: number;
  receiptNumber: string | null;
};

/**
 * Abre una devolución con motivo (Tarea 10, Paso 3). `idempotencyKey` se
 * genera aquí, una por envío: si el mismo clic se reintentara (doble clic,
 * reintento de red), el proveedor de pago —cuando haya credenciales— la
 * trataría como la misma operación, no como una segunda devolución.
 */
export function openRefund(invoiceId: string, input: OpenRefundInput): Promise<OpenRefundResult> {
  return api.post<OpenRefundResult>(`/billing/invoices/${invoiceId}/refunds`, {
    amountCents: input.amountCents,
    reason: input.reason,
    idempotencyKey: crypto.randomUUID(),
  });
}

export type StartMerchantOnboardingResult = { onboardingUrl: string };

/** Paso 4: alta (o continuación) del trámite de verificación del comerciante. */
export function startMerchantOnboarding(input: {
  returnUrl: string;
  refreshUrl: string;
}): Promise<StartMerchantOnboardingResult> {
  return api.post<StartMerchantOnboardingResult>("/billing/merchant/onboarding", input);
}

/* ─── Alumnado y destinatario, para "Emitir factura" ─────────────────────── */

export type StudentOption = {
  studentId: string;
  membershipId: string;
  name: string;
  guardianRequired: boolean;
};

/** `GET /students` (`people`, Tarea 7): el mismo listado que alimenta `/alumnos`. */
export function listStudentsForBilling(): Promise<StudentOption[]> {
  return api.get<StudentOption[]>("/students");
}

export type BillingTargetOption = {
  membershipId: string;
  name: string;
};

/** Recorte de `PersonalDataExport` (`iam`, Tarea 15, RGPD): solo lo que necesita el destinatario de la factura. */
type StudentExportSlim = {
  student: { guardians: { membershipId: string; name: string }[] } | null;
};

/**
 * A quién se le puede facturar un alumno: él mismo si es adulto, o su(s)
 * tutor(es) legal(es) si es menor —"quién recibe la factura", la misma
 * distinción que documenta `Invoice.billToMembershipId` en el dominio.
 *
 * Reutiliza `GET /people/:membershipId/export` (Tarea 15, RGPD), el mismo
 * endpoint que ya alimenta la pestaña "Facturas" de la ficha de alumnado
 * (Tarea 7): es el único sitio que ya cruza tutores legales con su nombre, y
 * añadir un segundo endpoint para lo mismo sería duplicar esa consulta.
 */
export async function getBillingTargets(
  studentMembershipId: string,
  studentName: string,
): Promise<BillingTargetOption[]> {
  const data = await api.get<StudentExportSlim>(`/people/${studentMembershipId}/export`);
  const guardians = data.student?.guardians ?? [];
  return guardians.length > 0
    ? guardians.map((guardian) => ({ membershipId: guardian.membershipId, name: guardian.name }))
    : [{ membershipId: studentMembershipId, name: studentName }];
}
