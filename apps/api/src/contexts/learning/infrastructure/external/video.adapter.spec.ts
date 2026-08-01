import { describe, expect, it, vi } from "vitest";
import { ContentAssetStorageAdapter } from "./storage.adapter.js";
import { MissingVideoProviderCredentialsError, VideoAdapter } from "./video.adapter.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const UNIT = {
  contentUnitId: "22222222-2222-4222-8222-222222222222",
  code: "ES-B1-U07",
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  primaryLocale: "es-ES",
};

function fakeConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

function fakeTenant() {
  return { schoolId: () => SCHOOL_ID };
}

function fakeUow() {
  return { read: (work: () => unknown) => work(), execute: (work: () => unknown) => work() };
}

function fakeObjectStorage() {
  return { put: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
}

function fakeDrizzle(videoBetaEnabled: boolean) {
  const inserted: unknown[] = [];
  return {
    inserted,
    db: {
      select: () => ({
        from: () => ({
          limit: () => [{ videoBetaEnabled }],
        }),
      }),
      insert: () => ({
        values: (row: unknown) => {
          inserted.push(row);
        },
      }),
    },
  };
}

class TestableVideoAdapter extends VideoAdapter {
  readonly generateVideoBytesSpy = vi.fn(async () => ({
    bytes: Buffer.from("mp4"),
    mimeType: "video/mp4",
    durationMs: 42_000,
  }));

  protected override generateVideoBytes() {
    return this.generateVideoBytesSpy();
  }
}

function buildAdapter(params: { videoBetaEnabled: boolean; config?: Record<string, string | undefined> }) {
  const drizzle = fakeDrizzle(params.videoBetaEnabled);
  const objectStorage = fakeObjectStorage();
  const adapter = new TestableVideoAdapter(
    fakeConfig(params.config ?? {}) as never,
    new ContentAssetStorageAdapter(objectStorage as never),
    drizzle as never,
    fakeUow() as never,
    fakeTenant() as never,
  );
  return { adapter, drizzle, objectStorage };
}

describe("VideoAdapter", () => {
  it("con videoBetaEnabled apagado no llama al proveedor ni guarda assets", async () => {
    const { adapter, drizzle, objectStorage } = buildAdapter({
      videoBetaEnabled: false,
      config: { VIDEO_PROVIDER_ENDPOINT: "https://video.example.test", VIDEO_PROVIDER_API_KEY: "test" },
    });

    await adapter.generateBetaVideoForPublishedUnit(UNIT);

    expect(adapter.generateVideoBytesSpy).not.toHaveBeenCalled();
    expect(objectStorage.put).not.toHaveBeenCalled();
    expect(drizzle.inserted).toEqual([]);
  });

  it("con beta encendida y credenciales guarda un asset de vídeo marcado como beta", async () => {
    const { adapter, drizzle, objectStorage } = buildAdapter({
      videoBetaEnabled: true,
      config: { VIDEO_PROVIDER_ENDPOINT: "https://video.example.test", VIDEO_PROVIDER_API_KEY: "test" },
    });

    await adapter.generateBetaVideoForPublishedUnit(UNIT);

    expect(objectStorage.put).toHaveBeenCalledWith({
      key: `${SCHOOL_ID}/units/ES-B1-U07/video-1`,
      body: Buffer.from("mp4"),
      contentType: "video/mp4",
    });
    expect(drizzle.inserted).toEqual([
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        contentUnitId: UNIT.contentUnitId,
        kind: "video",
        storageKey: `${SCHOOL_ID}/units/ES-B1-U07/video-1`,
        mimeType: "video/mp4",
        bytes: 3,
        durationMs: 42_000,
        provider: "video-beta",
        isBeta: true,
      }),
    ]);
  });

  it("con beta encendida pero sin credenciales falla limpio antes de tocar el almacén", async () => {
    const { adapter, objectStorage } = buildAdapter({ videoBetaEnabled: true });

    await expect(adapter.generateBetaVideoForPublishedUnit(UNIT)).rejects.toBeInstanceOf(
      MissingVideoProviderCredentialsError,
    );
    expect(objectStorage.put).not.toHaveBeenCalled();
  });
});
