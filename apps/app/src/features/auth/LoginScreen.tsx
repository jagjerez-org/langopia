import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { Button, Input } from "@langopia/ui";
import { useT } from "../../i18n/translate.js";
import type { Translate } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { signInWithGoogle } from "./api.js";
import { useSession, useSignInWithEmail } from "./session.js";

type LoginFormValues = { email: string; password: string };

/** Suficiente para rechazar lo obviamente mal escrito sin reinventar RFC 5322. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/auth/sign-in/email` no habla el contrato de errores de la API (Problem
 * Details): es Better Auth respondiendo directamente (`AuthController` solo
 * reenvía). Sus dos códigos más comunes al iniciar sesión sí merecen un
 * mensaje propio del panel; cualquier otro cae al `title` que ya rescata
 * `api-client.ts` (su `message`, no el `code` crudo — nunca el `code` crudo).
 */
function describeSignInError(error: ApiError, t: Translate): string {
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return t("auth.invalidCredentials");
  if (error.code === "EMAIL_NOT_VERIFIED") return t("errors.email_not_verified");
  return error.problem.title || t("auth.genericError");
}

/**
 * Pantalla de acceso (Tarea 3, Paso 4): correo y contraseña, más Google.
 * Si `useSession()` ya reporta una sesión resuelta (con escuela o pendiente
 * de elegirla), esta pantalla no tiene nada que hacer aquí: se aparta hacia
 * `/`, donde el guardia del panel decide qué tocaría ver.
 */
export function LoginScreen(): ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const signInWithEmail = useSignInWithEmail();
  const [formError, setFormError] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (session.status === "ready" || session.status === "needs-school") {
      navigate({ to: "/", replace: true });
    }
  }, [session.status, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signInWithEmail(values.email, values.password);
    } catch (error) {
      setFormError(error instanceof ApiError ? describeSignInError(error, t) : t("auth.genericError"));
    }
  });

  const onGoogleClick = async (): Promise<void> => {
    setFormError(null);
    setIsGoogleSubmitting(true);
    try {
      // Si sale bien, el navegador ya está navegando a Google: no hay nada
      // más que hacer aquí. Si falla (proveedor sin configurar, red caída),
      // no se deja como una promesa sin capturar: se enseña como cualquier
      // otro fallo de acceso.
      await signInWithGoogle();
    } catch (error) {
      setFormError(error instanceof ApiError ? describeSignInError(error, t) : t("auth.genericError"));
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-canvas p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--ink-radius-md)] bg-[image:var(--ink-brand-gradient)] text-white shadow-[var(--ink-shadow-sm)]">
          <Globe size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="text-2xl font-bold tracking-[-0.02em]">{t("common.appName")}</span>
      </div>
      <section className="flex w-[min(24rem,100%)] flex-col gap-4 rounded-[var(--ink-radius-lg)] border border-border bg-surface p-6 shadow-[var(--ink-shadow-md)]">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">{t("auth.loginTitle")}</h1>
          <p className="text-sm text-muted">{t("auth.loginSubtitle")}</p>
        </div>
        {session.status === "unverified" && (
          <p role="alert" className="rounded-[var(--ink-radius-md)] bg-critical-bg p-3 font-medium text-critical text-[length:var(--ink-text-sm)]">
            {t("errors.email_not_verified")}
          </p>
        )}
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
          <Input
            label={t("auth.emailLabel")}
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email", {
              required: t("auth.emailRequired"),
              pattern: { value: EMAIL_PATTERN, message: t("auth.emailInvalid") },
            })}
          />
          <Input
            label={t("auth.passwordLabel")}
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password", { required: t("auth.passwordRequired") })}
          />
          {formError && (
            <p role="alert" className="rounded-[var(--ink-radius-md)] bg-critical-bg p-3 font-medium text-critical text-[length:var(--ink-text-sm)]">
              {formError}
            </p>
          )}
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? t("auth.submitting") : t("auth.submit")}
          </Button>
        </form>
        {/* Separador «o» con filetes a ambos lados (estilo shadcn). El literal
            sigue siendo el del diccionario; los filetes son pseudo-elementos,
            no texto. */}
        <p
          aria-hidden="true"
          className="flex items-center gap-3 text-xs uppercase text-[color:var(--ink-text-tertiary)] before:flex-1 before:border-t before:border-border before:content-[''] after:flex-1 after:border-t after:border-border after:content-['']"
        >
          {t("auth.orDivider")}
        </p>
        <Button variant="secondary" onClick={() => void onGoogleClick()} isLoading={isGoogleSubmitting}>
          {t("auth.continueWithGoogle")}
        </Button>
      </section>
    </main>
  );
}
