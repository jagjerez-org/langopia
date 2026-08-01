import { CommandBus } from "@nestjs/cqrs";
import { describe, expect, it, vi } from "vitest";
import { LeadCaptured } from "../../../people/domain/events/lead.events.js";
import { StartPlacementTestCommand } from "../commands/start-placement-test/start-placement-test.command.js";
import { OnLeadCapturedStartPlacement } from "./on-lead-captured.handler.js";

describe("OnLeadCapturedStartPlacement", () => {
  it("escucha LeadCaptured y arranca la prueba de nivelación sin acoplar people a assessment", async () => {
    const execute = vi.fn().mockResolvedValue({ testId: "test-1" });
    const handler = new OnLeadCapturedStartPlacement({ execute } as unknown as CommandBus);

    await handler.handle(
      new LeadCaptured({
        leadId: "11111111-1111-4111-8111-111111111111",
        schoolId: "22222222-2222-4222-8222-222222222222",
        name: "Ana García",
        email: "ana@example.com",
        interestedLanguage: "en",
        declaredLevel: "A2",
      }),
    );

    expect(execute).toHaveBeenCalledWith(expect.any(StartPlacementTestCommand));
    expect((execute.mock.calls[0]![0] as StartPlacementTestCommand).props).toEqual({
      studentProfileId: "11111111-1111-4111-8111-111111111111",
      language: "en",
    });
  });
});
