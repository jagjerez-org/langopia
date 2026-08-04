import { useEffect } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import type { AgendaEntry } from "@langopia/contracts";
import { Button, Dialog, Input, Selector } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { rescheduleSession } from "./api.js";
import type { TeacherOption } from "./ScheduleSessionDialog.js";
import { utcIsoToZonedInputValue, zonedTimeToUtcIso } from "./zoned-time.js";

type FormValues = { newStartsAt: string; reason: string; teacherId: string };

export interface RescheduleDialogProps {
  open: boolean;
  session: AgendaEntry;
  timeZone: string;
  teachers: TeacherOption[];
  /**
   * Hora propuesta al soltar la clase arrastrada (Paso 4), ya en UTC. Rellena
   * el campo pero sigue siendo editable: soltar no aplica el cambio por sí
   * solo, solo lo propone — confirmar aquí es lo que de verdad replanifica.
   */
  prefillStartsAtIso?: string;
  onClose: () => void;
  onRescheduled: () => void;
}

/**
 * Replanificar (Paso 4 del brief). Es el mismo diálogo tanto si se llega
 * arrastrando una clase a otro hueco de `WeekGrid` como si se llega desde el
 * menú de una clase con el teclado — la confirmación, en los dos casos, es
 * este formulario.
 */
export function RescheduleDialog({
  open,
  session,
  timeZone,
  teachers,
  prefillStartsAtIso,
  onClose,
  onRescheduled,
}: RescheduleDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, submitCount },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      newStartsAt: utcIsoToZonedInputValue(prefillStartsAtIso ?? session.start, timeZone),
      reason: "",
      teacherId: session.teacherId ?? "",
    },
  });

  // El valor por defecto se calcula una sola vez al montar el formulario; si
  // la propuesta de arrastrar cambia (otra clase, u otro hueco) con el mismo
  // diálogo ya abierto, hay que reflejarlo.
  useEffect(() => {
    setValue("newStartsAt", utcIsoToZonedInputValue(prefillStartsAtIso ?? session.start, timeZone));
  }, [prefillStartsAtIso, session, timeZone, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await rescheduleSession(session.sessionId, {
        newStartsAt: zonedTimeToUtcIso(values.newStartsAt, timeZone),
        reason: values.reason,
        newTeacherId: values.teacherId || null,
      });
      reset();
      onRescheduled();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "teacher_overlap" || error.code === "teacher_not_available") {
          setError("teacherId", { message: describeError(error.problem) });
          return;
        }
        setError("root", { message: describeError(error.problem) });
        return;
      }
      setError("root", { message: t("common.unexpectedError") });
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("calendar.rescheduleDialogTitle")}
      description={`${session.groupName} — ${t("calendar.rescheduleHint")}`}
      closeLabel={t("calendar.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("calendar.close")}
          </Button>
          <Button type="submit" form="reschedule-session-form" isLoading={isSubmitting}>
            {isSubmitting ? t("calendar.confirmRescheduleSubmitting") : t("calendar.confirmReschedule")}
          </Button>
        </>
      }
    >
      <form id="reschedule-session-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Input
          label={t("calendar.newStartsAtLabel")}
          type="datetime-local"
          required
          error={errors.newStartsAt?.message}
          {...register("newStartsAt", { required: t("calendar.newStartsAtLabel") })}
        />
        <Selector
          label={t("calendar.teacherLabel")}
          error={errors.teacherId?.message}
          options={[
            { value: "", label: t("calendar.teacherUnassignedOption") },
            ...teachers.map((teacher) => ({ value: teacher.teacherId, label: teacher.teacherName })),
          ]}
          {...register("teacherId")}
        />
        <Input
          label={t("calendar.reasonLabel")}
          required
          error={errors.reason?.message}
          {...register("reason", { required: t("calendar.reasonLabel"), minLength: 3 })}
        />
        {submitCount > 0 && errors.root?.message && <p role="alert">{errors.root.message}</p>}
      </form>
    </Dialog>
  );
}
