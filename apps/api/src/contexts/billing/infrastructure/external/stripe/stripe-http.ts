/**
 * Cliente REST mínimo para la API de Stripe, compartido por los dos
 * adaptadores de esta carpeta (cobros/devoluciones y alta de comerciante).
 *
 * Sin el SDK `stripe` como dependencia: dos verbos (`GET`/`POST`) con `fetch`
 * (disponible en Node ≥ 18) no lo justifican para un cliente que hoy no se
 * ejecuta contra la red en ningún entorno de prueba de este repositorio (sin
 * `STRIPE_SECRET_KEY` en `.env`, ver el informe de la Tarea 7).
 */
export const STRIPE_API_BASE = "https://api.stripe.com/v1";

export class StripeApiKeyMissingError extends Error {
  constructor() {
    super(
      "Falta STRIPE_SECRET_KEY. Sin ella no se puede hablar con Stripe de verdad — esto no " +
        "es un fallo silencioso aceptable en el módulo de dinero.",
    );
  }
}

export class StripeRequestFailedError extends Error {
  constructor(
    readonly status: number,
    readonly stripeCode: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

type StripeApiError = { error: { code?: string; message: string; type: string } };

export async function stripeRequest<T>(params: {
  secretKey: string | undefined;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, string>;
  idempotencyKey?: string;
}): Promise<T> {
  if (!params.secretKey) throw new StripeApiKeyMissingError();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (params.idempotencyKey) headers["Idempotency-Key"] = params.idempotencyKey;

  const response = await fetch(`${STRIPE_API_BASE}${params.path}`, {
    method: params.method,
    headers,
    body: params.body ? new URLSearchParams(params.body).toString() : undefined,
  });

  const json = (await response.json()) as T | StripeApiError;
  if (!response.ok) {
    const error = (json as StripeApiError).error;
    throw new StripeRequestFailedError(response.status, error?.code, error?.message ?? "Fallo de Stripe.");
  }
  return json as T;
}
