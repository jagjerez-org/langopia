import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Skeleton, Table, Chip } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useT, useLocale } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate, formatMoney } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { getMyInvoices } from "./api.js";
import { useMyStudentsQuery, useSchoolTimezoneQuery } from "./hooks.js";
import { StudentSwitcher, usePortalStudentId } from "./StudentSwitcher.js";
import type { PortalInvoiceEntry } from "./types.js";

const STATUS_VARIANT: Record<string, ChipVariant> = {
  paid: "success",
  open: "warning",
  past_due: "critical",
  draft: "neutral",
  void: "neutral",
  uncollectible: "critical",
};

/**
 * `/mi/facturas` (Paso 1 del brief, verbatim): "mis facturas" del alumno o de
 * su tutor. Los importes llegan en céntimos (`totalCents`) y se formatean con
 * `Intl.NumberFormat` según la moneda que trae cada factura — nunca dividido
 * a mano (`OLA-1-WEB.md`).
 */
export function PortalInvoicesScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { studentId, setStudentId } = usePortalStudentId();
  const studentsQuery = useMyStudentsQuery();
  const timezoneQuery = useSchoolTimezoneQuery();
  const invoicesQuery = useQuery({
    queryKey: ["portal", "invoices", studentId ?? "own"] as const,
    queryFn: () => getMyInvoices(studentId),
  });

  const isPending = studentsQuery.isPending || timezoneQuery.isPending || invoicesQuery.isPending;
  const firstError = invoicesQuery.error ?? timezoneQuery.error ?? studentsQuery.error;

  if (isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (firstError) {
    const problem = firstError instanceof ApiError ? firstError.problem : null;
    return (
      <main className="p-6">
        <ErrorState
          title={problem ? errorMessage(problem) : t("portal.invoices.errorTitle")}
          action={
            <Button
              onClick={() => {
                void studentsQuery.refetch();
                void timezoneQuery.refetch();
                void invoicesQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      </main>
    );
  }

  const students = studentsQuery.data ?? [];
  const timeZone = timezoneQuery.data!.timezone;
  const invoices = invoicesQuery.data ?? [];

  const columns: TableColumn<PortalInvoiceEntry>[] = [
    { key: "number", header: t("portal.invoices.columnNumber"), render: (row) => row.number },
    {
      key: "status",
      header: t("portal.invoices.columnStatus"),
      render: (row) => (
        <Chip variant={STATUS_VARIANT[row.status] ?? "neutral"}>
          {t.has(`portal.invoices.status.${row.status}`) ? t(`portal.invoices.status.${row.status}`) : row.status}
        </Chip>
      ),
    },
    {
      key: "total",
      header: t("portal.invoices.columnTotal"),
      numeric: true,
      render: (row) => formatMoney(row.totalCents, row.currency, locale),
    },
    {
      key: "issuedOn",
      header: t("portal.invoices.columnIssuedOn"),
      numeric: true,
      render: (row) => (row.issuedOn ? formatDate(`${row.issuedOn}T00:00:00Z`, timeZone, locale, { dateStyle: "medium" }) : "—"),
    },
    {
      key: "dueOn",
      header: t("portal.invoices.columnDueOn"),
      numeric: true,
      render: (row) => (row.dueOn ? formatDate(`${row.dueOn}T00:00:00Z`, timeZone, locale, { dateStyle: "medium" }) : "—"),
    },
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("portal.invoices.title")}</h1>
      <StudentSwitcher students={students} value={studentId} onChange={setStudentId} />
      <Table
        columns={columns}
        rows={invoices}
        getRowKey={(row) => row.invoiceId}
        caption={t("portal.invoices.title")}
        captionVisuallyHidden
        emptyState={<EmptyState title={t("portal.invoices.emptyTitle")} />}
      />
    </main>
  );
}
