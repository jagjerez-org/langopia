import { describe, expect, it, vi } from "vitest";
import { JoinClassroomSessionCommand } from "../../application/commands/join-session/join-session.command.js";
import { ListTranscriptsQuery } from "../../application/queries/list-transcripts/list-transcripts.handler.js";
import { ClassroomController } from "./classroom.controller.js";

describe("ClassroomController", () => {
  it("traduce entrar en aula a comando", async () => {
    const execute = vi.fn(async () => ({ token: "t" }));
    const controller = new ClassroomController({ execute } as never, {} as never);

    await controller.join("11111111-1111-4111-8111-111111111111");

    expect(execute).toHaveBeenCalledWith(
      new JoinClassroomSessionCommand({ sessionId: "11111111-1111-4111-8111-111111111111" }),
    );
  });

  it("traduce listado de transcripciones a query bus", async () => {
    const execute = vi.fn(async () => []);
    const controller = new ClassroomController({} as never, { execute } as never);

    await controller.transcripts();

    expect(execute).toHaveBeenCalledWith(new ListTranscriptsQuery());
  });
});
