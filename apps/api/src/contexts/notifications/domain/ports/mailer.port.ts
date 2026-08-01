/**
 * Avisos que este contexto sabe enviar. Uno por fila de la tabla del brief
 * («Invitación a la escuela» queda fuera: depende de un evento de `iam` que
 * todavía no existe — ver el informe de la tarea).
 *
 * Es vocabulario del PUERTO, no de ningún proveedor: Resend no sabe qué es un
 * `class_reminder`, solo recibe un asunto y un cuerpo ya traducidos.
 */
export const EMAIL_TEMPLATES = [
  "student_welcome",
  "class_reminder",
  "class_canceled",
  "class_rescheduled",
  "invoice_issued",
  "payment_failed",
  "post_class_survey",
  /** Tarea 17: alguien de soporte o la propia escuela ha empezado a actuar como esta persona. */
  "impersonation_started",
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/**
 * Enviar un correo, en el idioma del destinatario.
 *
 * Deliberadamente NO es `sendClassCanceled(...)`, `sendInvoiceIssued(...)`,
 * etc.: un único método con `template` como dato mantiene el puerto estable
 * aunque mañana se añada un aviso nuevo, y dice exactamente lo que promete el
 * brief — `send({ to, locale, template, data })|, ni una firma más ancha.
 *
 * `data` son primitivos ya resueltos por quien llama (nombre, fechas en ISO,
 * céntimos, código de moneda): el adaptador de correo no vuelve a preguntarle
 * a ningún otro contexto. Nunca lleva PII más allá de lo que el propio aviso
 * necesita mostrar — nunca fecha de nacimiento, nunca teléfono.
 */
export interface MailerPort {
  send(params: {
    to: string;
    locale: string;
    template: EmailTemplate;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export const MAILER = Symbol("MailerPort");
