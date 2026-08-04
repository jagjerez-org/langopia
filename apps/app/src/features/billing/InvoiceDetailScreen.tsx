import { useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { PaymentView, RefundView } from "@langopia/contracts";
import { Button, Card, EmptyState, ErrorState, Skeleton, Table, Tag, useToast } from "../../ui/index.js";
import type { TableColumn, TagVariant } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate, formatMoney } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getInvoiceDetail, getSchoolTimezone } from "./api.js";
import { formatInvoiceDateOnly } from "./date-only.js";
import { OpenRefundDialog } from "./OpenRefundDialog.js";

const STATUS_VARIANT: Record<string, TagVariant> = {
  draft: "neutral",
  open: "warning",
  paid: "success",
  past_due: "critical",
  void: "neutral",
  uncollectible: "critical",
};

const PAYMENT_STATUS_VARIANT: Record<string, TagVariant> = {
  pending: "warning",
  succeeded: "success",
  failed: "critical",
  refunded: "neutral",
  partially_refunded: "warning",
};

const REFUND_STATUS_VARIANT: Record<string, TagVariant> = {
  pending: "warning",
  succeeded: "success",
  failed: "critical",
  canceled: "neutral",
};

/**
 * Detalle de una factura (Tarea 10 del panel, Paso 2): líneas, cobros,
 * devoluciones y la comisión de plataforma desglosada —la escuela tiene
 * derecho a ver qué se le retiene.
 *
 * Cada importe que se pinta aquí es el que trae `GET /billing/invoices/:id`
 * tal cual (`InvoiceDetail`, `@langopia/contracts`): subtotal, IVA, total,
 * comisión, pendiente de cobro y disponible para devolver los calcula la API
 * (`Invoice`, saneado en la auditoría de la ola); este componente solo llama
 * a `formatMoney` sobre céntimos que ya vienen hechos, nunca suma ni resta
 * dos entre sí.
 *
 * `issuedOn`/`dueOn` van en UTC a propósito (`formatInvoiceDateOnly`, Paso 1);
 * `paidAt` y las fechas de cobros/devoluciones van en la zona horaria de la
 * escuela (`GET /scheduling/school-timezone`), porque sí son un instante real.
 */
