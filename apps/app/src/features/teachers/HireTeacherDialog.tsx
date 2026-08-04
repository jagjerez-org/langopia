import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Button, Dialog, Input, Selector } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { hireTeacher } from "./api.js";
import type { TeacherTier } from "./types.js";

const TIERS: TeacherTier[] = ["community", "professional", "specialist"];

/** Suficiente para rechazar lo obviamente mal escrito, igual que `LoginScreen`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormValues = {
  name: string;
  email: string;
  tier: TeacherTier;
  hourlyRateCents: string;
  contractedHoursPerWeek: string;
  hiredAt: string;
};

export interface HireTeacherDialogProps {
  open: boolean;
  onClose: () => void;
  onHired: () => void;
}

/**
 * Alta de profesor (Tarea 13 del panel: recorrido de Playwright).
 *
 * `POST /teachers` ya existía —Tarea 13 del backend— desde antes de que
 * hubiera panel: la Tarea 8 (Profesorado, cursos y grupos) decidió a
 * propósito no construirle pantalla («Decisión 3» de su informe, el brief
 * solo pedía listado y ficha). Montar el recorrido completo de la ola
 * («dar de alta un profesor con disponibilidad», verbatim del brief de esta
 * tarea) demostró que ese hueco de verdad bloquea a quien no ha visto el
 * producto: sin esta pantalla, no hay forma de contratar profesorado sin
 * salir del panel. Arreglo pequeño y claro, mismo patrón exacto que
 * `CreateGroupDialog` (Tarea 8): un diálogo, un formulario, un POST.
 */
export function HireTeacherDialog({ open, onClose, onHired }: HireTeacherDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
      tier: "professional",
      hourlyRateCents: "",
      contractedHoursPerWeek: "",
      hiredAt: "",
    },
  });

  const handleClose = (): void => {
    reset();
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await hireTeacher({
        name: values.name,
        email: values.email,
        tier: values.tier,
        hourlyRateCents: Number(values.hourlyRateCents),
        contractedHoursPerWeek: Number(values.contractedHoursPerWeek),
        hiredAt: values.hiredAt,
      });
      reset();
      onHired();
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("teachers.create.genericError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("teachers.create.title")}
      closeLabel={t("teachers.create.close")}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {t("teachers.create.close")}
          </Button>
          <Button type="submit" form="hire-teacher-form" isLoading={isSubmitting}>
            {isSubmitting ? t("teachers.create.submitting") : t("teachers.create.submit")}
          </Button>
        </>
      }
    >
      <form id="hire-teacher-form" onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("teachers.create.nameLabel")}
          required
          error={errors.name?.message}
          {...register("name", { required: t("teachers.create.nameRequired") })}
        />
        <Input
          label={t("teachers.create.emailLabel")}
          type="email"
          required
          error={errors.email?.message}
          {...register("email", {
            required: t("teachers.create.emailRequired"),
            pattern: { value: EMAIL_PATTERN, message: t("teachers.create.emailInvalid") },
          })}
        />
        <Selector
          label={t("teachers.create.tierLabel")}
          options={TIERS.map((value) => ({ value, label: t(`teachers.tier.${value}`) }))}
          {...register("tier")}
        />
        <Input
          label={t("teachers.create.hourlyRateLabel")}
          hint={t("teachers.create.hourlyRateHint")}
          type="number"
          min={1}
          step={1}
          required
          error={errors.hourlyRateCents?.message}
          {...register("hourlyRateCents", { required: t("teachers.create.hourlyRateRequired") })}
        />
        <Input
          label={t("teachers.create.contractedHoursLabel")}
          hint={t("teachers.create.contractedHoursHint")}
          type="number"
          min={1}
          max={60}
          required
          error={errors.contractedHoursPerWeek?.message}
          {...register("contractedHoursPerWeek", { required: t("teachers.create.contractedHoursRequired") })}
        />
        <Input
          label={t("teachers.create.hiredAtLabel")}
          type="date"
          required
          error={errors.hiredAt?.message}
          {...register("hiredAt", { required: t("teachers.create.hiredAtRequired") })}
        />
        {formError && <p role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}
