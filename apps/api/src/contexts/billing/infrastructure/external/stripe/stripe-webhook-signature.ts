import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma de un webhook de Stripe.
 *
 * https://docs.stripe.com/webhooks#verify-official-libraries — el mismo
 * algoritmo que implementa el SDK oficial, reescrito aquí porque el resto de
 * este módulo no depende de él (ver la nota de `stripe-payment-gateway.
 * adapter.ts`): la cabecera `Stripe-Signature` trae `t=<timestamp>,v1=<hmac>`
 * (puede repetir `v1=` si hay dos secretos vigentes, por rotación); la firma
 * esperada es el HMAC-SHA256 del secreto sobre `"${t}.${payload}"`, en
 * hexadecimal, comparado en tiempo constante para no filtrar por
 * temporización cuánto coincide un intento.
 *
 * Sin verificar esto, cualquiera que sepa la URL del webhook puede marcar
 * facturas como pagadas — es la regla que más se repite en el brief de la
 * Tarea 8.
 */
export function verifyStripeSignature(params: {
  payload: string;
  signatureHeader: string | undefined;
  secret: string;
  /** Ventana de tolerancia contra reproducción. 300 s, igual que el SDK oficial. */
  toleranceSeconds?: number;
  now?: Date;
}): boolean {
  if (!params.signatureHeader) return false;

  const parts = parseSignatureHeader(params.signatureHeader);
  if (!parts.timestamp) return false;
  if (parts.signatures.length === 0) return false;

  const expected = createHmac("sha256", params.secret)
    .update(`${parts.timestamp}.${params.payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  const signatureMatches = parts.signatures.some((signature) => {
    let candidate: Buffer;
    try {
      candidate = Buffer.from(signature, "hex");
    } catch {
      return false;
    }
    // `timingSafeEqual` exige buffers del mismo tamaño: una firma con una
    // longitud distinta a la esperada no puede ser válida, y comprobarlo
    // antes evita que lance en vez de simplemente no coincidir.
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
  if (!signatureMatches) return false;

  const toleranceSeconds = params.toleranceSeconds ?? 300;
  const nowSeconds = (params.now ?? new Date()).getTime() / 1000;
  const ageSeconds = Math.abs(nowSeconds - Number(parts.timestamp));
  return ageSeconds <= toleranceSeconds;
}

function parseSignatureHeader(header: string): { timestamp: string | null; signatures: string[] } {
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const item of header.split(",")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }

  return { timestamp, signatures };
}
