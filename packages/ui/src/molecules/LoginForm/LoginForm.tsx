import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormAction, Input } from "../../atoms/index.js";
import { useServerError } from "../lib/use-server-error.js";
import { zodResolver } from "../lib/zod-resolver.js";

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFormProps {
  /**
   * Recibe los datos ya validados. Si devuelve una promesa, el formulario
   * queda en estado de envío (campos deshabilitados, botón con spinner) hasta
   * que se resuelva; si rechaza, su `Error.message` se muestra como error de
   * servidor.
   */
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
  /**
   * Error de servidor controlado desde fuera (ya traducido). Tiene prioridad
   * sobre el capturado del rechazo de `onSubmit`. Se anuncia con role="alert".
   */
  error?: ReactNode;
  /** Estado de envío impuesto desde fuera, además del derivado de `onSubmit`. */
  isLoading?: boolean;
  /** Longitud mínima de la contraseña. Por defecto 8. */
  minPasswordLength?: number;
  /** Si hay `href`, se muestra el enlace de recuperación de contraseña. */
  forgotPasswordHref?: string;
  forgotPasswordLabel?: ReactNode;
  emailLabel?: ReactNode;
  passwordLabel?: ReactNode;
  submitLabel?: ReactNode;
  /** Mensaje cuando el correo no tiene formato válido. */
  emailErrorMessage?: string;
  /** Mensaje cuando la contraseña no llega a `minPasswordLength`. */
  passwordErrorMessage?: string;
  /** Reserva cuando la promesa de `onSubmit` rechaza sin mensaje usable. */
  serverErrorMessage?: string;
}

const formStyles = "flex w-full flex-col gap-4";
const serverErrorStyles =
  "m-0 rounded-md border border-critical bg-critical-bg px-3 py-2 text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-critical";
const linkStyles =
  "self-start rounded-sm font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Formulario de acceso: correo + contraseña con validación zod y error de
 * servidor (por prop `error` o por rechazo de la promesa de `onSubmit`).
 * La validación es nuestra (`noValidate`); los errores de campo los pintan
 * los átomos con `role="alert"` y `aria-invalid`.
 */
export function LoginForm({
  onSubmit,
  error,
  isLoading = false,
  minPasswordLength = 8,
  forgotPasswordHref,
  forgotPasswordLabel = "¿Olvidaste tu contraseña?",
  emailLabel = "Correo electrónico",
  passwordLabel = "Contraseña",
  submitLabel = "Entrar",
  emailErrorMessage = "Introduce un correo electrónico válido.",
  passwordErrorMessage = `La contraseña debe tener al menos ${minPasswordLength} caracteres.`,
  serverErrorMessage = "No se pudo iniciar sesión. Inténtalo de nuevo.",
}: LoginFormProps): ReactElement {
  // El esquema depende de props (longitud mínima y mensajes): se memoriza.
  const schema = useMemo(
    () =>
      z.object({
        email: z.email(emailErrorMessage),
        password: z.string().min(minPasswordLength, passwordErrorMessage),
      }),
    [emailErrorMessage, minPasswordLength, passwordErrorMessage],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues, unknown, LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const { serverError, wrapSubmit } = useServerError(error, serverErrorMessage);
  const isBusy = isLoading || isSubmitting;

  return (
    <form noValidate onSubmit={handleSubmit(wrapSubmit(onSubmit))} className={formStyles}>
      <Input
        label={emailLabel}
        type="email"
        autoComplete="email"
        required
        disabled={isBusy}
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label={passwordLabel}
        type="password"
        autoComplete="current-password"
        required
        disabled={isBusy}
        error={errors.password?.message}
        {...register("password")}
      />
      {forgotPasswordHref !== undefined && (
        <a href={forgotPasswordHref} className={linkStyles}>
          {forgotPasswordLabel}
        </a>
      )}
      {serverError && (
        <p role="alert" className={serverErrorStyles}>
          {serverError}
        </p>
      )}
      <FormAction type="submit" isLoading={isBusy}>
        {submitLabel}
      </FormAction>
    </form>
  );
}
