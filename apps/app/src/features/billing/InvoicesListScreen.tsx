import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { InvoiceListItem } from "@langopia/contracts";
import { Button, EmptyState, ErrorState, Selector, Table, Chip } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatMoney } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError, getSchoolSlug } from "../../lib/api-client.js";
import { useSession } from "../auth/session.js";
import { getBillingSummary, listInvoices } from "./api.js";
import { formatInvoiceDateOnly } from "./date-only.js";
import { IssueInvoiceDialog } from "./IssueInvoiceDialog.js";

const PAGE_SIZE = 20;

const INVOICE_STATUSES = ["draft", "open", "paid", "past_due", "void", "uncollectible"] as const;

const STATUS_VARIANT: Record<(typeof INVOICE_STATUSES)[number], ChipVariant> = {
  draft: "neutral",
  open: "warning",
  paid: "success",
  past_due: "critical",
  void: "neutral",
  uncollectible: "critical",
};

/**
 * Listado de facturas (Tarea 10 del panel, Paso 1): filtro por estado y total
 * del mes.
 *
 * El filtro por estado viaja como `?status=` a `GET /billing/invoices` —lo
 * resuelve un `WHERE` en la API, no una comprobación en este componente— y el
 * total del mes sale de `GET /billing/invoices/summary`, ya sumado por la
 * API: aquí no hay ni un `+` sobre céntimos.
 *
 * `tenantCacheKey` en las claves de consulta, igual que `CalendarScreen`
 * (Tarea 9): sin ella, cambiar de escuela sin recargar la página serviría en
 * silencio las facturas cacheadas de la escuela anterior.
 */
export function InvoicesListScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const session = useSession();

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [issueOpen, setIssueOpen] = useState(false);

  const tenantCacheKey =
    session.status === "ready" ? `${session.user.id}:${getSchoolSlug() ?? ""}` : "sin-sesion";

  const summaryQuery = useQuery({
    queryKey: ["billing", "summary", tenantCacheKey],
    queryFn: getBillingSummary,
  });

  const invoicesQuery = useQuery({
    queryKey: ["billing", "invoices", tenantCacheKey, status],
    queryFn: () => listInvoices(status || undefined),
  });

  const rows = invoicesQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const columns: TableColumn<InvoiceListItem>[] = useMemo(
    () => [
      {
        key: "number",
        header: t("billing.list.columnNumber"),
        render: (row) => (
          <Link to="/facturacion/$invoiceId" params={{ invoiceId: row.invoiceId }}>
            {row.number}
          </Link>
        ),
      },
      {
        key: "billedTo",
        header: t("billing.list.columnBilledTo"),
        render: (row) => row.billedToName ?? t("billing.list.billedToPlatform"),
      },
      {
        key: "direction",
        header: t("billing.list.columnDirection"),
        render: (row) => t(`billing.direction.${row.direction}`),
      },
      {
        key: "status",
        header: t("billing.list.columnStatus"),
        render: (row) => (
          <>
            <Chip variant={STATUS_VARIANT[row.status as (typeof INVOICE_STATUSES)[number]] ?? "neutral"}>
              {t(`billing.status.${row.status}`)}
            </Chip>
            {row.hasFailedPayment && <Chip variant="critical">{t("billing.list.failedPaymentTag")}</Chip>}
          </>
        ),
      },
      {
        key: "total",
        header: t("billing.list.columnTotal"),
        numeric: true,
        render: (row) => formatMoney(row.totalCents, row.currency, locale),
      },
      {
        key: "issuedOn",
        header: t("billing.list.columnIssuedOn"),
        numeric: true,
        render: (row) => (row.issuedOn ? formatInvoiceDateOnly(row.issuedOn, locale) : "—"),
      },
      {
        key: "dueOn",
        header: t("billing.list.columnDueOn"),
        numeric: true,
        render: (row) => (row.dueOn ? formatInvoiceDateOnly(row.dueOn, locale) : "—"),
      },
    ],
    [t, locale],
  );

  const errorTitle =
    invoicesQuery.error instanceof ApiError
      ? errorMessage(invoicesQuery.error.problem)
      : t("billing.list.errorTitle");

  const monthTotal = summaryQuery.data?.monthTotal;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">{t("billing.title")}</h1>
        <Button onClick={() => setIssueOpen(true)}>{t("billing.newInvoice")}</Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <Selector
          label={t("billing.statusLabel")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
          options={INVOICE_STATUSES.map((value) => ({ value, label: t(`billing.status.${value}`) }))}
          placeholder={t("billing.statusAll")}
        />
        <div>
          <p>{t("billing.monthTotalLabel")}</p>
          <p className="text-2xl font-semibold">
            {summaryQuery.isPending && t("common.loading")}
            {summaryQuery.isError &&
              (summaryQuery.error instanceof ApiError
                ? errorMessage(summaryQuery.error.problem)
                : t("common.unexpectedError"))}
            {monthTotal && formatMoney(monthTotal.totalCents, monthTotal.currency, locale)}
          </p>
        </div>
      </div>

      <Table
        columns={columns}
        rows={pageRows}
        getRowKey={(row) => row.invoiceId}
        caption={t("billing.list.caption")}
        captionVisuallyHidden
        isLoading={invoicesQuery.isPending}
        error={
          invoicesQuery.isError ? (
            <ErrorState
              title={errorTitle}
              action={<Button onClick={() => void invoicesQuery.refetch()}>{t("common.retry")}</Button>}
            />
          ) : undefined
        }
        emptyState={
          status === "" ? (
            <EmptyState
              title={t("billing.list.emptyTitle")}
              description={t("billing.list.emptyDescription")}
              action={<Button onClick={() => setIssueOpen(true)}>{t("billing.newInvoice")}</Button>}
            />
          ) : (
            <EmptyState
              title={t("billing.list.noResultsTitle")}
              description={t("billing.list.noResultsDescription")}
            />
          )
        }
      />

      {!invoicesQuery.isPending && !invoicesQuery.isError && rows.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span>{t("billing.list.pageIndicator", { page: currentPage + 1, totalPages })}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t("billing.list.previousPage")}
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {t("billing.list.nextPage")}
            </Button>
          </div>
        </div>
      )}

      <IssueInvoiceDialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        onIssued={() => {
          void invoicesQuery.refetch();
          void summaryQuery.refetch();
          setIssueOpen(false);
        }}
      />
    </main>
  );
}
