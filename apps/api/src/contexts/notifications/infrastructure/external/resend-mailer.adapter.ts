import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import { renderEmail } from "../templates/email-templates.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * No se traga el fallo: tras agotar los reintentos, el envío falló de
 * verdad. Quien la lance decide si registrar y seguir (así lo hace cada
 * manejador de evento de este contexto: la operación que disparó el aviso ya
 * se confirmó, y un correo que no sale no debe deshacerla).
 *
 * A propósito, el mensaje NUNCA lleva el correo del destinatario: `redact()`
 * enmascara por nombre de clave en objetos planos, pero deja los `Error` tal
 * cual (`redact.ts`), así que un correo incrustado en `.message` viajaría sin
 * redactar a cualquier log que capture esta excepción. Quien la atrape ya
 * tiene el identificador de negocio (alumno, factura, sesión) para
 * correlacionar sin reintroducir el dato personal.
 */
export class MailDeliveryError extends Error {
  constructor(attempts: number, cause: unknown) {
    super(
      `No se pudo entregar el correo tras ${attempts} intento(s): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = "MailDeliveryError";
    this.cause = cause;
  }
}

/**
 * Adaptador de `MailerPort` sobre la API HTTP de Resend.
 *
 * Sin SDK propio: un solo `fetch` a `POST /emails` evita añadir una
 * dependencia nueva al monorepo por una sola llamada, y dado que no hay
 * credenciales reales en este entorno (brief de la tarea), no hay forma de
 * ejercitar un SDK contra la cuenta de verdad de todos modos.
 *
 * **Sin `RESEND_API_KEY` configurada** (este entorno, y cualquier entorno de
 * desarrollo sin proveedor de correo conectado): el correo se registra en el
 * log en vez de intentar enviarse — el mismo compromiso que ya adoptó
 * `sendVerificationEmail` en `better-auth.config.ts` para el enlace de
 * verificación. En producción sin clave, se registra como error: alguien
 * debía recibir esto y nadie lo hizo.
 *
 * **Con clave configurada:** hasta `MAX_ATTEMPTS` intentos con una pequeña
 * espera entre ellos —un fallo transitorio de red no debe perder un aviso—;
 * si los agota, lanza `MailDeliveryError` en vez de tragárselo. Cada manejador
 * de evento decide qué hacer con eso (registrar y seguir: la clase ya se
 * canceló, la factura ya se emitió).
 */
@Injectable()
export class ResendMailerAdapter implements MailerPort {
  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(ResendMailerAdapter.name) private readonly logger: PinoLogger,
  ) {}

  async send(params: {
    to: string;
    locale: string;
    template: Parameters<MailerPort["send"]>[0]["template"];
    data: Record<string, unknown>;
  }): Promise<void> {
    const { subject, text } = renderEmail(params.template, params.locale, params.data);
    const apiKey = this.config.get<string>("RESEND_API_KEY");

    if (!apiKey) {
      // `email: params.to` y no una cadena interpolada: `redact()` enmascara
      // por nombre de clave en TODO objeto que se registre (`logger.module.ts`),
      // así que esta es la única forma de que el correo del destinatario no
      // acabe en claro en el log. `subject` sí queda visible a propósito —
      // ninguna plantilla mete el nombre del destinatario en el asunto—: es
      // lo que permite comprobar en desarrollo que cada aviso salió en el
      // idioma correcto sin reintroducir a quién.
      if (this.config.get<string>("NODE_ENV") === "production") {
        this.logger.error(
          { email: params.to, template: params.template, locale: params.locale },
          "Sin proveedor de correo: este aviso no se ha enviado a nadie.",
        );
        return;
      }
      this.logger.info(
        { email: params.to, template: params.template, locale: params.locale, subject },
        "Correo (solo desarrollo): sin RESEND_API_KEY, se registra en vez de enviarse.",
      );
      return;
    }

    const from = this.config.get<string>("RESEND_FROM_EMAIL") ?? "notificaciones@langopia.app";
    await this.deliverWithRetry({ to: params.to, from, subject, text }, apiKey);
  }

  /** Punto de extensión para las pruebas: sustituir por un doble sin tocar `send()`. */
  protected httpFetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }

  private async deliverWithRetry(
    email: { to: string; from: string; subject: string; text: string },
    apiKey: string,
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.httpFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: email.from,
            to: email.to,
            subject: email.subject,
            text: email.text,
          }),
        });

        if (response.ok) return;
        lastError = new Error(`Resend respondió ${response.status}: ${await response.text()}`);
      } catch (error) {
        lastError = error;
      }

      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }

    throw new MailDeliveryError(MAX_ATTEMPTS, lastError);
  }
}