export function InvoiceDetailScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const { showToast } = useToast();
  const { invoiceId } = useParams({ strict: false }) as { invoiceId?: string };
  const [refundOpen, setRefundOpen] = useState(false);

  const timezoneQuery = useQuery({
    queryKey: ["billing", "school-timezone"],
    queryFn: getSchoolTimezone,
  });

  const detailQuery = useQuery({
    queryKey: ["billing", "invoice", invoiceId],
    queryFn: () => getInvoiceDetail(invoiceId!),
    enabled: Boolean(invoiceId),
  });

  if (!invoiceId) return <></>; // inalcanzable: la ruta exige el parámetro.

  if (detailQuery.isPending || timezoneQuery.isPending) {
    return (
      <main className="p-6" aria-busy="true">
        <p role="status">{t("billing.detail.loadingTitle")}</p>
        <Skeleton variant="rect" height="20rem" />
      </main>
    );
  }

  if (detailQuery.isError || timezoneQuery.isError) {
    const error = detailQuery.error ?? timezoneQuery.error;
    const isNotFound = error instanceof ApiError && error.code === "not_found";
    return (
      <main className="p-6">
        <ErrorState
          title={
            isNotFound
              ? t("billing.detail.notFoundTitle")
              : error instanceof ApiError
                ? describeError(error.problem)
                : t("billing.detail.errorTitle")
          }
          action={
            isNotFound ? undefined : (
              <Button
                variant="secondary"
                onClick={() => {
                  void detailQuery.refetch();
                  void timezoneQuery.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
        <p className="mt-4">
          <Link to="/facturacion">{t("billing.detail.backToList")}</Link>
        </p>
      </main>
    );
  }

  const invoice = detailQuery.data;
  const timeZone = timezoneQuery.data.timezone;

  const formatInstant = (isoUtc: string): string => formatDate(isoUtc, timeZone, locale, { dateStyle: "medium", timeStyle: "short" });

  const paymentColumns: TableColumn<PaymentView>[] = [
    { key: "date", header: t("billing.detail.columnPaymentDate"), render: (row) => formatInstant(row.createdAt) },
    { key: "method", header: t("billing.detail.columnPaymentMethod"), render: (row) => t(`billing.paymentMethod.${row.method}`) },
    {
      key: "status",
      header: t("billing.detail.columnPaymentStatus"),
      render: (row) => (
        <>
          <Tag variant={PAYMENT_STATUS_VARIANT[row.status] ?? "neutral"}>
            {t(`billing.paymentStatus.${row.status}`)}
          </Tag>
          {row.failureMessage && (
            <p>{t("billing.detail.paymentFailureReason", { message: row.failureMessage })}</p>
          )}
        </>
      ),
    },
    {
      key: "amount",
      header: t("billing.detail.columnPaymentAmount"),
      numeric: true,
      render: (row) => formatMoney(row.amountCents, row.currency, locale),
    },
    {
      key: "fee",
      header: t("billing.detail.columnPaymentFee"),
      numeric: true,
      render: (row) => formatMoney(row.applicationFeeCents, row.currency, locale),
    },
  ];

  const refundColumns: TableColumn<RefundView>[] = [
    { key: "date", header: t("billing.detail.columnRefundDate"), render: (row) => formatInstant(row.createdAt) },
    { key: "reason", header: t("billing.detail.columnRefundReason"), render: (row) => t(`billing.refundReason.${row.reason}`) },
    {
      key: "status",
      header: t("billing.detail.columnRefundStatus"),
      render: (row) => (
        <Tag variant={REFUND_STATUS_VARIANT[row.status] ?? "neutral"}>{t(`billing.refundStatus.${row.status}`)}</Tag>
      ),
    },
    {
      key: "amount",
      header: t("billing.detail.columnRefundAmount"),
      numeric: true,
      render: (row) => formatMoney(row.amountCents, row.currency, locale),
    },
    {
      key: "fee",
      header: t("billing.detail.columnRefundFee"),
      numeric: true,
      render: (row) => formatMoney(row.applicationFeeReversedCents, row.currency, locale),
    },
  ];

  return (
    <main className="p-6">
      <p>
        <Link to="/facturacion">{t("billing.detail.backToList")}</Link>
      </p>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{invoice.number}</h1>
        <Tag variant={STATUS_VARIANT[invoice.status] ?? "neutral"}>{t(`billing.status.${invoice.status}`)}</Tag>
      </div>

      <Card title={t("billing.detail.numberLabel")}>
        <dl className="grid grid-cols-2 gap-2">
          <dt>{t("billing.detail.directionLabel")}</dt>
          <dd>{t(`billing.direction.${invoice.direction}`)}</dd>
          <dt>{t("billing.detail.billedToLabel")}</dt>
          <dd>{invoice.billedToName ?? t("billing.list.billedToPlatform")}</dd>
          <dt>{t("billing.detail.issuedOnLabel")}</dt>
          <dd>{invoice.issuedOn ? formatInvoiceDateOnly(invoice.issuedOn, locale) : "—"}</dd>
          <dt>{t("billing.detail.dueOnLabel")}</dt>
          <dd>{invoice.dueOn ? formatInvoiceDateOnly(invoice.dueOn, locale) : "—"}</dd>
          <dt>{t("billing.detail.paidAtLabel")}</dt>
          <dd>{invoice.paidAt ? formatInstant(invoice.paidAt) : t("billing.detail.notPaidYet")}</dd>
        </dl>
      </Card>

      <Card title={t("billing.detail.linesTitle")}>
        <Table
          columns={[
            { key: "description", header: t("billing.detail.columnDescription"), render: (row) => row.description },
            { key: "quantity", header: t("billing.detail.columnQuantity"), numeric: true, render: (row) => String(row.quantity) },
            {
              key: "unitPrice",
              header: t("billing.detail.columnUnitPrice"),
              numeric: true,
              render: (row) => formatMoney(row.unitCents, invoice.currency, locale),
            },
            {
              key: "total",
              header: t("billing.detail.columnLineTotal"),
              numeric: true,
              render: (row) => formatMoney(row.totalCents, invoice.currency, locale),
            },
          ]}
          rows={invoice.lines}
          getRowKey={(row) => row.id}
          caption={t("billing.detail.linesTitle")}
          captionVisuallyHidden
        />
        <dl className="grid grid-cols-2 gap-2 mt-4">
          <dt>{t("billing.detail.subtotalLabel")}</dt>
          <dd>{formatMoney(invoice.subtotalCents, invoice.currency, locale)}</dd>
          <dt>{t("billing.detail.taxLabel", { rate: invoice.taxRateBps / 100 })}</dt>
          <dd>{formatMoney(invoice.taxCents, invoice.currency, locale)}</dd>
          <dt>{t("billing.detail.totalLabel")}</dt>
          <dd className="font-semibold">{formatMoney(invoice.totalCents, invoice.currency, locale)}</dd>
        </dl>
      </Card>

      <Card title={t("billing.detail.feeTitle")}>
        {invoice.applicationFeeCents === 0 && invoice.applicationFeeBps === 0 ? (
          <p>{t("billing.detail.feeNoneHint")}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2">
            <dt>{t("billing.detail.feeRateLabel")}</dt>
            <dd>{invoice.applicationFeeBps / 100}%</dd>
            <dt>{t("billing.detail.feeAmountLabel")}</dt>
            <dd>{formatMoney(invoice.applicationFeeCents, invoice.currency, locale)}</dd>
          </dl>
        )}
      </Card>

      <Card title={t("billing.detail.remainingLabel")}>
        <dl className="grid grid-cols-2 gap-2">
          <dt>{t("billing.detail.remainingLabel")}</dt>
          <dd>{formatMoney(invoice.remainingCents, invoice.currency, locale)}</dd>
          <dt>{t("billing.detail.refundableLabel")}</dt>
          <dd>{formatMoney(invoice.refundableCents, invoice.currency, locale)}</dd>
        </dl>
        {invoice.refundableCents > 0 && (
          <Button variant="secondary" onClick={() => setRefundOpen(true)}>
            {t("billing.detail.openRefundAction")}
          </Button>
        )}
      </Card>

      <Card
        title={t("billing.detail.paymentsTitle")}
        actions={undefined}
      >
        <Table
          columns={paymentColumns}
          rows={invoice.payments}
          getRowKey={(row) => row.paymentId}
          caption={t("billing.detail.paymentsTitle")}
          captionVisuallyHidden
          emptyState={<EmptyState title={t("billing.detail.paymentsEmptyTitle")} />}
        />
      </Card>

      <Card title={t("billing.detail.refundsTitle")}>
        <Table
          columns={refundColumns}
          rows={invoice.refunds}
          getRowKey={(row) => row.refundId}
          caption={t("billing.detail.refundsTitle")}
          captionVisuallyHidden
          emptyState={<EmptyState title={t("billing.detail.refundsEmptyTitle")} />}
        />
      </Card>

      <OpenRefundDialog
        open={refundOpen}
        invoiceId={invoice.invoiceId}
        currency={invoice.currency}
        refundableCents={invoice.refundableCents}
        onClose={() => setRefundOpen(false)}
        onRefunded={() => {
          setRefundOpen(false);
          void detailQuery.refetch();
          showToast({ variant: "success", title: t("billing.refund.success") });
        }}
      />
    </main>
  );
}
