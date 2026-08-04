import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Panel, Input, Selector } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatRelative } from "../../i18n/format.js";
import { SUPPORTED_LOCALES } from "../../i18n/locale.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { languageDisplayName } from "../courses/format.js";
import { generateUnit, getGenerationEstimate } from "./api.js";
import {
  forgetPendingGeneration,
  readPendingGeneration,
  rememberPendingGeneration,
} from "./pending-generation.js";
import { CEFR_LEVELS, EXERCISE_TYPES, LANGUAGE_SKILLS } from "./types.js";

/**
 * Los dos grupos de casillas (destrezas y tipos de ejercicio) NO van por
 * `react-hook-form`: un grupo de casillas con el mismo `name` es justo el
 * caso en que su valor deja de ser un campo y pasa a ser una lista, y
 * llevarla en estado propio hace que "al menos una" se compruebe donde se
 * lee. El resto del formulario sí es `useForm`, igual que en el generador de
 * exámenes (Tarea 15).
 */
type FormValues = {
  code: string;
  language: string;
  level: string;
  topic: string;
  primaryLocale: string;
  sourceMaterial: string;
};

/** Segundos → `mm:ss`, que es lo que interpola `content.form.progressElapsed`. */
export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * `/contenido/nuevo` — formulario de generación (Pasos 1, 2 y 5 del brief).
 *
 * El saldo y el coste estimado llegan de `GET
 * /learning/units/generation-estimate` ANTES de lanzar nada, y el bloqueo por
 * saldo es `wouldBeRejected`, decidido por el servidor con la misma
 * comparación que hace `CreditBalance.spend()`: este componente no compara
 * `estimatedCredits` con `currentBalance` en ningún sitio.
 *
 * La petición de generación es síncrona y puede tardar minutos, así que
 * mientras dura se sustituye el formulario por una vista de progreso con el
 * tiempo transcurrido, se avisa de no cerrar la pestaña (`beforeunload`) y se
 * deja un rastro en el almacenamiento local para poder explicar qué pasó si
 * la pestaña se recarga a mitad.
 */
