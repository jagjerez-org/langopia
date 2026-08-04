import { useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, ErrorState, Skeleton, Tag } from "../../ui/index.js";
import type { TagVariant } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getMerchantStatus, startMerchantOnboarding } from "./api.js";

const STATUS_VARIANT: Record<string, TagVariant> = {
  not_started: "neutral",
  pending: "warning",
  active: "success",
  restricted: "critical",
  disabled: "critical",
};

/**
 * Conexión con el proveedor de pago (Tarea 10 del panel, Paso 4).
 *
 * Dos mensajes que tienen que convivir sin contradecirse: el producto entero
 * se puede usar sin conectar (Nordwind, en el seed, factura y opera sin
 * cuenta conectada), y conectar desbloquea el cobro y la devolución
 * automáticos. Ninguno de los dos se calcula aquí: el estado viene de
 * `GET /billing/merchant/status`, y qué se desbloquea es texto fijo del
 * catálogo, no una regla.
 *
 * Sin credenciales del proveedor en este entorno (`STRIPE_SECRET_KEY`
 * ausente), pulsar "Conectar" falla de forma limpia con un `internal_error`
 * genérico —el mismo camino que documenta `saneamiento-ola-1-dinero.md`—, no
 * con una pantalla rota.
 */
export function StripeConnectionScreen(): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["billing", "merchant-status"],
    queryFn: getMerchantStatus,
  });

  const handleConnect = async (): Promise<void> => {
    setConnectError(null);
    setConnecting(true);
    try {
      const origin = window.location.origin;
      const result = await startMerchantOnboarding({
        returnUrl: `${origin}/ajustes/cobros`,
        refreshUrl: `${origin}/ajustes/cobros`,
      });
      window.location.assign(result.onboardingUrl);
    } catch (error) {
      setConnectError(
        error instanceof ApiError ? describeError(error.problem) : t("billing.connect.genericError"),
      );
    } finally {
      setConnecting(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">{t("billing.connect.title")}</h1>
      <p className="mb-4">{t("billing.connect.subtitle")}</p>

      <Card title={t("billing.connect.usableWithoutConnectingTitle")}>
        <p>{t("billing.connect.usableWithoutConnectingDescription")}</p>
      </Card>

      <Card title={t("billing.connect.unlocksTitle")}>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>{t("billing.connect.unlockCharge")}</li>
          <li>{t("billing.connect.unlockReceipts")}</li>
          <li>{t("billing.connect.unlockRefunds")}</li>
        </ul>
      </Card>

      <Card title={t("billing.connect.statusLabel")}>
        {statusQuery.isPending && (
          <>
            <p role="status">{t("common.loading")}</p>
            <Skeleton variant="rect" height="4rem" />
          </>
        )}
        {statusQuery.isError && (
          <ErrorState
            title={
              statusQuery.error instanceof ApiError
                ? describeError(statusQuery.error.problem)
                : t("billing.connect.errorTitle")
            }
            action={<Button variant="secondary" onClick={() => void statusQuery.refetch()}>{t("common.retry")}</Button>}
          />
        )}
        {statusQuery.data && (
          <>
            <Tag variant={STATUS_VARIANT[statusQuery.data.merchantStatus] ?? "neutral"}>
              {t(`billing.merchantStatus.${statusQuery.data.merchantStatus}`)}
            </Tag>
            <p>
              {statusQuery.data.applicationFeeEnabled && statusQuery.data.applicationFeeBps > 0
                ? t("billing.connect.feeSummaryEnabled", { rate: statusQuery.data.applicationFeeBps / 100 })
                : t("billing.connect.feeSummaryDisabled")}
            </p>
            {(statusQuery.data.merchantStatus === "not_started" ||
              statusQuery.data.merchantStatus === "pending" ||
              statusQuery.data.merchantStatus === "restricted") && (
              <Button onClick={() => void handleConnect()} isLoading={connecting}>
                {connecting
                  ? t("billing.connect.connecting")
                  : statusQuery.data.merchantStatus === "not_started"
                    ? t("billing.connect.connectAction")
                    : t("billing.connect.reviewAction")}
              </Button>
            )}
            {connectError && (
              <p role="alert" className="text-critical">
                {connectError}
              </p>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
