import type { Locale } from "../../../shared/infrastructure/i18n/locale.resolver.js";
import type { EmailTemplate } from "../../domain/ports/mailer.port.js";
import { formatDateTime, formatMoney, templateLocale } from "./template-locale.js";

export interface RenderedEmail {
  subject: string;
  text: string;
}

/**
 * Una plantilla por aviso y por idioma (brief de la tarea). Vive en un único
 * fichero, igual que `messages.ts` reúne los cinco idiomas de cada error de
 * dominio en una sola tabla: es la misma decisión, aplicada al mismo
 * problema — un aviso nuevo se añade en un sitio, no en cinco.
 *
 * Cada plantilla recibe primitivos ya resueltos (nombres, fechas en ISO,
 * céntimos): nunca vuelve a preguntarle a ningún puerto. Los importes se
 * FORMATEAN para mostrarse, nunca se recalculan — el céntimo entero que
 * decidió `billing` no cambia aquí.
 */

/* ─── Bienvenida al alumno ─────────────────────────────────────────────── */

interface StudentWelcomeData {
  name: string;
}

function studentWelcome(locale: Locale, data: StudentWelcomeData): RenderedEmail {
  const { name } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: "Welcome!",
        text: `Hi ${name},\n\nWelcome! Your enrolment is confirmed and you're all set to start your classes.`,
      };
    case "de-DE":
      return {
        subject: "Willkommen!",
        text: `Hallo ${name},\n\nWillkommen! Deine Anmeldung ist bestätigt, du kannst mit dem Unterricht beginnen.`,
      };
    case "pt-BR":
      return {
        subject: "Bem-vindo(a)!",
        text: `Olá ${name},\n\nBem-vindo(a)! Sua matrícula está confirmada e você já pode começar as aulas.`,
      };
    case "gl-ES":
      return {
        subject: "Benvida ou benvido!",
        text: `Ola ${name},\n\nBenvida! A túa matrícula está confirmada e xa podes comezar as clases.`,
      };
    default:
      return {
        subject: "¡Bienvenido/a!",
        text: `Hola ${name},\n\n¡Bienvenido/a! Tu matrícula está confirmada y ya puedes empezar tus clases.`,
      };
  }
}

/* ─── Recordatorio de clase ────────────────────────────────────────────── */

interface ClassReminderData {
  name: string;
  startsAt: string;
}

function classReminder(locale: Locale, data: ClassReminderData): RenderedEmail {
  const when = formatDateTime(locale, data.startsAt);
  const { name } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: "Reminder: your class is tomorrow",
        text: `Hi ${name},\n\nJust a reminder that you have a class on ${when}. See you there!`,
      };
    case "de-DE":
      return {
        subject: "Erinnerung: dein Unterricht ist morgen",
        text: `Hallo ${name},\n\nEine kurze Erinnerung: dein Unterricht findet am ${when} statt. Bis dahin!`,
      };
    case "pt-BR":
      return {
        subject: "Lembrete: sua aula é amanhã",
        text: `Olá ${name},\n\nSó um lembrete de que você tem aula em ${when}. Até lá!`,
      };
    case "gl-ES":
      return {
        subject: "Lembranza: a túa clase é mañá",
        text: `Ola ${name},\n\nSó para lembrarche que tes clase o ${when}. Vémonos aí!`,
      };
    default:
      return {
        subject: "Recordatorio: tu clase es mañana",
        text: `Hola ${name},\n\nTe recordamos que tienes clase el ${when}. ¡Nos vemos!`,
      };
  }
}

/* ─── Clase cancelada ──────────────────────────────────────────────────── */

interface ClassCanceledData {
  name: string;
  startsAt: string;
  reason: string;
}

function classCanceled(locale: Locale, data: ClassCanceledData): RenderedEmail {
  const when = formatDateTime(locale, data.startsAt);
  const { name, reason } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: "Your class has been cancelled",
        text: `Hi ${name},\n\nYour class on ${when} has been cancelled. Reason: ${reason}.`,
      };
    case "de-DE":
      return {
        subject: "Dein Unterricht wurde storniert",
        text: `Hallo ${name},\n\nDein Unterricht am ${when} wurde storniert. Grund: ${reason}.`,
      };
    case "pt-BR":
      return {
        subject: "Sua aula foi cancelada",
        text: `Olá ${name},\n\nSua aula de ${when} foi cancelada. Motivo: ${reason}.`,
      };
    case "gl-ES":
      return {
        subject: "A túa clase foi cancelada",
        text: `Ola ${name},\n\nA túa clase do ${when} foi cancelada. Motivo: ${reason}.`,
      };
    default:
      return {
        subject: "Tu clase ha sido cancelada",
        text: `Hola ${name},\n\nTu clase del ${when} ha sido cancelada. Motivo: ${reason}.`,
      };
  }
}

/* ─── Clase replanificada ──────────────────────────────────────────────── */

interface ClassRescheduledData {
  name: string;
  previousStart: string;
  newStart: string;
  reason: string;
}

