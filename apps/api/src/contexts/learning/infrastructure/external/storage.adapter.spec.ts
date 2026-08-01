import { describe, expect, it } from "vitest";
import type { ObjectStoragePort } from "../../../shared/domain/ports/object-storage.port.js";
import { buildContentAssetStorageKey, ContentAssetStorageAdapter } from "./storage.adapter.js";

function fakeObjectStorage(): ObjectStoragePort & { puts: Array<{ key: string; body: Buffer; contentType: string }> } {
  const puts: Array<{ key: string; body: Buffer; contentType: string }> = [];
  return {
    puts,
    put: async (params) => {
      puts.push(params);
    },
    delete: async () => undefined,
  };
}

describe("buildContentAssetStorageKey", () => {
  it("construye la clave {escuela}/units/{código}/{tipo}-{n}", () => {
    expect(
      buildContentAssetStorageKey({ schoolKey: "atlantico", unitCode: "ES-B1-U07", kind: "audio", sequence: 1 }),
    ).toBe("atlantico/units/ES-B1-U07/audio-1");
    expect(
      buildContentAssetStorageKey({ schoolKey: "atlantico", unitCode: "ES-B1-U07", kind: "image", sequence: 2 }),
    ).toBe("atlantico/units/ES-B1-U07/image-2");
  });
});

describe("ContentAssetStorageAdapter", () => {
  it("sube el fichero al almacén de objetos con la clave correcta y devuelve sus metadatos", async () => {
    const objectStorage = fakeObjectStorage();
    const adapter = new ContentAssetStorageAdapter(objectStorage);
    const body = Buffer.from("contenido de audio");

    const result = await adapter.store({
      schoolKey: "atlantico",
      unitCode: "ES-B1-U07",
      kind: "audio",
      sequence: 1,
      body,
      contentType: "audio/mpeg",
    });

    expect(result).toEqual({
      storageKey: "atlantico/units/ES-B1-U07/audio-1",
      mimeType: "audio/mpeg",
      bytes: body.byteLength,
    });
    expect(objectStorage.puts).toEqual([
      { key: "atlantico/units/ES-B1-U07/audio-1", body, contentType: "audio/mpeg" },
    ]);
  });
});
