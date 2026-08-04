import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Panel, EmptyState, ErrorState, Input, Skeleton, Table, Chip } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { addSiteDomain, listSiteDomains } from "./api.js";
import type { SiteDomainView } from "./api.js";

const STATUS_VARIANT: Record<SiteDomainView["status"], ChipVariant> = {
  pending: "warning",
  verified: "success",
  failed: "critical",
};

export function SiteDomainsScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [hostname, setHostname] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const query = useQuery({ queryKey: ["sites", "domains"], queryFn: listSiteDomains });
  const mutation = useMutation({
    mutationFn: addSiteDomain,
    onSuccess: async () => {
      setHostname("");
      setSuccess(t("sites.domains.addSuccess"));
      await query.refetch();
    },
  });

  const columns: TableColumn<SiteDomainView>[] = [
    { key: "hostname", header: t("sites.domains.columnDomain"), render: (row) => row.hostname },
    {
      key: "status",
      header: t("sites.domains.columnStatus"),
      render: (row) => <Chip variant={STATUS_VARIANT[row.status]}>{t(`sites.domains.status.${row.status}`)}</Chip>,
    },
    {
      key: "txt",
      header: t("sites.domains.columnTxt"),
      render: (row) => (
        <div className="flex flex-col gap-2">
          <code>{row.verification.name}</code>
          <code>{row.verification.value}</code>
          {row.status === "failed" && row.failureReason && <p role="alert">{row.failureReason}</p>}
        </div>
      ),
    },
    {
      key: "tls",
      header: t("sites.domains.columnTls"),
      render: (row) => t(`sites.domains.tls.${row.tlsStatus}`),
    },
    {
      key: "actions",
      header: t("sites.domains.columnActions"),
      render: (row) => (
        <Button
          variant="secondary"
          onClick={() => void copyTxt(row).then(() => setCopySuccess(true))}
          aria-label={t("sites.domains.copyAria", { hostname: row.hostname })}
        >
          {t("sites.domains.copy")}
        </Button>
      ),
    },
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("sites.domains.title")}</h1>

      <Panel title={t("sites.domains.addTitle")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate(hostname);
          }}
        >
          <Input
            id="site-domain-hostname"
            label={t("sites.domains.hostnameLabel")}
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="academia.example.com"
          />
          <div>
            <Button type="submit" disabled={mutation.isPending || hostname.trim().length === 0}>
              {t("sites.domains.add")}
            </Button>
          </div>
          {success && <p>{success}</p>}
          {copySuccess && <p>{t("sites.domains.copySuccess")}</p>}
          {mutation.error && (
            <p role="alert">
              {mutation.error instanceof ApiError
                ? errorMessage(mutation.error.problem)
                : t("sites.domains.addError")}
            </p>
          )}
        </form>
      </Panel>

      <section className="mt-6">
        {query.isPending && (
          <>
            <p role="status">{t("common.loading")}</p>
            <Skeleton variant="text" lines={4} />
          </>
        )}

        {query.error && (
          <ErrorState
            title={query.error instanceof ApiError ? errorMessage(query.error.problem) : t("sites.domains.errorTitle")}
            action={<Button onClick={() => void query.refetch()}>{t("common.retry")}</Button>}
          />
        )}

        {!query.isPending && !query.error && (
          <Table
            caption={t("sites.domains.caption")}
            columns={columns}
            rows={query.data ?? []}
            getRowKey={(row) => row.id}
            emptyState={
              <EmptyState
                title={t("sites.domains.emptyTitle")}
                description={t("sites.domains.emptyDescription")}
              />
            }
          />
        )}
      </section>
    </main>
  );
}

async function copyTxt(domain: SiteDomainView): Promise<void> {
  await window.navigator.clipboard.writeText(txtRecordText(domain));
}

export function txtRecordText(domain: SiteDomainView): string {
  return `${domain.verification.type} ${domain.verification.name} ${domain.verification.value}`;
}
