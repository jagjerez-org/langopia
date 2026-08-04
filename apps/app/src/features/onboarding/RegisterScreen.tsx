import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Skeleton, Chip } from "@langopia/ui";
import { useT } from "../../i18n/translate.js";
import type { Translate } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { ApiError, setSchoolSlug } from "../../lib/api-client.js";
import type { BetterAuthSession } from "../auth/api.js";
import { signInWithGoogle } from "../auth/api.js";
import { MY_MEMBERSHIP_QUERY_KEY, SESSION_QUERY_KEY, TENANT_QUERY_KEY, useSession } from "../auth/session.js";
import { registerSchool, signUp } from "./api.js";
import { useSlugAvailability } from "./use-slug-availability.js";

/** Suficiente para rechazar lo obviamente mal escrito, igual que `LoginScreen`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignUpFormValues = { name: string; email: string; password: string };
type RegisterSchoolFormValues = { name: string; slug: string };

/**
 * `/registro` (Tarea 12, Paso 1): la única pantalla del panel que usa alguien
 * sin sesión ni escuela. Fuera de `protectedRoute` a propósito (como
 * `/entrar`): aquí no hay tenant que resolver ni rol que comprobar.
 *
 * Tres fases sucesivas, cada una condicionada por `useSession()` salvo la
 * primera (crear la cuenta de Better Auth, que no deja sesión resoluble
 * hasta que se verifica el correo — ver `signUp` en `api.ts`):
 *
 *   1. Anónimo → crear la cuenta (correo y contraseña, o Google).
 *   2. Cuenta creada, correo sin verificar → esperar la verificación (el
 *      enlace, en este entorno sin proveedor de correo, se registra en el
 *      log del servidor de la API — nunca se finge que se envió un correo).
 *   3. Correo verificado, sin ninguna escuela todavía → el formulario de
 *      alta (nombre y slug, con aviso de disponibilidad en vivo).
 *
 * Con una escuela ya resuelta (`"ready"`), no hay nada que registrar aquí:
 * se aparta a `/`, igual que hace `LoginScreen` para quien ya tiene sesión.
 */
export function RegisterScreen(): ReactElement | null {
  const navigate = useNavigate();
  const session = useSession();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<"sign-up" | "await-verification">("sign-up");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "ready") navigate({ to: "/", replace: true });
  }, [session.status, navigate]);

  if (session.status === "loading") {
    return (
      <main className="p-6" aria-busy="true">
        <Skeleton variant="rect" height="sm" />
      </main>
    );
  }

  if (session.status === "ready") return null; // la redirección ya está en marcha

  if (session.status === "needs-school") {
    return <RegisterSchoolStep />;
  }

  const verifyingEmail = session.status === "unverified" ? session.user.email : pendingEmail;
  if (verifyingEmail && (session.status === "unverified" || phase === "await-verification")) {
    return (
      <AwaitVerificationStep
        email={verifyingEmail}
        onConfirmed={async () => {
          await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
          const refreshed = queryClient.getQueryData<BetterAuthSession | null>(SESSION_QUERY_KEY);
          return refreshed?.user.emailVerified === true;
        }}
      />
    );
  }

  return (
    <SignUpStep
      onSignedUp={(email) => {
        setPendingEmail(email);
        setPhase("await-verification");
      }}
    />
  );
}

function SignUpStep({ onSignedUp }: { onSignedUp: (email: string) => void }): ReactElement {
  const t = useT();
  const [formError, setFormError] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({ defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
      onSignedUp(values.email);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.problem.title || t("onboarding.signUp.genericError") : t("onboarding.signUp.genericError"),
      );
    }
  });

  const onGoogleClick = async (): Promise<void> => {
    setFormError(null);
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle("/registro");
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.problem.title || t("onboarding.signUp.genericError") : t("onboarding.signUp.genericError"),
      );
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className="p-6 mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-2">{t("onboarding.signUp.title")}</h1>
      <p className="mb-4 text-muted">{t("onboarding.signUp.subtitle")}</p>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("onboarding.signUp.nameLabel")}
          autoComplete="name"
          required
          error={errors.name?.message}
          {...register("name", { required: t("onboarding.signUp.nameRequired") })}
        />
        <Input
          label={t("onboarding.signUp.emailLabel")}
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email", {
            required: t("onboarding.signUp.emailRequired"),
            pattern: { value: EMAIL_PATTERN, message: t("onboarding.signUp.emailInvalid") },
          })}
        />
        <Input
          label={t("onboarding.signUp.passwordLabel")}
          type="password"
          autoComplete="new-password"
          hint={t("onboarding.signUp.passwordHint")}
          required
          minLength={8}
          error={errors.password?.message}
          {...register("password", { required: t("onboarding.signUp.passwordRequired") })}
        />
        {formError && <p role="alert">{formError}</p>}
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? t("onboarding.signUp.submitting") : t("onboarding.signUp.submit")}
        </Button>
      </form>
      <p aria-hidden="true" className="mt-4">
        {t("auth.orDivider")}
      </p>
      <Button variant="secondary" onClick={() => void onGoogleClick()} isLoading={isGoogleSubmitting}>
        {t("auth.continueWithGoogle")}
      </Button>
      <p className="mt-6 text-sm text-muted">
        {t("onboarding.signUp.alreadyHaveAccount")}{" "}
        <a href="/entrar">{t("onboarding.signUp.signInLink")}</a>
      </p>
    </main>
  );
}

