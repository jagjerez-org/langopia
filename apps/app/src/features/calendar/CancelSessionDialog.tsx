import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type { AgendaEntry } from "@langopia/contracts";
import { Button, Dialog, Selector, Input } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { cancelSession, getCancellationPreview } from "./api.js";

type FormValues = { party: "school" | "student"; reason: string };

export interface CancelSessionDialogProps {
  open: boolean;
  session: AgendaEntry;
  onClose: () => void;
  onCancelled: (result: { refundDue: boolean }) => void;
}

/**
 * Cancelar una clase (Paso 3 del brief): antes de confirmar, muestra si la
 * cancelación generará devolución. Ese dato lo calcula la API
 * (`GET /scheduling/sessions/:id/cancellation-preview`, añadido por esta
 * misma tarea) según quién cancela; el panel solo lo enseña, nunca decide
 * plazos de aviso por su cuenta.
 */
export function CancelSessionDialog({
  open,
  session,
  onClose,
  onCancelled,
}: CancelSessionDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ defaultValues: { party: "school", reason: "" } });

  const party = watch("party");

  const preview = useQuery({
    queryKey: ["calendar", "cancellation-preview", session.sessionId, party],
    queryFn: () => getCancellationPreview(session.sessionId, party),
    enabled: open,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await cancelSession(session.sessionId, values);
      reset();
      onCancelled({ refundDue: result.refundDue });
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("common.unexpectedError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("calendar.cancelDialogTitle")}
      description={session.groupName}
      closeLabel={t("calendar.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("calendar.close")}
          </Button>
          <Button
            type="submit"
            form="cancel-session-form"
            variant="danger"
            isLoading={isSubmitting}
            disabled={!preview.isSuccess}
          >
            {isSubmitting ? t("calendar.confirmCancelSubmitting") : t("calendar.confirmCancel")}
          </Button>
        </>
      }
    >
      <form id="cancel-session-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Selector
          label={t("calendar.partyLabel")}
          options={[
            { value: "school", label: t("calendar.partySchool") },
            { value: "student", label: t("calendar.partyStudent") },
          ]}
          {...register("party")}
        />
        <Input
          label={t("calendar.reasonLabel")}
          required
          error={errors.reason?.message}
          {...register("reason", { required: t("calendar.reasonLabel"), minLength: 3 })}
        />
        <p role="status" aria-live="polite" aria-busy={preview.isPending}>
          {preview.isPending && t("common.loading")}
          {preview.isError &&
            (preview.error instanceof ApiError
              ? describeError(preview.error.problem)
              : t("common.unexpectedError"))}
          {preview.isSuccess && (
            <>
              {preview.data.refundDue ? t("calendar.refundPreviewYes") : t("calendar.refundPreviewNo")}{" "}
              {t("calendar.noticeHoursInfo", { hours: Math.round(preview.data.noticeHours * 10) / 10 })}
            </>
          )}
        </p>
        {preview.isError && (
          <Button variant="ghost" size="sm" onClick={() => void preview.refetch()}>
            {t("common.retry")}
          </Button>
        )}
        {formError && <p role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}
