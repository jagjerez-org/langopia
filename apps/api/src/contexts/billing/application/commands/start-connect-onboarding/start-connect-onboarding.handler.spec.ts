import { describe, expect, it } from "vitest";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { MerchantOnboardingPort } from "../../../domain/ports/merchant-onboarding.port.js";
import type { SchoolBillingPolicyPort } from "../../../domain/ports/school-billing-policy.port.js";
import { StartConnectOnboardingCommand } from "./start-connect-onboarding.command.js";
import { StartConnectOnboardingHandler } from "./start-connect-onboarding.handler.js";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeSchoolBilling(
  merchantRef: string | null,
): SchoolBillingPolicyPort & { saved: string[] } {
  const saved: string[] = [];
  return {
    saved,
    currency: async () => "EUR",
    defaultLocale: async () => "es-ES",
    country: async () => "DE",
    applicationFee: async () => ({ enabled: false, bps: 0, capCents: null }),
    merchantRef: async () => merchantRef,
    saveMerchantOnboarding: async (ref) => {
      saved.push(ref);
    },
    updateMerchantStatus: async () => undefined,
  };
}

function fakeOnboarding(
  returnedRef: string,
): MerchantOnboardingPort & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    createOnboardingLink: async (params) => {
      calls.push(params);
      return { merchantRef: params.merchantRef ?? returnedRef, onboardingUrl: "https://provider.example/onboard/abc" };
    },
  };
}

describe("StartConnectOnboardingHandler (paso 1: alta de comerciante vía MerchantOnboardingPort)", () => {
  it("una escuela sin comerciante todavía (not_started) crea una cuenta nueva y la guarda", async () => {
    const schoolBilling = fakeSchoolBilling(null);
    const onboarding = fakeOnboarding("acct_new_123");
    const handler = new StartConnectOnboardingHandler(schoolBilling, onboarding, fakeUow());

    const result = await handler.execute(
      new StartConnectOnboardingCommand({
        returnUrl: "https://panel.langopia.app/billing/onboarding/return",
        refreshUrl: "https://panel.langopia.app/billing/onboarding/refresh",
      }),
    );

    expect(result.onboardingUrl).toBe("https://provider.example/onboard/abc");
    expect(onboarding.calls).toEqual([
      {
        merchantRef: null,
        country: "DE",
        returnUrl: "https://panel.langopia.app/billing/onboarding/return",
        refreshUrl: "https://panel.langopia.app/billing/onboarding/refresh",
      },
    ]);
    expect(schoolBilling.saved).toEqual(["acct_new_123"]);
  });

  it("una escuela que ya empezó el trámite reutiliza su referencia de comerciante, no crea una segunda", async () => {
    const schoolBilling = fakeSchoolBilling("acct_existing_456");
    const onboarding = fakeOnboarding("acct_should_not_be_used");
    const handler = new StartConnectOnboardingHandler(schoolBilling, onboarding, fakeUow());

    await handler.execute(
      new StartConnectOnboardingCommand({
        returnUrl: "https://panel.langopia.app/return",
        refreshUrl: "https://panel.langopia.app/refresh",
      }),
    );

    expect((onboarding.calls[0] as { merchantRef: string | null }).merchantRef).toBe(
      "acct_existing_456",
    );
    expect(schoolBilling.saved).toEqual(["acct_existing_456"]);
  });
});