export function GenerateUnitScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const navigate = useNavigate();

  const [formError, setFormError] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<string[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Se lee UNA vez, al montar: así el aviso habla siempre de una generación
  // anterior, nunca de la que esta misma pantalla esté a punto de lanzar.
  const [pending, setPending] = useState(() => readPendingGeneration());

  const estimateQuery = useQuery({
    queryKey: ["content", "generation-estimate"],
    queryFn: getGenerationEstimate,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      code: "",
      language: "",
      level: "B1",
      topic: "",
      primaryLocale: locale,
      sourceMaterial: "",
    },
  });

  const toggle = (
    value: string,
    setter: (updater: (current: string[]) => string[]) => void,
  ): void => {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const startedAtRef = useRef<number | null>(null);

  // Cronómetro de la vista de progreso: solo corre mientras hay una
  // generación en vuelo, y se para (y se limpia) en cuanto termina.
  useEffect(() => {
    if (!isSubmitting) {
      startedAtRef.current = null;
      setElapsedSeconds(0);
      return;
    }
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    const timer = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitting]);

  // Cerrar o recargar la pestaña no cancela la generación (el servidor sigue),
  // pero sí pierde esta pantalla: el navegador pide confirmación.
  useEffect(() => {
    if (!isSubmitting) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = t("content.form.leaveWarning");
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isSubmitting, t]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const missingSkills = skills.length === 0;
    const missingTypes = exerciseTypes.length === 0;
    setSkillsError(missingSkills ? t("content.form.skillsRequired") : null);
    setTypesError(missingTypes ? t("content.form.exerciseTypesRequired") : null);
    if (missingSkills || missingTypes) return;

    setPending(null);
    rememberPendingGeneration({ code: values.code, startedAt: new Date().toISOString() });
    try {
      const result = await generateUnit({
        code: values.code,
        language: values.language,
        level: values.level,
        topic: values.topic,
        skills,
        primaryLocale: values.primaryLocale,
        exerciseTypes,
        sourceMaterial: values.sourceMaterial.trim() === "" ? undefined : values.sourceMaterial,
      });
      forgetPendingGeneration();
      void navigate({
        to: "/contenido/$contentUnitId",
        params: { contentUnitId: result.contentUnitId },
      });
    } catch (error) {
      forgetPendingGeneration();
      setFormError(
        error instanceof ApiError ? describeError(error.problem) : t("content.form.genericError"),
      );
    }
  });

  const estimate = estimateQuery.data;
  const blocked = estimate?.wouldBeRejected === true;
  /**
   * Qué tipos NO se pueden pedir hoy lo decide la API
   * (`GenerationEstimate.unavailableExerciseTypes`, la MISMA lista que
   * rechaza `GenerateUnitHandler`): esta pantalla solo la pinta. Mientras la
   * estimación está cargando no hay nada deshabilitado — y si alguien marcara
   * un tipo que la API rechaza, el rechazo sigue viniendo del servidor.
   */
  const unavailableTypes = new Set<string>(estimate?.unavailableExerciseTypes ?? []);

  if (isSubmitting) {
    return (
      <main className="p-6" aria-busy="true">
        <Panel title={t("content.form.progressTitle")}>
          <p role="status">{t("content.form.progressDescription")}</p>
          <p>{t("content.form.progressElapsed", { elapsed: formatElapsed(elapsedSeconds) })}</p>
          <p role="alert">{t("content.form.leaveWarning")}</p>
          <Button type="button" isLoading disabled>
            {t("content.form.submitting")}
          </Button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="p-6">
      <p>
        <Link to="/contenido">{t("content.review.backToList")}</Link>
      </p>
      <h1 className="text-2xl font-semibold">{t("content.form.title")}</h1>
      <p>{t("content.form.subtitle")}</p>

      {pending && (
        <Panel title={t("content.form.pendingBannerTitle")}>
          <p role="status">
            {t("content.form.pendingBannerDescription", {
              code: pending.code,
              relative: formatRelative(pending.startedAt, locale),
            })}
          </p>
          <div className="flex gap-2">
            <Link to="/contenido">{t("content.form.pendingBannerGoToList")}</Link>
            <Button
              variant="ghost"
              onClick={() => {
                forgetPendingGeneration();
                setPending(null);
              }}
            >
              {t("content.form.pendingBannerDismiss")}
            </Button>
          </div>
        </Panel>
      )}

      <Panel title={t("content.form.creditsTitle")}>
        {estimateQuery.isPending && <p role="status">{t("common.loading")}</p>}
        {estimateQuery.isError && (
          <p role="alert">
            {estimateQuery.error instanceof ApiError
              ? describeError(estimateQuery.error.problem)
              : t("content.form.estimateErrorTitle")}
          </p>
        )}
        {estimate && (
          <dl className="grid grid-cols-2 gap-2">
            <dt>{t("content.form.balanceLabel")}</dt>
            <dd>{new Intl.NumberFormat(locale).format(estimate.currentBalance)}</dd>
            <dt>{t("content.form.estimatedCostLabel")}</dt>
            <dd>{new Intl.NumberFormat(locale).format(estimate.estimatedCredits)}</dd>
          </dl>
        )}
        {blocked && (
          <div role="alert">
            <h2>{t("content.form.rejectedTitle")}</h2>
            <p>{t("content.form.rejectedDescription")}</p>
          </div>
        )}
      </Panel>

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("content.form.codeLabel")}
          required
          error={errors.code?.message}
          {...register("code", { required: t("content.form.codeRequired") })}
        />
        <Input
          label={t("content.form.languageLabel")}
          hint={t("content.form.languageHint")}
          required
          error={errors.language?.message}
          {...register("language", { required: t("content.form.languageRequired") })}
        />
        <Selector
          label={t("content.form.levelLabel")}
          options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
          {...register("level")}
        />
        <Input
          label={t("content.form.topicLabel")}
          required
          error={errors.topic?.message}
          {...register("topic", { required: t("content.form.topicRequired") })}
        />

        <fieldset className="border border-border rounded-md p-4">
          <legend>{t("content.form.skillsLabel")}</legend>
          {LANGUAGE_SKILLS.map((skill) => (
            <label key={skill} className="flex gap-2 items-center">
              <input
                type="checkbox"
                name="skills"
                value={skill}
                checked={skills.includes(skill)}
                onChange={() => toggle(skill, setSkills)}
              />
              {t(`content.skill.${skill}`)}
            </label>
          ))}
          {skillsError && <p role="alert">{skillsError}</p>}
        </fieldset>

        <Selector
          label={t("content.form.primaryLocaleLabel")}
          options={SUPPORTED_LOCALES.map((code) => ({
            value: code,
            label: languageDisplayName(code, locale),
          }))}
          {...register("primaryLocale")}
        />

        <fieldset className="border border-border rounded-md p-4">
          <legend>{t("content.form.exerciseTypesLabel")}</legend>
          {EXERCISE_TYPES.map((type) => {
            const unavailable = unavailableTypes.has(type);
            return (
              <label key={type} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  name="exerciseTypes"
                  value={type}
                  disabled={unavailable}
                  checked={exerciseTypes.includes(type)}
                  onChange={() => toggle(type, setExerciseTypes)}
                />
                {t(`content.exerciseType.${type}`)}
                {unavailable && <span>{t("content.form.audioDisabledHint")}</span>}
              </label>
            );
          })}
          {typesError && <p role="alert">{typesError}</p>}
        </fieldset>

        <label className="flex flex-col gap-1">
          {t("content.form.sourceMaterialLabel")}
          <textarea rows={6} {...register("sourceMaterial")} />
          <span>{t("content.form.sourceMaterialHint")}</span>
        </label>

        {formError && <p role="alert">{formError}</p>}

        <Button type="submit" disabled={blocked}>
          {t("content.form.submit")}
        </Button>
      </form>
    </main>
  );
}
