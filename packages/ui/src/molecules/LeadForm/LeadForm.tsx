import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormAction, Input, Textarea, Toggle } from "../../atoms/index.js";
import { useServerError } from "../lib/use-server-error.js";
import { zodResolver } from "../lib/zod-resolver.js";

export interface LeadFormValues {
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
}

export interface LeadFormProps {
  /**
   * Recibe los datos ya validados. Si devuelve una promesa, el formulario
   * queda en estado de envío hasta que se resuelva; si rechaza, su
   * `Error.message` se muestra como error de servidor.
   */
  onSubmit: (values: LeadFormValues) => void | Promise<void>;
  /** Error de servidor controlado desde fuera (ya traducido), con role="alert". */
  error?: ReactNode;
  /** Estado de envío impuesto desde fuera, además del derivado de `onSubmit`. */
  isLoading?: boolean;
  /**
   * Texto del consentimiento RGPD, con hueco para el enlace a la política
   * (p. ej. un `<a>` dentro del ReactNode). Obligatorio: lo redacta la app.
   */
  consentLabel: ReactNode;
  nameLabel?: ReactNode;
  emailLabel?: ReactNode;
  phoneLabel?: ReactNode;
  messageLabel?: ReactNode;
  submitLabel?: ReactNode;
  /** Mensaje cuando falta el nombre. */
  nameErrorMessage?: string;
  /** Mensaje cuando el correo falta o no tiene formato válido. */
  emailErrorMessage?: string;
  /** Mensaje cuando no se marca el consentimiento. */
  consentErrorMessage?: string;
  /** Reserva cuando la promesa de `onSubmit` rechaza sin mensaje usable. */
  serverErrorMessage?: string;
}

const formStyles = "flex w-full flex-col gap-4";
const fieldGroupStyles = "flex w-full flex-col gap-1";
const errorStyles =
  "m-0 text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-critical";
const serverErrorStyles =
  "m-0 rounded-md border border-critical bg-critical-bg px-3 py-2 text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] font-medium text-critical";

/**
 * Formulario de captación de leads: nombre, correo, teléfono y mensaje
 * (opcionales) más el consentimiento RGPD, obligatorio. El consentimiento usa
 * `Toggle` (role="switch") porque el paquete no tiene átomo de checkbox
 * individual; su error se anuncia con role="alert" y `aria-invalid`.
 */
export function LeadForm({
  onSubmit,
  error,
  isLoading = false,
  consentLabel,
  nameLabel = "Nombre",
  emailLabel = "Correo electrónico",
  phoneLabel = "Teléfono (opcional)",
  messageLabel = "Mensaje (opcional)",
  submitLabel = "Enviar",
  nameErrorMessage = "El nombre es obligatorio.",
  emailErrorMessage = "Introduce un correo electrónico válido.",
  consentErrorMessage = "Debes aceptar la política de privacidad.",
  serverErrorMessage = "No se pudo enviar el formulario. Inténtalo de nuevo.",
}: LeadFormProps): ReactElement {
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, nameErrorMessage),
        email: z.email(emailErrorMessage),
        phone: z.string(),
        message: z.string(),
        consent: z.boolean().refine((value) => value, consentErrorMessage),
      }),
    [consentErrorMessage, emailErrorMessage, nameErrorMessage],
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues, unknown, LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", message: "", consent: false },
  });

  const { serverError, wrapSubmit } = useServerError(error, serverErrorMessage);
  const isBusy = isLoading || isSubmitting;

  return (
    <form noValidate onSubmit={handleSubmit(wrapSubmit(onSubmit))} className={formStyles}>
      <Input
        label={nameLabel}
        autoComplete="name"
        required
        disabled={isBusy}
        error={errors.name?.message}
        {...register("name")}
      />
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
        label={phoneLabel}
        type="tel"
        autoComplete="tel"
        disabled={isBusy}
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Textarea
        label={messageLabel}
        disabled={isBusy}
        error={errors.message?.message}
        {...register("message")}
      />
      <Controller
        name="consent"
        control={control}
        render={({ field }) => (
          <div className={fieldGroupStyles}>
            <Toggle
              ref={field.ref}
              checked={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              label={consentLabel}
              disabled={isBusy}
              aria-invalid={Boolean(errors.consent) || undefined}
            />
            {errors.consent && (
              <p role="alert" className={errorStyles}>
                {errors.consent.message}
              </p>
            )}
          </div>
        )}
      />
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
