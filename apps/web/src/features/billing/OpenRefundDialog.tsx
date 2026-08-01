import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Button, Dialog, Input, Select } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatMoney } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { openRefund } from "./api.js";
import { parseMoneyInput } from "./money-input.js";

const REFUND_REASONS = [
  "requested_by_customer",
  "service_not_provided",
  "duplicate",
  "fraudulent",
  "goodwill",
] as const;

type FormValues = { amount: string; reason: string };

export interface OpenRefundDialogProps {
  open: boolean;
  invoiceId: string;
  currency: string;
  /** `Invoice.refundableBalance`, ya calculado por la API: el tope contra el que valida el propio envío. */
  refundableCents: number;
  onClose: () => void;
  onRefunded: (result: { refundId: string }) => void;
}

/**
 * Abrir devolución con motivo (Tarea 10 del panel, Paso 3).
 *
 * El tope de lo devolvible (`refundableCents`) lo trae la API y solo se
 * ENSEÑA aquí como ayuda (`refundableHint`); la decisión de si el importe
 * tecleado cabe la toma `RefundPaymentHandler` al recibir el envío
 * (`refund_exceeds_payment` si no). Sin proveedor de pago configurado en este
 * entorno (`STRIPE_SECRET_KEY` ausente), una devolución que sí pasa la
 * validación de la API falla igualmente al intentar hablar con el proveedor
 * —un `internal_error` genérico, ya traducido por `useErrorMessage()`—: es un
 * fallo limpio y esperado, no un error de este formulario.
 */
export function OpenRefundDialog({
  open,
  invoiceId,
  currency,
  refundableCents,
  onClose,
  onRefunded,
}: OpenRefundDialogProps): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { amount: "", reason: "" } });

  const handleClose = (): void => {
    reset({ amount: "", reason: "" });
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const amountCents = parseMoneyInput(values.amount);
    if (amountCents === null) {
      setError("amount", { message: t("billing.refund.amountInvalid") });
      return;
    }

    try {
      const result = await openRefund(invoiceId, { amountCents, reason: values.reason });
      reset({ amount: "", reason: "" });
      onRefunded({ refundId: result.refundId });
    } catch (error) {
      if (error instanceof ApiError && error.code === "refund_exceeds_payment") {
        setError("amount", { type: "server", message: describeError(error.problem) });
        return;
      }
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("billing.refund.genericError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("billing.refund.title")}
      description={t("billing.refund.refundableHint", {
        amount: formatMoney(refundableCents, currency, locale),
      })}
      closeLabel={t("billing.refund.close")}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {t("billing.refund.close")}
          </Button>
          <Button type="submit" form="open-refund-form" variant="danger" isLoading={isSubmitting}>
            {isSubmitting ? t("billing.refund.submitting") : t("billing.refund.submit")}
          </Button>
        </>
      }
    >
      <form id="open-refund-form" onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("billing.refund.amountLabel")}
          inputMode="decimal"
          required
          error={errors.amount?.message}
          {...register("amount", { required: t("billing.refund.amountRequired") })}
        />
        <Select
          label={t("billing.refund.reasonLabel")}
          required
          error={errors.reason?.message}
          placeholder={t("billing.refund.reasonLabel")}
          options={REFUND_REASONS.map((value) => ({ value, label: t(`billing.refundReason.${value}`) }))}
          {...register("reason", { required: t("billing.refund.reasonRequired") })}
        />
        {formError && (
          <p role="alert" className="text-critical">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
