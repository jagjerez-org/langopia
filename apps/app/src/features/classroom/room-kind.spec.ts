import { describe, expect, it } from "vitest";
import { resolveRoomKind } from "./room-kind.js";

describe("resolveRoomKind (Tarea 11, Paso 3: aula propia vs. plataformas externas)", () => {
  it("un JWT de tres segmentos distinto de la URL es el aula propia (LiveKit)", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.c2lnbmF0dXJl";
    const url = "https://aula.langopia.app/r/sesion-1";

    expect(resolveRoomKind(token, url)).toBe("livekit");
  });

  it("un token igual a la URL es una integración externa (Zoom, Meet, Teams)", () => {
    const url = "https://zoom.us/j/123456789";

    expect(resolveRoomKind(url, url)).toBe("external");
  });

  it("un token que no tiene forma de JWT, aunque distinta de la URL, no se trata como aula propia", () => {
    expect(resolveRoomKind("no-es-un-jwt", "https://teams.microsoft.com/l/meetup-join/abc")).toBe(
      "external",
    );
  });
});