function classRescheduled(locale: Locale, data: ClassRescheduledData): RenderedEmail {
  const before = formatDateTime(locale, data.previousStart);
  const after = formatDateTime(locale, data.newStart);
  const { name, reason } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: "Your class has been rescheduled",
        text: `Hi ${name},\n\nYour class originally on ${before} has moved to ${after}. Reason: ${reason}.`,
      };
    case "de-DE":
      return {
        subject: "Dein Unterricht wurde verschoben",
        text: `Hallo ${name},\n\nDein Unterricht vom ${before} findet jetzt am ${after} statt. Grund: ${reason}.`,
      };
    case "pt-BR":
      return {
        subject: "Sua aula foi remarcada",
        text: `Olá ${name},\n\nSua aula que era em ${before} passou para ${after}. Motivo: ${reason}.`,
      };
    case "gl-ES":
      return {
        subject: "A túa clase foi replanificada",
        text: `Ola ${name},\n\nA túa clase que era o ${before} pasa a ser o ${after}. Motivo: ${reason}.`,
      };
    default:
      return {
        subject: "Tu clase ha sido replanificada",
        text: `Hola ${name},\n\nTu clase que era el ${before} pasa a ser el ${after}. Motivo: ${reason}.`,
      };
  }
}

/* ─── Factura emitida ──────────────────────────────────────────────────── */

interface InvoiceIssuedData {
  name: string;
  number: string;
  totalCents: number;
  currency: string;
  dueOn: string | null;
}

function invoiceIssued(locale: Locale, data: InvoiceIssuedData): RenderedEmail {
  const total = formatMoney(locale, data.totalCents, data.currency);
  const due = data.dueOn ? formatDateTime(locale, data.dueOn) : null;
  const { name, number } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: `Invoice ${number}`,
        text:
          `Hi ${name},\n\nA new invoice (${number}) for ${total} is ready.` +
          (due ? ` Payment is due by ${due}.` : ""),
      };
    case "de-DE":
      return {
        subject: `Rechnung ${number}`,
        text:
          `Hallo ${name},\n\nEine neue Rechnung (${number}) über ${total} liegt vor.` +
          (due ? ` Fällig bis ${due}.` : ""),
      };
    case "pt-BR":
      return {
        subject: `Fatura ${number}`,
        text:
          `Olá ${name},\n\nUma nova fatura (${number}) de ${total} está disponível.` +
          (due ? ` Vencimento em ${due}.` : ""),
      };
    case "gl-ES":
      return {
        subject: `Factura ${number}`,
        text:
          `Ola ${name},\n\nHai unha nova factura (${number}) de ${total} dispoñible.` +
          (due ? ` Vencemento o ${due}.` : ""),
      };
    default:
      return {
        subject: `Factura ${number}`,
        text:
          `Hola ${name},\n\nTienes una nueva factura (${number}) de ${total} disponible.` +
          (due ? ` Vence el ${due}.` : ""),
      };
  }
}

/* ─── Cobro fallido ─────────────────────────────────────────────────────── */

interface PaymentFailedData {
  name: string;
  number: string;
  amountCents: number;
  currency: string;
  failureMessage: string | null;
}

function paymentFailed(locale: Locale, data: PaymentFailedData): RenderedEmail {
  const amount = formatMoney(locale, data.amountCents, data.currency);
  const { name, number, failureMessage } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: `Payment failed for invoice ${number}`,
        text:
          `Hi ${name},\n\nWe couldn't collect ${amount} for invoice ${number}.` +
          (failureMessage ? ` Reason: ${failureMessage}.` : "") +
          " Please update your payment details.",
      };
    case "de-DE":
      return {
        subject: `Zahlung für Rechnung ${number} fehlgeschlagen`,
        text:
          `Hallo ${name},\n\n${amount} für Rechnung ${number} konnten nicht eingezogen werden.` +
          (failureMessage ? ` Grund: ${failureMessage}.` : "") +
          " Bitte aktualisiere deine Zahlungsdaten.",
      };
    case "pt-BR":
      return {
        subject: `Falha no pagamento da fatura ${number}`,
        text:
          `Olá ${name},\n\nNão conseguimos cobrar ${amount} da fatura ${number}.` +
          (failureMessage ? ` Motivo: ${failureMessage}.` : "") +
          " Por favor, atualize seus dados de pagamento.",
      };
    case "gl-ES":
      return {
        subject: `Fallou o cobro da factura ${number}`,
        text:
          `Ola ${name},\n\nNon puidemos cobrar ${amount} da factura ${number}.` +
          (failureMessage ? ` Motivo: ${failureMessage}.` : "") +
          " Actualiza os teus datos de pagamento.",
      };
    default:
      return {
        subject: `Ha fallado el cobro de la factura ${number}`,
        text:
          `Hola ${name},\n\nNo hemos podido cobrar ${amount} de la factura ${number}.` +
          (failureMessage ? ` Motivo: ${failureMessage}.` : "") +
          " Por favor, actualiza tus datos de pago.",
      };
  }
}

/* ─── Encuesta post-clase ───────────────────────────────────────────────── */

interface PostClassSurveyData {
  name: string;
}