function AwaitVerificationStep({
  email,
  onConfirmed,
}: {
  email: string;
  onConfirmed: () => Promise<boolean>;
}): ReactElement {
  const t = useT();
  const [isConfirming, setIsConfirming] = useState(false);
  const [notYetVerified, setNotYetVerified] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setIsConfirming(true);
    setNotYetVerified(false);
    const verified = await onConfirmed();
    setIsConfirming(false);
    if (!verified) setNotYetVerified(true);
    // Verificado: `useSession()` deja de reportar "anonymous" en el próximo
    // render y `RegisterScreen` pasa sola al paso siguiente.
  };

  return (
    <main className="p-6 mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-2">{t("onboarding.verify.title")}</h1>
      <p className="mb-4">{t("onboarding.verify.description", { email })}</p>
      <p className="mb-4 text-sm text-muted">{t("onboarding.verify.devHint")}</p>
      {notYetVerified && <p role="alert">{t("onboarding.verify.notYetVerified")}</p>}
      <Button onClick={() => void handleConfirm()} isLoading={isConfirming}>
        {isConfirming ? t("onboarding.verify.confirming") : t("onboarding.verify.confirmButton")}
      </Button>
    </main>
  );
}

function describeSlugAvailability(
  availability: ReturnType<typeof useSlugAvailability>,
  t: Translate,
): ReactElement | null {
  if (availability === "available") {
    return (
      <p role="status" className="mt-1">
        <Chip variant="success">{t("onboarding.register.slugAvailable")}</Chip>
      </p>
    );
  }
  if (availability === "unavailable") {
    return (
      <p role="status" className="mt-1">
        <Chip variant="critical">{t("onboarding.register.slugUnavailable")}</Chip>
      </p>
    );
  }
  return null;
}

/**
 * Paso 1 verbatim del brief: alta de la escuela, con validación del slug en
 * vivo y aviso de disponibilidad (`useSlugAvailability`). No bloquea el envío
 * si el aviso dice "no disponible": es un adelanto informativo, no la
 * autoridad — esa la tiene siempre `POST /schools/register`, cuyo
 * `unique_violation` real se muestra igual si el aviso llegara a fallar o
 * quedarse desactualizado (dos personas escribiendo el mismo slug a la vez).
 */
function RegisterSchoolStep(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchoolFormValues>({ defaultValues: { name: "", slug: "" } });

  const slug = watch("slug");
  const availability = useSlugAvailability(slug);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await registerSchool({ slug: values.slug, name: values.name });
      // Fija la escuela recién creada como preferencia activa (mismo patrón
      // que `useChooseSchool`) y refresca lo que `useSession()`/`useMyRoles()`
      // reportan: hay una membresía `owner` nueva que antes no existía.
      setSchoolSlug(result.slug);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIP_QUERY_KEY }),
      ]);
      navigate({ to: "/bienvenida", replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? errorMessage(error.problem) : t("onboarding.register.genericError"));
    }
  });

  return (
    <main className="p-6 mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-2">{t("onboarding.register.title")}</h1>
      <p className="mb-4 text-muted">{t("onboarding.register.subtitle")}</p>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <Input
          label={t("onboarding.register.nameLabel")}
          required
          error={errors.name?.message}
          {...register("name", { required: t("onboarding.register.nameRequired") })}
        />
        <div>
          <Input
            label={t("onboarding.register.slugLabel")}
            hint={t("onboarding.register.slugHint")}
            required
            isLoading={availability === "checking"}
            error={errors.slug?.message}
            {...register("slug", { required: t("onboarding.register.slugRequired") })}
          />
          {slug.length > 0 && <p className="mt-1 text-sm text-muted">{t("onboarding.register.slugPreview", { slug })}</p>}
          {describeSlugAvailability(availability, t)}
        </div>
        {formError && <p role="alert">{formError}</p>}
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? t("onboarding.register.submitting") : t("onboarding.register.submit")}
        </Button>
      </form>
    </main>
  );
}
