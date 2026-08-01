import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button, Dialog, Input, Select } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getBillingTargets, issueInvoice, listStudentsForBilling } from "./api.js";
import { parseMoneyInput } from "./money-input.js";

type FormValues = {
  studentId: string;
  billToMembershipId: string;
  description: string;
  quantity: string;
  unitAmount: string;
  taxRatePercent: string;
  dueOn: string;
};

export interface IssueInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onIssued: (result: { invoiceId: string; number: string }) => void;
}

const DEFAULT_VALUES: FormValues = {
  studentId: "",
  billToMembershipId: "",
  description: "",
  quantity: "1",
  unitAmount: "",
  taxRatePercent: "21",
  dueOn: "",
};

/**
 * Emitir factura (Tarea 10 del panel, Paso 3).
 *
 * Solo `direction: "school_to_student"`: la factura de la suscripción de la
 * escuela a Langopia (`platform_to_school`) la emite la plataforma, no quien
 * dirige una academia desde este formulario.
 *
 * "Facturar a" distingue entre el propio alumno (adulto) y su(s) tutor(es)
 * legal(es) (menor) —la misma regla que documenta `Invoice.billToMembershipId`
 * en el dominio—, resuelto con `getBillingTargets` (mismo endpoint RGPD que ya
 * usa la ficha de alumnado, Tarea 7).
 *
 * El total, el IVA y la comisión de plataforma los calcula y devuelve la API
 * al confirmar (`IssueInvoiceHandler`): este formulario no pinta ningún
 * importe compuesto mientras se rellena, para no repetir esa cuenta aquí.
 */
export function IssueInvoiceDialog({ open, onClose, onIssued }: IssueInvoiceDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: DEFAULT_VALUES });

  const studentsQuery = useQuery({
    queryKey: ["billing", "students-for-issue"],
    queryFn: listStudentsForBilling,
    enabled: open,
  });

  const studentId = watch("studentId");
  const selectedStudent = studentsQuery.data?.find((s) => s.studentId === studentId);

  const targetsQuery = useQuery({
    queryKey: ["billing", "issue-targets", selectedStudent?.membershipId],
    queryFn: () => getBillingTargets(selectedStudent!.membershipId, selectedStudent!.name),
    enabled: Boolean(selectedStudent),
  });

  // Preselecciona "facturar a" en cuanto se conoce el destinatario (o los
  // destinatarios) del alumno elegido: con uno solo —el caso más común, un
  // alumno adulto— no obliga a un segundo clic redundante.
  useEffect(() => {
    if (targetsQuery.data && targetsQuery.data.length > 0) {
      setValue("billToMembershipId", targetsQuery.data[0]!.membershipId);
    }
  }, [targetsQuery.data, setValue]);

  const handleClose = (): void => {
    reset(DEFAULT_VALUES);
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const quantity = Number.parseInt(values.quantity, 10);
    const unitCents = parseMoneyInput(values.unitAmount);
    const taxRatePercent = Number.parseFloat(values.taxRatePercent);

    if (unitCents === null) {
      setFormError(t("billing.issue.lineUnitAmountInvalid"));
      return;
    }

    try {
      const result = await issueInvoice({
        studentId: values.studentId,
        billToMembershipId: values.billToMembershipId,
        lines: [{ description: values.description, quantity, unitCents }],
        taxRateBps: Math.round(taxRatePercent * 100),
        dueOn: `${values.dueOn}T00:00:00.000Z`,
      });
      reset(DEFAULT_VALUES);
      onIssued({ invoiceId: result.invoiceId, number: result.number });
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("billing.issue.genericError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("billing.issue.title")}
      closeLabel={t("billing.issue.close")}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {t("billing.issue.close")}
          </Button>
          <Button type="submit" form="issue-invoice-form" isLoading={isSubmitting}>
            {isSubmitting ? t("billing.issue.submitting") : t("billing.issue.submit")}
          </Button>
        </>
      }
    >
      <form id="issue-invoice-form" onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Select
          label={t("billing.issue.studentLabel")}
          required
          isLoading={studentsQuery.isPending}
          error={errors.studentId?.message}
          placeholder={t("billing.issue.studentPlaceholder")}
          options={(studentsQuery.data ?? []).map((student) => ({
            value: student.studentId,
            label: student.name,
          }))}
          {...register("studentId", { required: t("billing.issue.studentRequired") })}
        />
        <Select
          label={t("billing.issue.billToLabel")}
          required
          isLoading={targetsQuery.isFetching}
          error={errors.billToMembershipId?.message}
          disabled={!selectedStudent}
          placeholder={t("billing.issue.billToPlaceholder")}
          options={(targetsQuery.data ?? []).map((target) => ({
            value: target.membershipId,
            label: target.name,
          }))}
          {...register("billToMembershipId", { required: t("billing.issue.billToRequired") })}
        />
        <Input
          label={t("billing.issue.lineDescriptionLabel")}
          required
          error={errors.description?.message}
          {...register("description", { required: t("billing.issue.lineDescriptionRequired") })}
        />
        <Input
          label={t("billing.issue.lineQuantityLabel")}
          type="number"
          min={1}
          step={1}
          required
          error={errors.quantity?.message}
          {...register("quantity", { required: true, min: 1 })}
        />
        <Input
          label={t("billing.issue.lineUnitAmountLabel")}
          inputMode="decimal"
          required
          error={errors.unitAmount?.message}
          {...register("unitAmount", { required: t("billing.issue.lineUnitAmountRequired") })}
        />
        <Input
          label={t("billing.issue.taxRateLabel")}
          hint={t("billing.issue.taxRateHint")}
          type="number"
          min={0}
          max={100}
          step="0.01"
          required
          error={errors.taxRatePercent?.message}
          {...register("taxRatePercent", { required: true, min: 0, max: 100 })}
        />
        <Input
          label={t("billing.issue.dueOnLabel")}
          type="date"
          required
          error={errors.dueOn?.message}
          {...register("dueOn", { required: t("billing.issue.dueOnRequired") })}
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
