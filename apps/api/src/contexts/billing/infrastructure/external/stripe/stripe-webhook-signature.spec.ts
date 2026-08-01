import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhook-signature.js";

const SECRET = "whsec_test_de_esta_prueba";
const PAYLOAD = JSON.stringify({ id: "evt_test_1", type: "payment_intent.succeeded" });
const NOW = new Date("2026-07-27T10:00:00Z");

function sign(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeSignature (la firma del webhook se verifica siempre)", () => {
  it("acepta una firma válida, fabricada con el mismo secreto", () => {
    const header = sign(PAYLOAD, SECRET, Math.floor(NOW.getTime() / 1000));

    const valid = verifyStripeSignature({ payload: PAYLOAD, signatureHeader: header, secret: SECRET, now: NOW });

    expect(valid).toBe(true);
  });

  it("rechaza sin cabecera de firma", () => {
    const valid = verifyStripeSignature({ payload: PAYLOAD, signatureHeader: undefined, secret: SECRET, now: NOW });
    expect(valid).toBe(false);
  });

  it("rechaza si el cuerpo cambió después de firmarlo — la garantía central de esta función", () => {
    const header = sign(PAYLOAD, SECRET, Math.floor(NOW.getTime() / 1000));
    const tampered = JSON.stringify({ id: "evt_test_1", type: "payment_intent.succeeded", amount: 999_999 });

    const valid = verifyStripeSignature({ payload: tampered, signatureHeader: header, secret: SECRET, now: NOW });

    expect(valid).toBe(false);
  });

  it("rechaza con el secreto equivocado", () => {
    const header = sign(PAYLOAD, "whsec_otro_secreto", Math.floor(NOW.getTime() / 1000));

    const valid = verifyStripeSignature({ payload: PAYLOAD, signatureHeader: header, secret: SECRET, now: NOW });

    expect(valid).toBe(false);
  });

  it("rechaza una firma con formato ilegible sin lanzar", () => {
    const valid = verifyStripeSignature({
      payload: PAYLOAD,
      signatureHeader: "t=123,v1=no-es-hexadecimal",
      secret: SECRET,
      now: NOW,
    });
    expect(valid).toBe(false);
  });

  it("rechaza un timestamp fuera de la ventana de tolerancia (posible reproducción)", () => {
    const tenMinutesAgo = Math.floor(NOW.getTime() / 1000) - 600;
    const header = sign(PAYLOAD, SECRET, tenMinutesAgo);

    const valid = verifyStripeSignature({ payload: PAYLOAD, signatureHeader: header, secret: SECRET, now: NOW });

    expect(valid).toBe(false);
  });

  it("acepta cuando hay dos secretos vigentes (rotación) y coincide el segundo", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);
    const oldSignature = sign(PAYLOAD, "whsec_viejo", timestamp).split(",")[1];
    const newSignature = sign(PAYLOAD, SECRET, timestamp).split(",")[1];
    const header = `t=${timestamp},${oldSignature},${newSignature}`;

    const valid = verifyStripeSignature({ payload: PAYLOAD, signatureHeader: header, secret: SECRET, now: NOW });

    expect(valid).toBe(true);
  });
});
