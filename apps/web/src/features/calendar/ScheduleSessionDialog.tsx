import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Button, Dialog, Input, Select } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { scheduleSession } from "./api.js";
import { zonedTimeToUtcIso } from "./zoned-time.js";

export type GroupOption = { groupId: string; label: string };
export type TeacherOption = { teacherId: string; teacherName: string };

const ROOM_PROVIDERS = ["livekit", "zoom", "google_meet", "ms_teams", "in_person"] as const;

type FormValues = {
  groupId: string;
  teacherId: string;
  startsAt: string;
  durationMinutes: number;
  roomProvider: (typeof ROOM_PROVIDERS)[number];
  roomUrl: string;
  roomExternalId: string;
  topic: string;
};

export interface ScheduleSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  timeZone: string;
  groups: GroupOption[];
  teachers: TeacherOption[];
}

/**
 * Alta de clase (Paso 2 del brief): grupo, profesor opcional, hora de inicio
 * en la zona de la escuela, duración y selector de aula (LiveKit, Zoom, Meet,
 * Teams — más presencial, el quinto proveedor real del dominio).
 *
 * Sin picker de grupos ni de profesorado propios todavía (tareas 7/8, en
 * marcha a la vez): las opciones llegan ya resueltas desde `CalendarScreen`,
 * derivadas de la agenda cargada — ver la nota de esa pantalla.
 */
export function ScheduleSessionDialog({
  open,
  onClose,
  onScheduled,
  timeZone,
  groups,
  teachers,
}: ScheduleSessionDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      groupId: "",
      teacherId: "",
      startsAt: "",
      durationMinutes: 60,
      roomProvider: "livekit",
      roomUrl: "",
      roomExternalId: "",
      topic: "",
    },
  });

  const roomProvider = watch("roomProvider");
  const needsUrl = roomProvider !== "in_person";
  const needsExternalId = roomProvider !== "in_person" && roomProvider !== "livekit";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await scheduleSession({
        groupId: values.groupId,
        teacherId: values.teacherId || null,
        startsAt: zonedTimeToUtcIso(values.startsAt, timeZone),
        durationMinutes: Number(values.durationMinutes),
        roomProvider: values.roomProvider,
        roomUrl: values.roomUrl || null,
        roomExternalId: values.roomExternalId || null,
        topic: values.topic || null,
      });
      reset();
      onScheduled();
    } catch (error) {
      if (error instanceof ApiError) {
        // Paso 5 del brief: estos dos errores de dominio se señalan junto al
        // campo del profesor, no como un aviso genérico.
        if (error.code === "teacher_overlap" || error.code === "teacher_not_available") {
          setError("teacherId", { message: describeError(error.problem) });
          return;
        }
        setFormError(describeError(error.problem));
        return;
      }
      setFormError(t("common.unexpectedError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("calendar.scheduleDialogTitle")}
      closeLabel={t("calendar.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("calendar.close")}
          </Button>
          <Button type="submit" form="schedule-session-form" isLoading={isSubmitting}>
            {isSubmitting ? t("calendar.scheduleSubmitting") : t("calendar.scheduleSubmit")}
          </Button>
        </>
      }
    >
      <form id="schedule-session-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Select
          label={t("calendar.groupLabel")}
          required
          placeholder={t("calendar.groupPlaceholder")}
          hint={groups.length === 0 ? t("calendar.groupEmptyHint") : undefined}
          error={errors.groupId?.message}
          options={groups.map((group) => ({ value: group.groupId, label: group.label }))}
          {...register("groupId", { required: t("calendar.groupPlaceholder") })}
        />
        <Select
          label={t("calendar.teacherLabel")}
          error={errors.teacherId?.message}
          options={[
            { value: "", label: t("calendar.teacherUnassignedOption") },
            ...teachers.map((teacher) => ({ value: teacher.teacherId, label: teacher.teacherName })),
          ]}
          {...register("teacherId")}
        />
        <Input
          label={t("calendar.startsAtLabel")}
          type="datetime-local"
          required
          error={errors.startsAt?.message}
          {...register("startsAt", { required: t("calendar.startsAtLabel") })}
        />
        <Input
          label={t("calendar.durationLabel")}
          type="number"
          min={15}
          max={240}
          step={5}
          required
          error={errors.durationMinutes?.message}
          {...register("durationMinutes", { required: true, min: 15, max: 240, valueAsNumber: true })}
        />
        <Select
          label={t("calendar.roomProviderLabel")}
          required
          options={ROOM_PROVIDERS.map((provider) => ({
            value: provider,
            label: t(`calendar.roomProvider${toPascalCase(provider)}`),
          }))}
          {...register("roomProvider", { required: true })}
        />
        {needsUrl && (
          <Input
            label={t("calendar.roomUrlLabel")}
            required
            error={errors.roomUrl?.message}
            {...register("roomUrl", { required: needsUrl })}
          />
        )}
        {needsExternalId && (
          <Input
            label={t("calendar.roomExternalIdLabel")}
            required
            error={errors.roomExternalId?.message}
            {...register("roomExternalId", { required: needsExternalId })}
          />
        )}
        <Input label={t("calendar.topicLabel")} {...register("topic")} />
        {formError && <p role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}

function toPascalCase(provider: string): string {
  return provider
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
