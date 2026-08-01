import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Mismo criterio que `architecture.spec.ts`: excluye `.spec.ts` del corpus.
// Este fichero vive en `contexts/billing/`, ni en `domain/` ni en
// `application/`, así que nunca se examina a sí mismo aunque mencione la
// palabra "stripe" en sus propios comentarios.
function tsFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) output.push(...tsFiles(path));
    else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) output.push(path);
  }
  return output;
}

const CONTEXTS_DIR = join(__dirname, "..");

/**
 * Paso 7b del brief de la Tarea 7: la prueba que convierte «hay que tener
 * cuidado con no acoplar el dominio a Stripe» en algo que falla solo.
 *
 * Sin ella, la primera prisa mete un `stripeCustomerId` en un comando o un
 * `application_fee_amount` en el agregado, y nadie lo ve hasta que toca
 * migrar de proveedor de pago. Todo ese vocabulario debe quedar dentro de
 * `infrastructure/external/stripe/`.
 */
/**
 * `PaymentProvider.Stripe` (`domain/ports/payment-gateway.port.ts`, dado
 * verbatim por el paso 0 del brief) es la ÚNICA excepción legítima a la
 * palabra «stripe»: es un identificador de negocio —qué proveedor procesó un
 * cobro, el mismo papel que `RoomProvider.Zoom` en `scheduling`—, no forma de
 * su API. Se retira del texto antes de comprobar, para que la prueba siga
 * detectando cualquier OTRA mención (una URL de su documentación, un
 * `stripeCustomerId`, un comentario que explica cómo llamar a su API).
 */
const STRIPE_SHAPED_VOCABULARY = /paymentintent|application_fee|transfer_data/i;
const BARE_STRIPE_WORD = /stripe/i;

function mentionsProvider(content: string): boolean {
  if (STRIPE_SHAPED_VOCABULARY.test(content)) return true;
  const withoutSanctionedUsage = content
    .replace(/PaymentProvider\.Stripe/g, "")
    .replace(/Stripe:\s*"stripe"/gi, "");
  return BARE_STRIPE_WORD.test(withoutSanctionedUsage);
}

describe("billing: el dominio no sabe de Stripe", () => {
  it("billing/domain y billing/application no mencionan a ningún proveedor", () => {
    const offenders = tsFiles(join(CONTEXTS_DIR, "billing"))
      .filter((f) => f.includes("/domain/") || f.includes("/application/"))
      .filter((f) => mentionsProvider(readFileSync(f, "utf8")));
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
