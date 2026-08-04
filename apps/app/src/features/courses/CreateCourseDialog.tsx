import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Button, Dialog, Input, Selector } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { createCourse } from "./api.js";
import { languageDisplayName } from "./format.js";
import type { CourseModality } from "./types.js";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const MODALITIES: CourseModality[] = [
  "private",
  "group",
  "intensive",
  "exam_prep",
  "business",
  "conversation",
];

type TranslationFieldValues = { name: string; description: string };

type FormValues = {
  code: string;
  language: string;
  level: string;
  modality: CourseModality;
  totalSessions: string;
  sessionMinutes: string;
  maxStudents: string;
  priceCents: string;
  currency: string;
  translations: Record<string, TranslationFieldValues>;
};

export interface CreateCourseDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Idiomas de la escuela activa (`GET /courses/locales`): un campo de nombre/descripción por cada uno. */
  supportedLocales: string[];
  defaultLocale: string;
}

/**
 * Alta de curso (Tarea 8, Paso 2): un campo de nombre/descripción por cada
 * idioma que la escuela soporta, tal como pide el brief verbatim. El del
 * idioma por defecto es obligatorio —`Course.create()` lo exige
 * (`missing_default_translation`)—; el resto son opcionales, y una fila que
 * se deja en blanco no se manda como traducción.
 */
export function CreateCourseDialog({
  open,
  onClose,
  onCreated,
  supportedLocales,
  defaultLocale,
}: CreateCourseDialogProps): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      code: "",
      language: "",
      level: "A1",
      modality: "group",
      totalSessions: "",
      sessionMinutes: "",
      maxStudents: "",
      priceCents: "",
      currency: "EUR",
      translations: Object.fromEntries(supportedLocales.map((l) => [l, { name: "", description: "" }])),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const translations = supportedLocales
      .map((localeCode) => ({
        locale: localeCode,
        name: values.translations[localeCode]?.name.trim() ?? "",
        description: values.translations[localeCode]?.description.trim() || null,
      }))
      .filter((translation) => translation.name !== "");

    try {
      await createCourse({
        code: values.code,
        language: values.language,
        level: values.level,
        modality: values.modality,
        totalSessions: values.totalSessions === "" ? undefined : Number(values.totalSessions),
        sessionMinutes: values.sessionMinutes === "" ? undefined : Number(values.sessionMinutes),
        maxStudents: values.maxStudents === "" ? undefined : Number(values.maxStudents),
        priceCents: Number(values.priceCents),
        currency: values.currency,
        translations,
      });
      reset();
      onCreated();
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("courses.create.genericError"));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("courses.create.title")}
      closeLabel={t("courses.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("courses.close")}
          </Button>
          <Button type="submit" form="create-course-form" isLoading={isSubmitting}>
            {isSubmitting ? t("courses.create.submitting") : t("courses.create.submit")}
          </Button>
        </>
      }
    >
      <form id="create-course-form" onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("courses.create.codeLabel")}
          required
          error={errors.code?.message}
          {...register("code", { required: t("courses.create.codeRequired") })}
        />
        <Input
          label={t("courses.create.languageLabel")}
          required
          error={errors.language?.message}
          {...register("language", { required: t("courses.create.languageRequired") })}
        />
        <Selector
          label={t("courses.create.levelLabel")}
          options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
          {...register("level")}
        />
        <Selector
          label={t("courses.create.modalityLabel")}
          options={MODALITIES.map((value) => ({ value, label: t(`courses.modality.${value}`) }))}
          {...register("modality")}
        />
        <Input
          label={t("courses.create.totalSessionsLabel")}
          hint={t("courses.create.totalSessionsHint")}
          type="number"
          min={1}
          {...register("totalSessions")}
        />
        <Input
          label={t("courses.create.sessionMinutesLabel")}
          type="number"
          min={15}
          max={240}
          {...register("sessionMinutes")}
        />
        <Input
          label={t("courses.create.maxStudentsLabel")}
          hint={t("courses.create.maxStudentsHint")}
          type="number"
          min={1}
          {...register("maxStudents")}
        />
        <Input
          label={t("courses.create.priceLabel")}
          hint={t("courses.create.priceHint")}
          type="number"
          min={0}
          required
          error={errors.priceCents?.message}
          {...register("priceCents", { required: t("courses.create.priceRequired") })}
        />
        <Input label={t("courses.create.currencyLabel")} {...register("currency")} />

        <fieldset className="border border-border rounded-md p-4">
          <legend className="font-medium">{t("courses.create.translationsTitle")}</legend>
          <p role="status" className="mb-3 text-sm text-muted">
            {t("courses.create.translationsHint", { locale: languageDisplayName(defaultLocale, locale) })}
          </p>
          <div className="flex flex-col gap-4">
            {supportedLocales.map((localeCode) => {
              const isDefault = localeCode === defaultLocale;
              const language = languageDisplayName(localeCode, locale);
              return (
                <div key={localeCode} className="flex flex-col gap-2">
                  <Input
                    label={t("courses.create.translationNameLabel", { language })}
                    required={isDefault}
                    error={errors.translations?.[localeCode]?.name?.message}
                    {...register(`translations.${localeCode}.name`, {
                      required: isDefault ? t("courses.create.translationNameRequired") : false,
                    })}
                  />
                  <Input
                    label={t("courses.create.translationDescriptionLabel", { language })}
                    {...register(`translations.${localeCode}.description`)}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        {formError && <p role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}
