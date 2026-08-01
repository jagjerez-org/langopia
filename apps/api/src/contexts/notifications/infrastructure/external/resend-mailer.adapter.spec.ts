import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { MailDeliveryError, ResendMailerAdapter } from "./resend-mailer.adapter.js";

/** De mentira, sin pasar por `nestjs-pino`: lo que se prueba aquí es el envío, no el registro. */
function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/** Expone `httpFetch` para poder sustituirlo por un doble en cada prueba. */
class TestableResendMailerAdapter extends ResendMailerAdapter {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = () => {
    throw new Error("no configurado en esta prueba");
  };

  protected override httpFetch(url: string, init: RequestInit): Promise<Response> {
    return this.fetchImpl(url, init);
  }
}

const OK_RESPONSE = { ok: true, status: 200, text: async () => "" } as Response;

describe("ResendMailerAdapter", () => {
  it("sin RESEND_API_KEY, registra el correo en el log y no intenta enviarlo (paso 5: sin credenciales en desarrollo)", async () => {
    const logger = fakeLogger();
    const adapter = new TestableResendMailerAdapter(
      configWith({ RESEND_API_KEY: undefined, NODE_ENV: "development" }),
      logger as never,
    );
    adapter.fetchImpl = vi.fn();

    await adapter.send({
      to: "alumno@example.com",
      locale: "es-ES",
      template: "student_welcome",
      data: { name: "Nerea" },
    });

    expect(adapter.fetchImpl).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledOnce();
  });

  it("en producción sin RESEND_API_KEY, registra el fallo como error en vez de callar", async () => {
    const logger = fakeLogger();
    const adapter = new TestableResendMailerAdapter(
      configWith({ RESEND_API_KEY: undefined, NODE_ENV: "production" }),
      logger as never,
    );
    adapter.fetchImpl = vi.fn();

    await adapter.send({
      to: "alumno@example.com",
      locale: "es-ES",
      template: "student_welcome",
      data: { name: "Nerea" },
    });

    expect(adapter.fetchImpl).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("con clave configurada, envía por HTTP a Resend con asunto y cuerpo ya traducidos", async () => {
    const logger = fakeLogger();
    const adapter = new TestableResendMailerAdapter(
      configWith({ RESEND_API_KEY: "re_test_123", NODE_ENV: "development" }),
      logger as never,
    );
    const calls: unknown[] = [];
    adapter.fetchImpl = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return OK_RESPONSE;
    };

    await adapter.send({
      to: "tutor@example.com",
      locale: "en-GB",
      template: "student_welcome",
      data: { name: "Adrián" },
    });

    expect(calls).toHaveLength(1);
    const call = calls[0] as { url: string; body: { to: string; subject: string; text: string } };
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.body.to).toBe("tutor@example.com");
    expect(call.body.subject).toBe("Welcome!");
    expect(call.body.text).toContain("Adrián");
  });

  it("reintenta tras un fallo transitorio y termina entregando el correo", async () => {
    const adapter = new TestableResendMailerAdapter(
      configWith({ RESEND_API_KEY: "re_test_123" }),
      fakeLogger() as never,
    );
    let attempts = 0;
    adapter.fetchImpl = async () => {
      attempts += 1;
      if (attempts < 2) throw new Error("ECONNRESET");
      return OK_RESPONSE;
    };

    await adapter.send({
      to: "alumno@example.com",
      locale: "es-ES",
      template: "student_welcome",
      data: { name: "Nerea" },
    });

    expect(attempts).toBe(2);
  });

  it("agota los reintentos y lanza en vez de tragarse el fallo (guardia de «sin silencios»)", async () => {
    const adapter = new TestableResendMailerAdapter(
      configWith({ RESEND_API_KEY: "re_test_123" }),
      fakeLogger() as never,
    );
    adapter.fetchImpl = async () => {
      throw new Error("la red no responde");
    };

    await expect(
      adapter.send({
        to: "alumno@example.com",
        locale: "es-ES",
        template: "student_welcome",
        data: { name: "Nerea" },
      }),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });

  it("una respuesta HTTP que no es 2xx también cuenta como fallo, no como envío", async () => {
    const adapter = new TestableResendMailerAdapter(
      configWith({ RESEND_API_KEY: "re_test_123" }),
      fakeLogger() as never,
    );
    adapter.fetchImpl = async () =>
      ({ ok: false, status: 422, text: async () => "correo inválido" }) as Response;

    await expect(
      adapter.send({
        to: "no-es-un-correo",
        locale: "es-ES",
        template: "student_welcome",
        data: { name: "Nerea" },
      }),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });
});
