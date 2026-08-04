import { useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Panel, ErrorState, Input, Selector, Skeleton, Chip, useToast } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatRelative } from "../../i18n/format.js";
import { SUPPORTED_LOCALES } from "../../i18n/locale.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { CreateCourseDialog } from "../courses/CreateCourseDialog.js";
import { languageDisplayName } from "../courses/format.js";
import { getSchoolSettings, inviteTeacher, updateSchoolSettings } from "./api.js";
import type { SchoolSettings } from "./types.js";

const SCHOOL_SETTINGS_QUERY_KEY = ["onboarding", "school-settings"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/bienvenida` (Tarea 12, Pasos 2 y 3): la primera pantalla del panel de
 * verdad, justo tras registrar la escuela. Dentro de `protectedRoute`
 * (`ProtectedLayout`, como cualquier otra pantalla): ya hay sesión, tenant y
 * membresía `owner` — es lo que acaba de crear `RegisterScreen`.
 *
 * Cuatro pasos independientes ("marca", "idiomas", "primer profesor",
 * "primer curso"), cada uno saltable por separado (Paso 2 verbatim del
 * brief) y sin orden forzado entre ellos: no es un asistente modal con
 * "siguiente"/"atrás", es una lista de tareas de puesta en marcha que se
 * completan o se saltan de una en una. "Ir al panel" está siempre
 * disponible, se hayan completado o no.
 */
export function WelcomeScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({ queryKey: SCHOOL_SETTINGS_QUERY_KEY, queryFn: getSchoolSettings });

  function refreshSettings(): void {
    void queryClient.invalidateQueries({ queryKey: SCHOOL_SETTINGS_QUERY_KEY });
  }

  if (settingsQuery.isPending) {
    return (
      <main className="p-6" aria-busy="true">
        <Skeleton variant="rect" height="lg" />
      </main>
    );
  }

  if (settingsQuery.isError) {
    const title =
      settingsQuery.error instanceof ApiError ? errorMessage(settingsQuery.error.problem) : t("onboarding.welcome.errorTitle");
    return (
      <main className="p-6">
        <ErrorState title={title} action={<Button onClick={() => void settingsQuery.refetch()}>{t("common.retry")}</Button>} />
      </main>
    );
  }

  const settings = settingsQuery.data;

  return (
    <main className="p-6 flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t("onboarding.welcome.title")}</h1>
        <p className="text-muted">{t("onboarding.welcome.subtitle")}</p>
      </div>

      <TrialBanner settings={settings} />

      <BrandStep currentName={settings.name} onSaved={refreshSettings} />
      <LanguageStep currentLocale={settings.defaultLocale} onSaved={refreshSettings} />
      <TeacherStep />
      <CourseStep defaultLocale={settings.defaultLocale} supportedLocales={settings.supportedLocales} />

      <div>
        <Button onClick={() => navigate({ to: "/", replace: true })}>{t("onboarding.welcome.goToDashboard")}</Button>
      </div>
    </main>
  );
}

/** Aviso de días de prueba (Paso 3): discreto, y ausente en cuanto la escuela deja de estar en `trial`. */
function TrialBanner({ settings }: { settings: SchoolSettings }): ReactElement | null {
  const t = useT();
  const locale = useLocale();

  if (settings.status !== "trial" || !settings.trialEndsAt) return null;

  return (
    <p role="status" className="text-sm text-muted">
      <Chip variant="neutral">{t("onboarding.trial.banner", { relative: formatRelative(settings.trialEndsAt, locale) })}</Chip>
    </p>
  );
}

type StepStatus = "pending" | "done" | "skipped";

function StepStatusTag({ status }: { status: StepStatus }): ReactElement | null {
  const t = useT();
  if (status === "done") return <Chip variant="success">{t("onboarding.brandStep.done")}</Chip>;
  if (status === "skipped") return <Chip variant="neutral">{t("onboarding.brandStep.skipped")}</Chip>;
  return null;
}

function BrandStep({ currentName, onSaved }: { currentName: string; onSaved: () => void }): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<StepStatus>("pending");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string }>({ defaultValues: { name: currentName } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await updateSchoolSettings({ name: values.name });
      setStatus("done");
      onSaved();
      showToast({ variant: "success", title: t("onboarding.brandStep.success") });
    } catch (error) {
      setFormError(error instanceof ApiError ? errorMessage(error.problem) : t("common.unexpectedError"));
    }
  });

  return (
    <Panel title={t("onboarding.brandStep.title")} actions={<StepStatusTag status={status} />}>
      <p className="mb-4 text-muted">{t("onboarding.brandStep.description")}</p>
      {status !== "skipped" && (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <Input
            label={t("onboarding.brandStep.nameLabel")}
            required
            error={errors.name?.message}
            {...register("name", { required: t("onboarding.brandStep.nameRequired") })}
          />
          {formError && <p role="alert">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? t("onboarding.brandStep.saving") : t("onboarding.brandStep.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStatus("skipped")}>
              {t("onboarding.brandStep.skip")}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function LanguageStep({ currentLocale, onSaved }: { currentLocale: string; onSaved: () => void }): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<StepStatus>("pending");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ defaultLocale: string }>({ defaultValues: { defaultLocale: currentLocale } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setIsSaving(true);
    try {
      await updateSchoolSettings({ defaultLocale: values.defaultLocale });
      setStatus("done");
      onSaved();
      showToast({ variant: "success", title: t("onboarding.languageStep.success") });
    } catch (error) {
      setFormError(error instanceof ApiError ? errorMessage(error.problem) : t("common.unexpectedError"));
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Panel title={t("onboarding.languageStep.title")} actions={<StepStatusTag status={status} />}>
      <p className="mb-4 text-muted">{t("onboarding.languageStep.description")}</p>
      {status !== "skipped" && (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <Selector
            label={t("onboarding.languageStep.label")}
            error={errors.defaultLocale?.message}
            options={SUPPORTED_LOCALES.map((code) => ({ value: code, label: languageDisplayName(code, locale) }))}
            {...register("defaultLocale")}
          />
          {formError && <p role="alert">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? t("onboarding.languageStep.saving") : t("onboarding.languageStep.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStatus("skipped")}>
              {t("onboarding.languageStep.skip")}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function TeacherStep(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<StepStatus>("pending");
  const [formError, setFormError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await inviteTeacher(values.email);
      setInvitedEmail(values.email);
      setStatus("done");
    } catch (error) {
      setFormError(error instanceof ApiError ? errorMessage(error.problem) : t("common.unexpectedError"));
    }
  });

  return (
    <Panel title={t("onboarding.teacherStep.title")} actions={<StepStatusTag status={status} />}>
      <p className="mb-4 text-muted">{t("onboarding.teacherStep.description")}</p>
      {status === "done" && invitedEmail && (
        <div>
          <p role="status">{t("onboarding.teacherStep.success", { email: invitedEmail })}</p>
          <p className="text-sm text-muted">{t("onboarding.teacherStep.noEmailHint")}</p>
        </div>
      )}
      {status === "pending" && (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <Input
            label={t("onboarding.teacherStep.emailLabel")}
            type="email"
            error={errors.email?.message}
            {...register("email", {
              required: t("onboarding.teacherStep.emailRequired"),
              pattern: { value: EMAIL_PATTERN, message: t("onboarding.teacherStep.emailInvalid") },
            })}
          />
          {formError && <p role="alert">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>
              {isSubmitting ? t("onboarding.teacherStep.inviting") : t("onboarding.teacherStep.invite")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStatus("skipped")}>
              {t("onboarding.teacherStep.skip")}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function CourseStep({ defaultLocale, supportedLocales }: { defaultLocale: string; supportedLocales: string[] }): ReactElement {
  const t = useT();
  const { showToast } = useToast();
  const [status, setStatus] = useState<StepStatus>("pending");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Panel title={t("onboarding.courseStep.title")} actions={<StepStatusTag status={status} />}>
      <p className="mb-4 text-muted">{t("onboarding.courseStep.description")}</p>
      {status === "pending" && (
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>{t("onboarding.courseStep.create")}</Button>
          <Button variant="ghost" onClick={() => setStatus("skipped")}>
            {t("onboarding.courseStep.skip")}
          </Button>
        </div>
      )}
      <CreateCourseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supportedLocales={supportedLocales}
        defaultLocale={defaultLocale}
        onCreated={() => {
          setStatus("done");
          setDialogOpen(false);
          showToast({ variant: "success", title: t("courses.create.success") });
        }}
      />
    </Panel>
  );
}
