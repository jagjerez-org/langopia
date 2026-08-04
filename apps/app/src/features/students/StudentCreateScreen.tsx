import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input, Selector } from "@langopia/ui";
import { useT } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError } from "../../lib/api-client.js";
import { isMinorOn } from "./age.js";
import { enrolStudent } from "./api.js";
import type { CefrLevel, GuardianRelationship } from "./types.js";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const RELATIONSHIPS: GuardianRelationship[] = ["mother", "father", "legal_guardian", "other"];

/** Suficiente para rechazar lo obviamente mal escrito, igual que `LoginScreen`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateStudentFormValues = {
  name: string;
  email: string;
  dateOfBirth: string;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string;
  guardian: {
    name: string;
    email: string;
    relationship: string;
  };
};

/**
 * Alta de un alumno (Tarea 7, Paso 4 — alta).
 *
 * La regla de negocio ("un menor no puede darse de alta sin tutor legal")
 * la impone el dominio en el servidor (`EnrolStudentHandler`,
 * `guardian_required`): este formulario solo LA ACOMPAÑA, mostrando la
 * sección de tutor en cuanto la fecha de nacimiento indica minoría
 * (`isMinorOn`, un cálculo de interfaz, no la fuente de verdad) y exigiendo
 * rellenarla antes de enviar por comodidad de quien teclea — nunca decide
 * por su cuenta si el alta es válida. Si el cálculo del cliente y el del
 * servidor llegaran a discrepar, `guardian_required` fuerza a mostrar la
 * sección igualmente y el mensaje de la API se enseña junto a ella.
 */
export function StudentCreateScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [forceShowGuardian, setForceShowGuardian] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentFormValues>({
    defaultValues: {
      name: "",
      email: "",
      dateOfBirth: "",
      nativeLanguage: "",
      targetLanguage: "",
      currentLevel: "",
      guardian: { name: "", email: "", relationship: "" },
    },
  });

  const dateOfBirth = watch("dateOfBirth");
  const showGuardian = forceShowGuardian || (dateOfBirth.length === 10 && isMinorOn(dateOfBirth, new Date()));

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await enrolStudent({
        name: values.name,
        email: values.email,
        dateOfBirth: values.dateOfBirth,
        nativeLanguage: values.nativeLanguage,
        targetLanguage: values.targetLanguage,
        currentLevel: values.currentLevel === "" ? null : (values.currentLevel as CefrLevel),
        guardian: showGuardian
          ? {
              name: values.guardian.name,
              email: values.guardian.email,
              relationship: values.guardian.relationship as GuardianRelationship,
            }
          : null,
      });
      await navigate({ to: "/alumnos/$studentId", params: { studentId: result.studentId } });
    } catch (error) {
      if (error instanceof ApiError && error.code === "guardian_required") {
        setForceShowGuardian(true);
        setError("guardian.name", { type: "server", message: errorMessage(error.problem) });
        return;
      }
      setFormError(error instanceof ApiError ? errorMessage(error.problem) : t("students.create.genericError"));
    }
  });

  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">{t("students.create.title")}</h1>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("students.create.nameLabel")}
          required
          error={errors.name?.message}
          {...register("name", { required: t("students.create.nameRequired") })}
        />
        <Input
          label={t("students.create.emailLabel")}
          type="email"
          required
          error={errors.email?.message}
          {...register("email", {
            required: t("students.create.emailRequired"),
            pattern: { value: EMAIL_PATTERN, message: t("students.create.emailInvalid") },
          })}
        />
        <Input
          label={t("students.create.dateOfBirthLabel")}
          type="date"
          required
          error={errors.dateOfBirth?.message}
          {...register("dateOfBirth", { required: t("students.create.dateOfBirthRequired") })}
        />
        <Input
          label={t("students.create.nativeLanguageLabel")}
          required
          error={errors.nativeLanguage?.message}
          {...register("nativeLanguage", { required: t("students.create.nativeLanguageRequired") })}
        />
        <Input
          label={t("students.create.targetLanguageLabel")}
          required
          error={errors.targetLanguage?.message}
          {...register("targetLanguage", { required: t("students.create.targetLanguageRequired") })}
        />
        <Selector
          label={t("students.create.levelLabel")}
          options={LEVELS.map((level) => ({ value: level, label: level }))}
          placeholder={t("students.levelNone")}
          {...register("currentLevel")}
        />

        {showGuardian && (
          <fieldset className="border border-border rounded-md p-4">
            <legend className="font-medium">{t("students.create.guardianTitle")}</legend>
            <p role="status" className="mb-3 text-sm">
              {t("students.create.guardianHint")}
            </p>
            <div className="flex flex-col gap-4">
              <Input
                label={t("students.create.guardianNameLabel")}
                required
                error={errors.guardian?.name?.message}
                {...register("guardian.name", {
                  required: t("students.create.guardianNameRequired"),
                })}
              />
              <Input
                label={t("students.create.guardianEmailLabel")}
                type="email"
                required
                error={errors.guardian?.email?.message}
                {...register("guardian.email", {
                  required: t("students.create.guardianEmailRequired"),
                  pattern: { value: EMAIL_PATTERN, message: t("students.create.guardianEmailInvalid") },
                })}
              />
              <Selector
                label={t("students.create.guardianRelationshipLabel")}
                required
                error={errors.guardian?.relationship?.message}
                options={RELATIONSHIPS.map((value) => ({
                  value,
                  label: t(`students.guardianRelationship.${value}`),
                }))}
                placeholder={t("students.create.guardianRelationshipLabel")}
                {...register("guardian.relationship", {
                  required: t("students.create.guardianRelationshipRequired"),
                })}
              />
            </div>
          </fieldset>
        )}

        {formError && (
          <p role="alert" className="text-critical">
            {formError}
          </p>
        )}

        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? t("students.create.submitting") : t("students.create.submit")}
        </Button>
      </form>
    </main>
  );
}
