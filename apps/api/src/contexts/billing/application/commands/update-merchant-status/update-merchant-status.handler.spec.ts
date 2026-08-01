import { describe, expect, it } from "vitest";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { SchoolBillingPolicyPort } from "../../../domain/ports/school-billing-policy.port.js";
import { UpdateMerchantStatusCommand } from "./update-merchant-status.command.js";
import { UpdateMerchantStatusHandler } from "./update-merchant-status.handler.js";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeSchoolBilling(): SchoolBillingPolicyPort & { updatedTo: string[] } {
  const updatedTo: string[] = [];
  return {
    updatedTo,
    currency: async () => "EUR",
    defaultLocale: async () => "es-ES",
    country: async () => "ES",
    applicationFee: async () => ({ enabled: true, bps: 200, capCents: null }),
    merchantRef: async () => "acct_test_123",
    saveMerchantOnboarding: async () => undefined,
    updateMerchantStatus: async (status) => {
      updatedTo.push(status);
    },
  };
}

describe("UpdateMerchantStatusHandler (paso 3: account.updated traducido a nuestro vocabulario)", () => {
  it("guarda 'active' cuando el webhook ya lo tradujo a active", async () => {
    const schoolBilling = fakeSchoolBilling();
    const handler = new UpdateMerchantStatusHandler(schoolBilling, fakeUow());

    const result = await handler.execute(new UpdateMerchantStatusCommand({ status: "active" }));

    expect(result.status).toBe("active");
    expect(schoolBilling.updatedTo).toEqual(["active"]);
  });

  it("guarda 'restricted' igual de directo — el nombre que use el proveedor ya se tradujo antes de llegar aquí", async () => {
    const schoolBilling = fakeSchoolBilling();
    const handler = new UpdateMerchantStatusHandler(schoolBilling, fakeUow());

    await handler.execute(new UpdateMerchantStatusCommand({ status: "restricted" }));

    expect(schoolBilling.updatedTo).toEqual(["restricted"]);
  });
});
