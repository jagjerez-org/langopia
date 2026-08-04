import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Button, Dialog, Input, Select } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { createGroup } from "./api.js";

export type TeacherOption = { teacherId: string; name: string };

type FormValues = {
  name: string;
  teacherId: string;
  startsOn: string;
  endsOn: string;
};

export interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  courseId: string;
  courseLabel: string;
  teachers: TeacherOption[];
}

/** Alta de grupo (Tarea 8, Paso 3), siempre desde un curso concreto. */
export function CreateGroupDialog({
  open,
  onClose,
  onCreated,
  courseId,
  courseLabel,
  teachers,
}: CreateGroupDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ defaultValues: { name: "", teacherId: "", startsOn: "", endsOn: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createGroup({
        courseId,
        teacherId: values.teacherId || null,
        name: values.name,
        startsOn: values.startsOn,
        endsOn: values.endsOn || null,
      });
      reset();
      onCreated();
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("courses.groupCreate.genericError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("courses.groupCreate.title", { course: courseLabel })}
      closeLabel={t("courses.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("courses.close")}
          </Button>
          <Button type="submit" form="create-group-form" isLoading={isSubmitting}>
            {isSubmitting ? t("courses.groupCreate.submitting") : t("courses.groupCreate.submit")}
          </Button>
        </>
      }
    >
      <form id="create-group-form" onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("courses.groupCreate.nameLabel")}
          required
          error={errors.name?.message}
          {...register("name", { required: t("courses.groupCreate.nameRequired") })}
        />
        <Select
          label={t("courses.groupCreate.teacherLabel")}
          options={[
            { value: "", label: t("courses.groupCreate.teacherUnassignedOption") },
            ...teachers.map((teacher) => ({ value: teacher.teacherId, label: teacher.name })),
          ]}
          {...register("teacherId")}
        />
        <Input
          label={t("courses.groupCreate.startsOnLabel")}
          type="date"
          required
          error={errors.startsOn?.message}
          {...register("startsOn", { required: t("courses.groupCreate.startsOnRequired") })}
        />
        <Input label={t("courses.groupCreate.endsOnLabel")} type="date" {...register("endsOn")} />
        {formError && <p role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}