/**
 * Sin fecha de la clase: `ClassSessionCompleted` no la lleva en su carga
 * útil —no la necesita el resto de su contrato— y este aviso sale justo
 * después de la clase, así que no hace falta repetirla para tener sentido.
 */
function postClassSurvey(locale: Locale, data: PostClassSurveyData): RenderedEmail {
  const { name } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: "How was your class?",
        text: `Hi ${name},\n\nHow was today's class? We'd love a couple of minutes of your feedback.`,
      };
    case "de-DE":
      return {
        subject: "Wie war dein Unterricht?",
        text: `Hallo ${name},\n\nWie war dein heutiger Unterricht? Wir freuen uns über kurzes Feedback.`,
      };
    case "pt-BR":
      return {
        subject: "Como foi sua aula?",
        text: `Olá ${name},\n\nComo foi sua aula de hoje? Adoraríamos ouvir sua opinião em poucos minutos.`,
      };
    case "gl-ES":
      return {
        subject: "Que tal a túa clase?",
        text: `Ola ${name},\n\nQue tal a túa clase de hoxe? Encantaríanos coñecer a túa opinión.`,
      };
    default:
      return {
        subject: "¿Qué tal tu clase?",
        text: `Hola ${name},\n\n¿Qué tal tu clase de hoy? Nos encantaría conocer tu opinión.`,
      };
  }
}

/* ─── Impersonación de soporte (Tarea 17) ──────────────────────────────── */

interface ImpersonationStartedData {
  name: string;
  impersonatorName: string;
  reason: string;
}

/**
 * A quien se impersona, o a su tutor si es menor —lo decide quien publica el
 * evento (`OnImpersonationStarted`), no esta plantilla—. Sin fecha ni cuánto
 * queda: es un aviso de que ALGO empezó, no una cuenta atrás; quien quiera el
 * detalle exacto lo tiene en la pantalla de auditoría de la escuela (paso 12
 * del brief).
 */
function impersonationStarted(locale: Locale, data: ImpersonationStartedData): RenderedEmail {
  const { name, impersonatorName, reason } = data;
  switch (locale) {
    case "en-GB":
      return {
        subject: "Someone from support is using your account",
        text:
          `Hi ${name},\n\n${impersonatorName} has started acting on your account for support ` +
          `purposes. Reason given: ${reason}.\n\nIf this doesn't seem right, contact your school.`,
      };
    case "de-DE":
      return {
        subject: "Jemand vom Support handelt gerade in deinem Konto",
        text:
          `Hallo ${name},\n\n${impersonatorName} handelt gerade zu Support-Zwecken in deinem ` +
          `Konto. Angegebener Grund: ${reason}.\n\nWenn dir das nicht richtig erscheint, wende dich an deine Schule.`,
      };
    case "pt-BR":
      return {
        subject: "Alguém do suporte está usando sua conta",
        text:
          `Olá ${name},\n\n${impersonatorName} começou a agir na sua conta para fins de suporte. ` +
          `Motivo informado: ${reason}.\n\nSe isso não parecer correto, entre em contato com sua escola.`,
      };
    case "gl-ES":
      return {
        subject: "Alguén de soporte está a usar a túa conta",
        text:
          `Ola ${name},\n\n${impersonatorName} comezou a actuar na túa conta con fins de soporte. ` +
          `Motivo indicado: ${reason}.\n\nSe isto non parece correcto, contacta coa túa escola.`,
      };
    default:
      return {
        subject: "Alguien de soporte está actuando en tu cuenta",
        text:
          `Hola ${name},\n\n${impersonatorName} ha empezado a actuar en tu cuenta con fines de ` +
          `soporte. Motivo indicado: ${reason}.\n\nSi esto no te parece correcto, contacta con tu escuela.`,
      };
  }
}

const RENDERERS: Record<
  EmailTemplate,
  (locale: Locale, data: Record<string, unknown>) => RenderedEmail
> = {
  student_welcome: (locale, data) => studentWelcome(locale, data as unknown as StudentWelcomeData),
  class_reminder: (locale, data) => classReminder(locale, data as unknown as ClassReminderData),
  class_canceled: (locale, data) => classCanceled(locale, data as unknown as ClassCanceledData),
  class_rescheduled: (locale, data) =>
    classRescheduled(locale, data as unknown as ClassRescheduledData),
  invoice_issued: (locale, data) => invoiceIssued(locale, data as unknown as InvoiceIssuedData),
  payment_failed: (locale, data) => paymentFailed(locale, data as unknown as PaymentFailedData),
  post_class_survey: (locale, data) =>
    postClassSurvey(locale, data as unknown as PostClassSurveyData),
  impersonation_started: (locale, data) =>
    impersonationStarted(locale, data as unknown as ImpersonationStartedData),
};

/** Punto único de entrada: idioma crudo del destinatario -> asunto y cuerpo. */
export function renderEmail(
  template: EmailTemplate,
  locale: string,
  data: Record<string, unknown>,
): RenderedEmail {
  return RENDERERS[template](templateLocale(locale), data);
}
