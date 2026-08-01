import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Input, Select } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { generateExam } from "./api.js";
import type { CefrLevel, ExamKind } from "./types.js";

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const KINDS: ExamKind[] = ["unit_exam", "level_exam", "mock_official"];

type FormValues = {
  kind: ExamKind;
  studentProfileIds: string;
  title: string;
  language: string;
  level: CefrLevel;
  sourceContentUnitIds: string;
  durationMinutes: string;
  mockFramework: string;
};

/** Convierte una lista separada por comas en identificadores no vacíos, sin duplicados. */
function parseIdList(value: string): string[] {
  return [...new Set(value.split(",").map((id) => id.trim()).filter((id) => id.length > 0))];
}

/**
 * Generar un examen (Tarea 15 de la ola 2, Paso 6).
 *
 * El reparto de destrezas no se pide aquí: `GenerateExamHandler` aplica por
 * defecto el de los exámenes oficiales (25 % cada una de las cuatro
 * destrezas) cuando no se manda ninguno — configurarlo a mano es una mejora
 * que queda para cuando haga falta, no algo que este formulario tenga que
 * resolver hoy.
 */
export function CreateExamScreen(): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      kind: "unit_exam",
      studentProfileIds: "",
      title: "",
      language: "",
      level: "B1",
      sourceContentUnitIds: "",
      durationMinutes: "60",
      mockFramework: "",
    },
  });

  const kind = watch("kind");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSuccess(false);
    try {
      const result = await generateExam({
        kind: values.kind,
        studentProfileIds: parseIdList(values.studentProfileIds),
        title: values.title,
        language: values.language,
        level: values.level,
        sourceContentUnitIds: parseIdList(values.sourceContentUnitIds),
        durationMinutes: Number(values.durationMinutes),
        mockFramework: values.mockFramework.trim() === "" ? null : values.mockFramework.trim(),
      });
      setSuccess(true);
      if (result.examIds[0]) {
        void navigate({ to: "/examenes/$examId", params: { examId: result.examIds[0] } });
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("exams.create.genericError"));
    }
  });

  return (
    <Card>
      <h1>{t("exams.create.title")}</h1>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Select
          label={t("exams.create.kindLabel")}
          options={KINDS.map((value) => ({
            value,
            label: t(
              value === "unit_exam"
                ? "exams.create.kindUnitExam"
                : value === "level_exam"
                  ? "exams.create.kindLevelExam"
                  : "exams.create.kindMockOfficial",
            ),
          }))}
          {...register("kind")}
        />
        <Input
          label={t("exams.create.titleLabel")}
          required
          error={errors.title?.message}
          {...register("title", { required: true })}
        />
        <Input
          label={t("exams.create.studentsLabel")}
          hint={t("exams.create.studentsHint")}
          required
          error={errors.studentProfileIds?.message}
          {...register("studentProfileIds", { required: true })}
        />
        <Input
          label={t("exams.create.languageLabel")}
          required
          error={errors.language?.message}
          {...register("language", { required: true })}
        />
        <Select label={t("exams.create.levelLabel")} options={CEFR_LEVELS.map((value) => ({ value, label: value }))} {...register("level")} />
        <Input
          label={t("exams.create.unitsLabel")}
          hint={t("exams.create.unitsHint")}
          required
          error={errors.sourceContentUnitIds?.message}
          {...register("sourceContentUnitIds", { required: true })}
        />
        <Input
          label={t("exams.create.durationLabel")}
          type="number"
          min={1}
          required
          error={errors.durationMinutes?.message}
          {...register("durationMinutes", { required: true })}
        />
        {kind === "mock_official" && (
          <Input
            label={t("exams.create.mockFrameworkLabel")}
            hint={t("exams.create.mockFrameworkHint")}
            required
            error={errors.mockFramework?.message}
            {...register("mockFramework", { required: kind === "mock_official" })}
          />
        )}

        {formError && <p role="alert">{formError}</p>}
        {success && <p role="status">{t("exams.create.success")}</p>}

        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? t("exams.create.submitting") : t("exams.create.submit")}
        </Button>
      </form>
    </Card>
  );
}
